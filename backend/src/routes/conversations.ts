import type Anthropic from "@anthropic-ai/sdk";
import { Router, type Response } from "express";
import { z } from "zod";
import { analyzeMessage, generateTitle, type MessageSignal } from "../ai/analysis.js";
import { logAiError } from "../ai/client.js";
import { DECLINED_TEXT, newTurnResult, runCompanionTurn, type Emit, type Suggestion } from "../ai/companion.js";
import { buildUserContext } from "../ai/context.js";
import { combineRisk, type Risk } from "../ai/safety.js";
import { currentUser } from "../auth.js";
import { aiEnabled } from "../config.js";
import { query, queryOne } from "../db.js";
import { HttpError } from "../errors.js";
import { aiAllowed } from "../lib/budget.js";
import { isShuttingDown, shutdownSignal } from "../lib/lifecycle.js";
import { awardDailyChatXp } from "../lib/progress.js";
import { userRateLimit } from "../lib/rateLimit.js";
import { lineField, textField } from "../lib/text.js";

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

conversationsRouter.post("/", userRateLimit({ limit: 30, windowMs: 60 * 60_000 }), async (req, res) => {
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
  const { title } = z.object({ title: lineField(60).pipe(z.string().min(1)) }).parse(req.body);
  await query("UPDATE conversations SET title = $2 WHERE id = $1 AND user_id = $3", [convo.id, title, user.id]);
  res.json({ ok: true });
});

conversationsRouter.delete("/:id", async (req, res) => {
  const user = currentUser(req);
  const convo = await ownedConversation(user.id, req.params.id);
  await query("DELETE FROM conversations WHERE id = $1 AND user_id = $2", [convo.id, user.id]);
  res.status(204).end();
});

const SendMessage = z.object({ content: textField(4000).pipe(z.string().min(1, "Message is empty")) });

// ---------- Limits for sending messages ----------

const MINUTE = 60_000;
const chatBurstLimit = userRateLimit({
  limit: 30,
  windowMs: 10 * MINUTE,
  message: "Let's slow down for a moment. You've sent a lot of messages quickly, so please give it a few minutes.",
});
const chatDailyLimit = userRateLimit({
  limit: 200,
  windowMs: 24 * 60 * MINUTE,
  message: "Sol needs some rest after a long day of talking. You can pick this up again tomorrow.",
});
/** Replies being written right now, per person. */
const activeTurns = new Map<string, number>();
const MAX_ACTIVE_TURNS = 2;

/** History replayed to the model: newest messages first, within a size budget. */
const HISTORY_MAX_MESSAGES = 40;
const HISTORY_MAX_CHARS = 24_000;
const SIGNAL_GRACE_MS = 10_000;

/** Open chat streams, so shutdown can close them politely. */
export const openStreams = new Set<Response>();

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
conversationsRouter.post("/:id/messages", chatBurstLimit, chatDailyLimit, async (req, res) => {
  const user = currentUser(req);
  const convo = await ownedConversation(user.id, String(req.params.id ?? ""));
  const { content } = SendMessage.parse(req.body);
  if (!aiEnabled) {
    throw new HttpError(503, "Sol isn't connected yet. Add an Anthropic API key to the backend to start chatting.", "ai_unavailable");
  }
  if (isShuttingDown()) {
    throw new HttpError(503, "Sol is taking a short pause while the server restarts. Please try again in a moment.", "restarting");
  }
  if (!aiAllowed({ userId: user.id })) {
    throw new HttpError(503, "Sol is resting for today. Your practices and journal are still here, and Sol will be back tomorrow.", "ai_resting");
  }
  if ((activeTurns.get(user.id) ?? 0) >= MAX_ACTIVE_TURNS) {
    throw new HttpError(429, "Sol is still finishing a reply. Give it a moment, then send again.", "busy");
  }

  activeTurns.set(user.id, (activeTurns.get(user.id) ?? 0) + 1);
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    // Everything that can fail with an ordinary error happens before the stream starts.
    const userMessage = (await queryOne<{ id: string; created_at: string }>(
      "INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2) RETURNING id, created_at",
      [convo.id, content],
    ))!;
    await query("UPDATE conversations SET updated_at = now() WHERE id = $1", [convo.id]);
    const { history, recentText } = await loadHistory(convo.id);
    const memoryEnabled = user.preferences.memoryEnabled !== false;

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    openStreams.add(res);

    let clientGone = false;
    res.on("close", () => {
      clientGone = true;
      openStreams.delete(res);
      clearInterval(heartbeat);
    });
    const emit: Emit = (event, data) => {
      if (clientGone || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    heartbeat = setInterval(() => !clientGone && !res.writableEnded && res.write(": ping\n\n"), 15_000);

    emit("user", { id: userMessage.id, createdAt: userMessage.created_at });

    // The mood and safety signal runs alongside the reply and is saved on its own,
    // so it is kept (and the safety card shows) even if the reply fails.
    // Until the model answers, the keyword check alone decides (an explicit statement is never missed).
    const keywordOnly = combineRisk(null, content);
    const latest: { signal: MessageSignal | null } = { signal: null };
    const signalPromise = analyzeMessage(content, recentText, { userId: user.id })
      .catch(() => null)
      .then(async (modelSignal) => {
        const risk = combineRisk(modelSignal?.risk, content);
        const signal: MessageSignal | null = modelSignal
          ? { ...modelSignal, risk }
          : risk !== "none"
            ? { mood: "unclear", emotions: [], risk }
            : null;
        latest.signal = signal;
        if (signal) {
          emit("signal", signal);
          await query("UPDATE messages SET meta = meta || $2::jsonb WHERE id = $1", [userMessage.id, { signal }]).catch(
            (err) => logAiError("signal-save", err),
          );
        }
        return signal;
      });

    const turn = newTurnResult();
    let replySaved = false;
    try {
      const userContext = await buildUserContext(user, { excludeConversationId: convo.id });
      await runCompanionTurn({
        userId: user.id,
        conversationId: convo.id,
        memoryEnabled,
        userContext,
        history,
        emit,
        result: turn,
        clientGone: () => clientGone,
      });
      const finalSignal = await withTimeout(signalPromise, SIGNAL_GRACE_MS);
      const risk: Risk = finalSignal?.risk ?? keywordOnly;
      applySafety(turn, risk, emit);

      const meta = {
        ...(turn.suggestions.length ? { suggestions: turn.suggestions } : {}),
        ...(turn.memories.length ? { memories: turn.memories } : {}),
        ...(turn.reminders.length ? { reminders: turn.reminders } : {}),
        ...(risk !== "none" ? { safety: risk } : {}),
      };
      const saved = await queryOne<{ id: string; created_at: string }>(
        "INSERT INTO messages (conversation_id, role, content, meta) VALUES ($1, 'assistant', $2, $3) RETURNING id, created_at",
        [convo.id, turn.text, meta],
      );
      replySaved = true;
      await query("UPDATE conversations SET updated_at = now() WHERE id = $1", [convo.id]);
      const xp = await awardDailyChatXp(user.id, user.timezone);
      emit("done", {
        message: { id: saved!.id, role: "assistant", content: turn.text, meta, createdAt: saved!.created_at },
        xp,
      });

      if (!convo.title && !clientGone) {
        const title = await generateTitle(content, turn.text, { userId: user.id });
        if (title) {
          await query("UPDATE conversations SET title = $2 WHERE id = $1 AND title IS NULL", [convo.id, title]);
          emit("title", { title });
        }
      }
    } catch (err) {
      if (!shutdownSignal.aborted) logAiError("chat", err);
      // The reply is already stored and was sent; something after it (XP, title) failed. Nothing more to do.
      if (replySaved) return;
      // Keep whatever Sol had already written, marked as unfinished, so the conversation reads sensibly.
      if (turn.text.trim()) {
        await query("INSERT INTO messages (conversation_id, role, content, meta) VALUES ($1, 'assistant', $2, $3)", [
          convo.id,
          turn.text,
          { incomplete: true, ...(latest.signal && latest.signal.risk !== "none" ? { safety: latest.signal.risk } : {}) },
        ]).catch((saveErr) => logAiError("chat-save", saveErr));
      }
      emit("error", {
        message: shutdownSignal.aborted
          ? "Sol is taking a short pause while the server restarts. Please try again in a moment."
          : "Sol couldn't reply just now. Please try again in a moment.",
      });
    }
  } finally {
    clearInterval(heartbeat);
    const left = (activeTurns.get(user.id) ?? 1) - 1;
    if (left > 0) activeTurns.set(user.id, left);
    else activeTurns.delete(user.id);
    openStreams.delete(res);
    if (res.headersSent && !res.writableEnded) res.end();
  }
});

/** The last messages of a conversation, oldest first, starting with a user message, within the size budget. */
async function loadHistory(conversationId: string) {
  const newestFirst = await query<{ role: "user" | "assistant"; content: string }>(
    "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2",
    [conversationId, HISTORY_MAX_MESSAGES],
  );
  const kept: { role: "user" | "assistant"; content: string }[] = [];
  let chars = 0;
  for (const m of newestFirst) {
    chars += m.content.length;
    if (kept.length > 0 && chars > HISTORY_MAX_CHARS) break;
    kept.push(m);
  }
  const rows = kept.reverse();
  while (rows.length && rows[0]!.role !== "user") rows.shift();

  // A failed turn can leave two user messages in a row: join them into one turn.
  const history: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of rows) {
    const last = history[history.length - 1];
    if (last && last.role === m.role && typeof last.content === "string") last.content += `\n\n${m.content}`;
    else history.push({ role: m.role, content: m.content });
  }
  const recentText = rows
    .slice(-7, -1)
    .map((m) => `${m.role === "user" ? "User" : "Sol"}: ${m.content.slice(0, 400)}`)
    .join("\n");
  return { history, recentText };
}

const CRISIS_SUGGESTION: Suggestion = { activity: "help_now", reason: "Support is here, right now, whenever you want it." };
const DECLINED_WITH_CARE =
  "I want to make sure you get the right support with this. You don't have to carry it alone: the help lines below are there right now, day or night. I'm still here with you too.";

/** Makes sure a reply to a message that sounds unsafe always points to real help. */
function applySafety(turn: ReturnType<typeof newTurnResult>, risk: Risk, emit: Emit) {
  if (risk === "none") return;
  if (turn.declined && turn.text === DECLINED_TEXT) {
    turn.text = DECLINED_WITH_CARE;
    emit("replace", { text: turn.text });
  }
  if ((risk === "crisis" || turn.declined) && !turn.suggestions.some((s) => s.activity === "help_now")) {
    turn.suggestions = [CRISIS_SUGGESTION, ...turn.suggestions].slice(0, 2);
    emit("suggestion", CRISIS_SUGGESTION);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
