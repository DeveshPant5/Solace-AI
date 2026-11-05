import type Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { z } from "zod";
import { analyzeMessage, generateTitle } from "../ai/analysis.js";
import { logAiError } from "../ai/client.js";
import { runCompanionTurn, type Emit } from "../ai/companion.js";
import { buildUserContext } from "../ai/context.js";
import { currentUser } from "../auth.js";
import { aiEnabled } from "../config.js";
import { query, queryOne } from "../db.js";
import { HttpError } from "../errors.js";
import { awardDailyChatXp } from "../lib/progress.js";

export const conversationsRouter = Router();

interface ConversationRow {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  preview: string | null;
  message_count: number;
}

const toConversation = (c: ConversationRow) => ({
  id: c.id,
  title: c.title,
  createdAt: c.created_at,
  updatedAt: c.updated_at,
  preview: c.preview,
  messageCount: c.message_count,
});

conversationsRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const rows = await query<ConversationRow>(
    `SELECT c.id, c.title, c.created_at, c.updated_at,
       (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS preview,
       (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
     FROM conversations c WHERE c.user_id = $1 ORDER BY c.updated_at DESC LIMIT 100`,
    [user.id],
  );
  res.json({ conversations: rows.map(toConversation) });
});

conversationsRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const row = await queryOne<ConversationRow>(
    `INSERT INTO conversations (user_id) VALUES ($1)
     RETURNING id, title, created_at, updated_at, NULL::text AS preview, 0::int AS message_count`,
    [user.id],
  );
  res.status(201).json({ conversation: toConversation(row!) });
});

async function ownedConversation(userId: string, id: string) {
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, "Conversation not found", "not_found");
  const row = await queryOne<{ id: string; title: string | null; created_at: string; updated_at: string }>(
    "SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  if (!row) throw new HttpError(404, "Conversation not found", "not_found");
  return row;
}

conversationsRouter.get("/:id", async (req, res) => {
  const user = currentUser(req);
  const convo = await ownedConversation(user.id, req.params.id);
  const messages = await query<{ id: string; role: string; content: string; meta: unknown; created_at: string }>(
    "SELECT id, role, content, meta, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at",
    [convo.id],
  );
  res.json({
    conversation: { id: convo.id, title: convo.title, createdAt: convo.created_at, updatedAt: convo.updated_at },
    messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, meta: m.meta, createdAt: m.created_at })),
  });
});

conversationsRouter.patch("/:id", async (req, res) => {
  const user = currentUser(req);
  const convo = await ownedConversation(user.id, req.params.id);
  const { title } = z.object({ title: z.string().trim().min(1).max(60) }).parse(req.body);
  await query("UPDATE conversations SET title = $2 WHERE id = $1", [convo.id, title]);
  res.json({ ok: true });
});

conversationsRouter.delete("/:id", async (req, res) => {
  const user = currentUser(req);
  const convo = await ownedConversation(user.id, req.params.id);
  await query("DELETE FROM conversations WHERE id = $1", [convo.id]);
  res.status(204).end();
});

const SendMessage = z.object({ content: z.string().trim().min(1, "Message is empty").max(4000) });

/**
 * Sends a message and streams Sol's reply as Server-Sent Events:
 *   user      {id, createdAt}                 the stored user message
 *   delta     {text}                          reply text as it's written
 *   replace   {text}                          replace the reply text so far
 *   suggestion {activity, reason, journalPrompt?}
 *   memory    {id, content}                   Sol saved something to memory
 *   reminder  {id, title, body, hour, minute} Sol created a reminder
 *   signal    {mood, emotions, risk}          detected mood of the user message
 *   title     {title}                         conversation title
 *   done      {message}                       the stored assistant message
 *   error     {message}
 */
conversationsRouter.post("/:id/messages", async (req, res) => {
  const user = currentUser(req);
  const convo = await ownedConversation(user.id, req.params.id);
  const { content } = SendMessage.parse(req.body);
  if (!aiEnabled) {
    throw new HttpError(
      503,
      "Sol isn't connected yet. Add an Anthropic API key to the backend to start chatting.",
      "ai_unavailable",
    );
  }

  const userMessage = await queryOne<{ id: string; created_at: string }>(
    "INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2) RETURNING id, created_at",
    [convo.id, content],
  );
  await query("UPDATE conversations SET updated_at = now() WHERE id = $1", [convo.id]);

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let clientGone = false;
  res.on("close", () => {
    clientGone = true;
  });
  const emit: Emit = (event, data) => {
    if (clientGone) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const heartbeat = setInterval(() => !clientGone && res.write(": ping\n\n"), 15000);

  emit("user", { id: userMessage!.id, createdAt: userMessage!.created_at });

  // Last 40 messages, oldest first. Only visible text is replayed.
  const historyRows = (
    await query<{ role: "user" | "assistant"; content: string }>(
      "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 40",
      [convo.id],
    )
  ).reverse();
  while (historyRows.length && historyRows[0]!.role !== "user") historyRows.shift();
  const history: Anthropic.Beta.BetaMessageParam[] = historyRows.map((m) => ({ role: m.role, content: m.content }));
  const recentText = historyRows
    .slice(-7, -1)
    .map((m) => `${m.role === "user" ? "User" : "Sol"}: ${m.content.slice(0, 400)}`)
    .join("\n");

  const memoryEnabled = user.preferences.memoryEnabled !== false;
  const signalPromise = analyzeMessage(content, recentText).then((signal) => {
    if (signal) emit("signal", signal);
    return signal;
  });

  try {
    const userContext = await buildUserContext(user, { excludeConversationId: convo.id });
    const turn = await runCompanionTurn({
      userId: user.id,
      conversationId: convo.id,
      memoryEnabled,
      userContext,
      history,
      emit,
    });
    const signal = await signalPromise;
    if (signal) {
      await query("UPDATE messages SET meta = $2 WHERE id = $1", [userMessage!.id, { signal }]);
    }
    const meta = {
      ...(turn.suggestions.length ? { suggestions: turn.suggestions } : {}),
      ...(turn.memories.length ? { memories: turn.memories } : {}),
      ...(turn.reminders.length ? { reminders: turn.reminders } : {}),
      ...(signal && signal.risk !== "none" ? { safety: signal.risk } : {}),
    };
    const saved = await queryOne<{ id: string; created_at: string }>(
      "INSERT INTO messages (conversation_id, role, content, meta) VALUES ($1, 'assistant', $2, $3) RETURNING id, created_at",
      [convo.id, turn.text, meta],
    );
    await query("UPDATE conversations SET updated_at = now() WHERE id = $1", [convo.id]);
    const xp = await awardDailyChatXp(user.id, user.timezone);
    emit("done", {
      message: { id: saved!.id, role: "assistant", content: turn.text, meta, createdAt: saved!.created_at },
      xp,
    });

    if (!convo.title) {
      const title = await generateTitle(content, turn.text);
      if (title) {
        await query("UPDATE conversations SET title = $2 WHERE id = $1 AND title IS NULL", [convo.id, title]);
        emit("title", { title });
      }
    }
  } catch (err) {
    logAiError("chat", err);
    emit("error", { message: "Sol couldn't reply just now. Please try again in a moment." });
  } finally {
    clearInterval(heartbeat);
    if (!clientGone) res.end();
  }
});
