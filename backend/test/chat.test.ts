// End-to-end tests for chat with Sol, against a small local stand-in for the
// Anthropic Messages API (the real SDK talks to it through ANTHROPIC_BASE_URL).
// Covers streaming, a tool call, the safety floor on a declined reply, and a
// reply that breaks off part way.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";

type Json = Record<string, any>;

// ---------- The stand-in Messages API ----------

function sse(res: http.ServerResponse, events: Json[], opts: { breakOff?: boolean } = {}) {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  for (const e of events) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
  // Let what was written reach the client, then cut the connection mid-reply.
  if (opts.breakOff) setTimeout(() => res.destroy(), 200);
  else res.end();
}

const start = (id: string): Json => ({
  type: "message_start",
  message: { id, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } },
});
const textBlock = (index: number, text: string): Json[] => [
  { type: "content_block_start", index, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index, delta: { type: "text_delta", text } },
  { type: "content_block_stop", index },
];
const toolBlock = (index: number, name: string, input: Json): Json[] => [
  { type: "content_block_start", index, content_block: { type: "tool_use", id: `toolu_${randomUUID().slice(0, 8)}`, name, input: {} } },
  { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(input) } },
  { type: "content_block_stop", index },
];
const finish = (stop_reason: string): Json[] => [
  { type: "message_delta", delta: { stop_reason, stop_sequence: null }, usage: { output_tokens: 12 } },
  { type: "message_stop" },
];

const lastUserText = (messages: Json[]) => {
  const userTurns = messages.filter((m) => m.role === "user" && typeof m.content === "string");
  // Two user messages in a row are merged into one turn; answer the newest part.
  return String(userTurns[userTurns.length - 1]?.content ?? "").split("\n\n").pop() ?? "";
};

const mock = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw) as Json;
    const system = JSON.stringify(body.system ?? "");
    if (!body.stream) {
      // Structured calls (messages.parse): answer with JSON text.
      const text = system.includes("estimate their current mood")
        ? // Pretend the classifier was talked out of flagging anything.
          { mood: "low", emotions: ["sad"], risk: "none" }
        : system.includes("You name conversations")
          ? { title: "A gentle hello" }
          : {};
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "msg_parse",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [{ type: "text", text: JSON.stringify(text) }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 5, output_tokens: 5 },
        }),
      );
      return;
    }
    const said = lastUserText(body.messages);
    const hasToolResult = body.messages.some((m: Json) => Array.isArray(m.content) && m.content.some((b: Json) => b.type === "tool_result"));
    if (said.includes("remind me")) {
      if (!hasToolResult) {
        return sse(res, [start("msg_t1"), ...textBlock(0, "Of course."), ...toolBlock(1, "create_reminder", { title: "Drink water\nnow", hour: 9, minute: 30 }), ...finish("tool_use")]);
      }
      return sse(res, [start("msg_t2"), ...textBlock(0, "I'll nudge you at 9:30."), ...finish("end_turn")]);
    }
    if (said.includes("want to die")) return sse(res, [start("msg_r"), ...finish("refusal")]);
    if (said.includes("break off")) return sse(res, [start("msg_b"), ...textBlock(0, "Let me think about")], { breakOff: true });
    return sse(res, [start("msg_h"), ...textBlock(0, "Hi there. How are you feeling today?"), ...finish("end_turn")]);
  });
});

// ---------- The API under test ----------

let base = "";
let server: http.Server;
let token = "";
let closePool: () => Promise<void>;

before(async () => {
  await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", () => resolve()));
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
  process.env.LOG_REQUESTS = "0";
  const { createApp } = await import("../src/app.js");
  const { migrate } = await import("../src/migrate.js");
  const { pool } = await import("../src/db.js");
  closePool = () => pool.end();
  await migrate();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Chat Test", email: `test-${randomUUID()}@test.local`, password: "password-123" }),
  });
  token = ((await r.json()) as Json).token;
});

after(async () => {
  await fetch(`${base}/me`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise<void>((resolve) => mock.close(() => resolve()));
  await closePool();
});

async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: r.status === 204 ? {} : ((await r.json()) as Json) };
}

/** Sends a chat message and collects the streamed events. */
async function chat(conversationId: string, content: string) {
  const r = await fetch(`${base}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content }),
  });
  assert.equal(r.status, 200);
  const text = await r.text();
  return text
    .split("\n\n")
    .filter((block) => block.startsWith("event:"))
    .map((block) => {
      const [eventLine, dataLine] = block.split("\n");
      return { event: eventLine!.slice(7), data: JSON.parse(dataLine!.slice(6)) as Json };
    });
}

describe("chat with Sol", () => {
  test("streams a reply, saves it, and names the conversation", async () => {
    const { json } = await api("/conversations", "POST");
    const events = await chat(json.conversation.id, "hello");
    const names = events.map((e) => e.event);
    assert.ok(names.includes("delta"));
    assert.ok(names.includes("signal"));
    const done = events.find((e) => e.event === "done")!;
    assert.equal(done.data.message.content, "Hi there. How are you feeling today?");
    assert.equal(events.find((e) => e.event === "title")?.data.title, "A gentle hello");
    const saved = await api(`/conversations/${json.conversation.id}`);
    assert.equal(saved.json.messages.length, 2);
    assert.equal(saved.json.messages[0].meta.signal.mood, "low");
  });

  test("a tool call creates a clean reminder and the reply continues", async () => {
    const { json } = await api("/conversations", "POST");
    const events = await chat(json.conversation.id, "please remind me to drink water");
    const reminder = events.find((e) => e.event === "reminder")!;
    assert.equal(reminder.data.title, "Drink water now");
    const done = events.find((e) => e.event === "done")!;
    assert.match(done.data.message.content, /Of course\.\n\nI'll nudge you at 9:30\./);
    const reminders = await api("/reminders");
    assert.ok(reminders.json.reminders.some((r: Json) => r.title === "Drink water now" && r.createdBy === "sol"));
  });

  test("a declined reply to a message about dying still points to help", async () => {
    const { json } = await api("/conversations", "POST");
    const events = await chat(json.conversation.id, "I want to die");
    // The keyword floor lifts the classifier's "none".
    assert.equal(events.find((e) => e.event === "signal")?.data.risk, "concern");
    const done = events.find((e) => e.event === "done")!;
    assert.match(done.data.message.content, /help lines/);
    assert.equal(done.data.message.meta.safety, "concern");
    assert.equal(done.data.message.meta.suggestions[0].activity, "help_now");
    const saved = await api(`/conversations/${json.conversation.id}`);
    assert.equal(saved.json.messages[0].meta.signal.risk, "concern");
  });

  test("a reply that breaks off keeps what was written and says so calmly", async () => {
    const { json } = await api("/conversations", "POST");
    const events = await chat(json.conversation.id, "please break off");
    const error = events.find((e) => e.event === "error");
    assert.ok(error, "an error event is sent");
    assert.match(error!.data.message, /couldn't reply just now/);
    const saved = await api(`/conversations/${json.conversation.id}`);
    const reply = saved.json.messages.find((m: Json) => m.role === "assistant");
    assert.equal(reply?.content, "Let me think about");
    assert.equal(reply?.meta.incomplete, true);
  });

  test("the next message after a failed one still works (history is merged)", async () => {
    const { json } = await api("/conversations", "POST");
    await chat(json.conversation.id, "please break off");
    const events = await chat(json.conversation.id, "hello again");
    assert.ok(events.some((e) => e.event === "done"));
  });
});
