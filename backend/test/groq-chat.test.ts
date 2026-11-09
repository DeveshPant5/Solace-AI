// End-to-end tests for Sol on Groq, against a small local stand-in for Groq's
// OpenAI-style chat completions API (the real SDK talks to it through GROQ_BASE_URL).
// Covers streaming, structured JSON calls, tool calls with and without a written
// reply, and the free tier's rate limits.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, test } from "node:test";

type Json = Record<string, any>;

// ---------- The stand-in Groq API ----------

const requests: Json[] = [];

const chunk = (delta: Json, finish: string | null = null, extra: Json = {}) => ({
  id: "chatcmpl-test",
  object: "chat.completion.chunk",
  created: 0,
  model: "openai/gpt-oss-120b",
  choices: [{ index: 0, delta, finish_reason: finish }],
  ...extra,
});
const done = (finish: string) => chunk({}, finish, { x_groq: { id: "req_test", usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } } });
const toolCall = (name: string, args: Json) => [
  chunk({ tool_calls: [{ index: 0, id: `call_${randomUUID().slice(0, 6)}`, type: "function", function: { name, arguments: "" } }] }),
  chunk({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(args).slice(0, 10) } }] }),
  chunk({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(args).slice(10) } }] }),
];

function stream(res: http.ServerResponse, chunks: Json[]) {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`);
  res.end("data: [DONE]\n\n");
}

function rateLimited(res: http.ServerResponse, retryAfter: string, requestsLeft: string) {
  res.writeHead(429, {
    "Content-Type": "application/json",
    "retry-after": retryAfter,
    "x-ratelimit-remaining-requests": requestsLeft,
  });
  res.end(JSON.stringify({ error: { message: "Rate limit reached", type: "tokens", code: "rate_limit_exceeded" } }));
}

const lastUser = (messages: Json[]) => {
  const users = messages.filter((m) => m.role === "user");
  return String(users[users.length - 1]?.content ?? "").split("\n\n").pop() ?? "";
};

const mock = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw) as Json;
    requests.push(body);
    const everything = JSON.stringify(body.messages);
    if (everything.includes("daily limit please")) return rateLimited(res, "3600", "0");
    if (everything.includes("busy minute please")) return rateLimited(res, "1", "500");

    if (!body.stream) {
      const system = String(body.messages[0]?.content ?? "");
      const json = system.includes("estimate their current mood")
        ? { mood: "low", emotions: ["Tired", "anxious"], risk: "none" }
        : system.includes("You name conversations")
          ? { title: "A quiet check in" }
          : {};
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "chatcmpl-json",
          object: "chat.completion",
          created: 0,
          model: body.model,
          choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(json) }, finish_reason: "stop" }],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        }),
      );
      return;
    }

    const said = lastUser(body.messages);
    const hasToolResult = body.messages.some((m: Json) => m.role === "tool");
    if (said.includes("remind me")) {
      // Writes the reply first, then calls the tool.
      return stream(res, [chunk({ role: "assistant", content: "Of course, " }), chunk({ content: "9:30 it is." }), ...toolCall("create_reminder", { title: "Stretch", hour: 9, minute: 30 }), done("tool_calls")]);
    }
    if (said.includes("save this")) {
      // Calls the tool before writing anything, so a second round is needed for the reply.
      if (!hasToolResult) return stream(res, [...toolCall("remember", { fact: "Has a sister called Mira.", category: "people" }), done("tool_calls")]);
      return stream(res, [chunk({ content: "Mira sounds important to you." }), done("stop")]);
    }
    return stream(res, [chunk({ role: "assistant", content: "Hi there. " }), chunk({ content: "How are you feeling today?" }), done("stop")]);
  });
});

// ---------- The API under test ----------

let base = "";
let server: http.Server;
let token = "";
let closePool: () => Promise<void>;

before(async () => {
  await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", () => resolve()));
  process.env.AI_PROVIDER = "groq";
  process.env.GROQ_API_KEY = "test-key";
  process.env.GROQ_BASE_URL = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
  process.env.AI_DISABLED = "0";
  process.env.VOICE_DISABLED = "1";
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
    body: JSON.stringify({ name: "Groq Test", email: `test-${randomUUID()}@test.local`, password: "password-123" }),
  });
  token = ((await r.json()) as Json).token;
});

beforeEach(() => {
  requests.length = 0;
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

const chatRequests = () => requests.filter((r) => r.stream);
const jsonRequests = () => requests.filter((r) => !r.stream);

describe("chat with Sol (Groq)", () => {
  test("streams a reply with the chat model and runs the JSON jobs on the fast model", async () => {
    const { json } = await api("/conversations", "POST");
    const events = await chat(json.conversation.id, "hello");
    const reply = events.find((e) => e.event === "done")!;
    assert.equal(reply.data.message.content, "Hi there. How are you feeling today?");
    assert.equal(events.find((e) => e.event === "title")?.data.title, "A quiet check in");
    assert.deepEqual(events.find((e) => e.event === "signal")?.data.emotions, ["tired", "anxious"]);

    const [chatRequest] = chatRequests();
    assert.equal(chatRequest!.model, "openai/gpt-oss-120b");
    assert.equal(chatRequest!.reasoning_effort, "low");
    assert.equal(chatRequest!.include_reasoning, false);
    assert.equal(chatRequest!.messages[0].role, "system");
    assert.match(chatRequest!.messages[0].content, /You are Sol/);
    assert.match(chatRequest!.messages[0].content, /<person_context>/);
    assert.ok(chatRequest!.tools.some((t: Json) => t.type === "function" && t.function.name === "create_reminder"));
    assert.ok(chatRequest!.messages.every((m: Json) => !("name" in m)), "Groq rejects messages[].name");

    for (const r of jsonRequests()) {
      assert.equal(r.model, "openai/gpt-oss-20b");
      assert.equal(r.response_format.type, "json_schema");
      assert.equal(r.response_format.json_schema.strict, true);
      assert.equal(r.response_format.json_schema.schema.additionalProperties, false);
      assert.equal("$schema" in r.response_format.json_schema.schema, false);
    }
  });

  test("a reply written before a tool call isn't followed by a second request", async () => {
    const { json } = await api("/conversations", "POST");
    const events = await chat(json.conversation.id, "please remind me to stretch");
    assert.equal(events.find((e) => e.event === "reminder")?.data.title, "Stretch");
    assert.equal(events.find((e) => e.event === "done")?.data.message.content, "Of course, 9:30 it is.");
    assert.equal(chatRequests().length, 1);
  });

  test("a tool call with no reply yet gets its result back and a second round", async () => {
    const { json } = await api("/conversations", "POST");
    const events = await chat(json.conversation.id, "save this: my sister is Mira");
    assert.equal(events.find((e) => e.event === "memory")?.data.content, "Has a sister called Mira.");
    assert.equal(events.find((e) => e.event === "done")?.data.message.content, "Mira sounds important to you.");
    const calls = chatRequests();
    assert.equal(calls.length, 2);
    const second = calls[1]!.messages as Json[];
    const assistant = second.find((m) => m.role === "assistant" && m.tool_calls);
    const tool = second.find((m) => m.role === "tool");
    assert.ok(assistant && tool);
    assert.equal(tool.tool_call_id, assistant.tool_calls[0].id);
    assert.equal(tool.content, "Saved.");
  });

  test("a used-up daily allowance gets a calm 'resting' message", async () => {
    const { json } = await api("/conversations", "POST");
    const events = await chat(json.conversation.id, "daily limit please");
    assert.match(events.find((e) => e.event === "error")?.data.message ?? "", /resting for today/);
  });

  test("a busy minute asks the person to try again shortly", async () => {
    const { json } = await api("/conversations", "POST");
    const events = await chat(json.conversation.id, "busy minute please");
    assert.match(events.find((e) => e.event === "error")?.data.message ?? "", /try again in a minute/);
  });

  test("a check-in reply falls back to offline content when Groq is rate limited", async () => {
    const r = await api("/moods", "POST", { mood: 2, note: "daily limit please" });
    assert.equal(r.status, 201);
    assert.match(r.json.reply.message, /heavy one/);
  });
});
