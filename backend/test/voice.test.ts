// Pip's voice uses only the free characters the ElevenLabs plan includes, then
// hands over to the phone's voice. Runs against a local stand-in for ElevenLabs
// (ELEVENLABS_BASE_URL) with a throwaway clip cache.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

// The plan: 10,000 characters, 9,700 used, so 300 left (the server keeps 200 in reserve).
const plan = { character_count: 9_700, character_limit: 10_000, next_character_count_reset_unix: Math.floor(Date.now() / 1000) + 86_400 };
let ttsCalls = 0;

const mock = http.createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    if (req.url === "/v1/user/subscription") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(plan));
    }
    if (req.url?.startsWith("/v1/text-to-speech/")) {
      ttsCalls++;
      res.writeHead(200, { "Content-Type": "audio/mpeg" });
      return res.end(Buffer.alloc(2_000, 1));
    }
    res.writeHead(404).end();
  });
});

let base = "";
let server: http.Server;
let cacheDir = "";
let quotaError: (status: number, body: string) => string | null;
let closePool: () => Promise<void>;

before(async () => {
  await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", () => resolve()));
  cacheDir = await mkdtemp(path.join(os.tmpdir(), "solace-voice-test-"));
  process.env.ELEVENLABS_API_KEY = "test-key";
  process.env.ELEVENLABS_BASE_URL = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
  process.env.VOICE_CACHE_DIR = cacheDir;
  process.env.VOICE_DISABLED = "0";
  process.env.AI_DISABLED = "1";
  process.env.LOG_REQUESTS = "0";
  const { createApp } = await import("../src/app.js");
  ({ quotaError } = await import("../src/routes/voice.js"));
  const { pool } = await import("../src/db.js");
  closePool = () => pool.end();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise<void>((resolve) => mock.close(() => resolve()));
  await rm(cacheDir, { recursive: true, force: true });
  await closePool();
});

const speak = (text: string) => fetch(`${base}/voice/speak?text=${encodeURIComponent(text)}`);
const health = async () => (await (await fetch(`${base}/health`)).json()) as { voice: boolean };

describe("Pip's voice on free credits", () => {
  test("uses the natural voice while free characters remain", async () => {
    assert.equal((await health()).voice, true);
    const res = await speak("Hello there.");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "audio/mpeg");
    assert.equal(ttsCalls, 1);
  });

  test("a line it has spoken before is replayed from the cache for free", async () => {
    const res = await speak("Hello there.");
    assert.equal(res.status, 200);
    assert.equal(ttsCalls, 1);
  });

  test("stops before the plan's limit and reports voice off, so the app uses the phone's voice", async () => {
    // 300 - 12 = 288 left; this line would leave less than the 200-character reserve.
    const res = await speak("x".repeat(100));
    assert.equal(res.status, 503);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "voice_off");
    assert.equal(ttsCalls, 1, "ElevenLabs is not asked for a clip it would refuse or charge for");
    assert.equal((await health()).voice, false);
  });

  test("clips made earlier still play after the credits run out", async () => {
    const res = await speak("Hello there.");
    assert.equal(res.status, 200);
  });

  test("ElevenLabs' 'quota exceeded' and bad-key answers are recognised", () => {
    assert.match(quotaError(401, JSON.stringify({ detail: { status: "quota_exceeded", message: "insufficient quota" } }))!, /credits/);
    assert.match(quotaError(402, "{}")!, /paid plan/);
    assert.match(quotaError(401, JSON.stringify({ detail: { status: "invalid_api_key" } }))!, /key/);
    assert.equal(quotaError(429, JSON.stringify({ detail: { status: "too_many_concurrent_requests" } })), null);
    assert.equal(quotaError(500, "oops"), null);
  });
});
