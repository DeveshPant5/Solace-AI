import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, utimes } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";
import { Router, type Response as ExpressResponse } from "express";
import { z } from "zod";
import { config, voiceEnabled } from "../config.js";
import { HttpError } from "../errors.js";
import { recordVoice, voiceAllowed } from "../lib/budget.js";
import { clientIp, rateLimit, RateLimiter, tooMany } from "../lib/rateLimit.js";

// Pip's spoken lines, via ElevenLabs text to speech. Public: onboarding runs before sign-up.
// Clips are cached on disk (keyed by everything that changes the sound), up to
// VOICE_CACHE_MAX_MB; the least recently played clips are removed past that.
//
// Cost controls, in order: cached clips are free; new clips are limited per
// address, de-duplicated while in flight, capped in concurrency, counted
// against a daily character budget, and only made while the ElevenLabs plan
// still has included (free) characters left. Whenever a clip can't be made,
// the app falls back to the phone's own voice.

export const voiceRouter = Router();

const CACHE_DIR = config.voiceCacheDir ?? fileURLToPath(new URL("../../.cache/voice/", import.meta.url));
const ELEVENLABS_API = config.elevenLabsBaseUrl.replace(/\/$/, "");
const ELEVENLABS_URL = `${ELEVENLABS_API}/v1/text-to-speech`;
const OUTPUT_FORMAT = "mp3_44100_64";
// Calm and gentle: steady (little swing in pitch or energy), no added style, and a little slower than normal speech.
const VOICE_SETTINGS = { stability: 0.72, similarity_boost: 0.7, style: 0, use_speaker_boost: true, speed: 0.9 };
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_CONCURRENT_SYNTHESES = 4;

const SpeakQuery = z.object({ text: z.string().trim().min(1).max(300) });

/** New (uncached) clips per address: a full onboarding pass needs about 20. */
const newClipLimiter = new RateLimiter(40, 10 * 60_000);

voiceRouter.get("/speak", rateLimit({ limit: 300, windowMs: 10 * 60_000 }), async (req, res) => {
  const { text } = SpeakQuery.parse(req.query);
  if (!voiceEnabled) throw new HttpError(503, "Pip's voice isn't set up on this server", "voice_off");

  const fileName = `${cacheKey(text)}.mp3`;
  const cacheOk = await cache.ready();
  // Clips made earlier cost nothing to replay, even after the free credits run out.
  if (cacheOk && (await cache.has(fileName))) return sendCached(res, fileName);

  if (!voiceAvailable()) throw restingVoice();
  const key = clientIp(req);
  if (!newClipLimiter.take(key)) throw tooMany(newClipLimiter.retryAfter(key));
  if (!(await hasFreeCredits(text.length))) throw restingVoice();

  if (cacheOk) {
    // Requests for the same new line share one ElevenLabs call.
    await synthesizeOnce(text, fileName);
    return sendCached(res, fileName);
  }
  // No usable cache directory: stream straight through without keeping a copy.
  await withSlot(async () => {
    const upstream = await synthesize(text);
    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, no-store");
    await pipeline(Readable.fromWeb(upstream.body as NodeReadableStream<Uint8Array>), res).catch((err) => {
      if ((err as { code?: string } | null)?.code !== "ERR_STREAM_PREMATURE_CLOSE") {
        console.error(`[voice] ElevenLabs stream failed: ${errorText(err)}`);
      }
      if (!res.writableEnded) res.destroy();
    });
  });
});

// ---------- Synthesis ----------

const inFlight = new Map<string, Promise<void>>();
let activeSyntheses = 0;

function synthesizeOnce(text: string, fileName: string): Promise<void> {
  const existing = inFlight.get(fileName);
  if (existing) return existing;
  const work = synthesizeToCache(text, fileName).finally(() => inFlight.delete(fileName));
  inFlight.set(fileName, work);
  return work;
}

/** Runs one ElevenLabs download, within the concurrency cap. */
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeSyntheses >= MAX_CONCURRENT_SYNTHESES) throw new HttpError(503, "Pip's voice is busy right now", "voice_busy");
  activeSyntheses++;
  try {
    return await fn();
  } finally {
    activeSyntheses--;
  }
}

function synthesizeToCache(text: string, fileName: string) {
  return withSlot(async () => {
    const upstream = await synthesize(text);
    const finalPath = path.join(CACHE_DIR, fileName);
    const tmpPath = path.join(CACHE_DIR, `${fileName}.${randomUUID()}.tmp`);
    try {
      const file = createWriteStream(tmpPath);
      await pipeline(Readable.fromWeb(upstream.body as NodeReadableStream<Uint8Array>), file);
      if (file.bytesWritten === 0) throw new Error("ElevenLabs sent no audio");
      await rename(tmpPath, finalPath);
      await cache.added(file.bytesWritten);
    } catch (err) {
      await rm(tmpPath, { force: true }).catch(() => undefined);
      console.error(`[voice] ElevenLabs stream failed: ${errorText(err)}`);
      throw voiceFailed();
    }
  });
}

/** Starts the ElevenLabs stream within today's budget. Throws a 503/502 the app treats as "use the phone's voice". */
async function synthesize(text: string) {
  if (!voiceAllowed(text.length)) throw new HttpError(503, "Pip's voice is resting for today", "voice_off");
  recordVoice(text.length);
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(`${ELEVENLABS_URL}/${encodeURIComponent(config.pipVoiceId)}/stream?output_format=${OUTPUT_FORMAT}`, {
      method: "POST",
      headers: { "xi-api-key": config.elevenLabsApiKey ?? "", "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: config.elevenLabsModel, voice_settings: VOICE_SETTINGS }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[voice] ElevenLabs request failed: ${errorText(err)}`);
    throw voiceFailed();
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !upstream.body || /json|^text\//.test(type)) {
    const detail = await upstream.text().catch(() => "");
    console.error(`[voice] ElevenLabs answered ${upstream.status}: ${upstreamMessage(detail)}`);
    const quotaProblem = quotaError(upstream.status, detail);
    if (quotaProblem) {
      credits.remaining = 0;
      pauseVoice(quotaProblem);
      throw restingVoice();
    }
    throw voiceFailed();
  }
  credits.remaining = credits.remaining === null ? null : credits.remaining - text.length;
  return { body: upstream.body };
}

const voiceFailed = () => new HttpError(502, "Pip's voice is unavailable right now", "voice_failed");
const restingVoice = () => new HttpError(503, "Pip's voice is resting for now", "voice_off");

// ---------- Free credits only ----------
//
// Pip only uses the characters the ElevenLabs plan already includes, so a free
// account never costs anything: before a new clip the server checks how many
// characters are left (from ElevenLabs, at most hourly, counting locally in
// between) and stops a little before the limit. A "quota exceeded" answer stops
// it too. While paused, /health reports voice off and the app uses the phone's
// voice; the natural voice comes back by itself when the monthly credits reset.

const CREDITS_RECHECK_MS = 60 * 60_000;
/** Stop this many characters before the plan's limit. */
const CREDITS_RESERVE = 200;
const credits = { remaining: null as number | null, checkedAt: 0, resetAt: 0, pausedUntil: 0 };

/** Whether Pip's natural voice is on right now (set up, and not paused for credits). */
export function voiceAvailable(): boolean {
  return voiceEnabled && Date.now() >= credits.pausedUntil;
}

function pauseVoice(reason: string) {
  const now = Date.now();
  if (now < credits.pausedUntil) return;
  // Check again in an hour (or at the reset, if that's sooner), in case credits renewed or the plan changed.
  const until = credits.resetAt > now ? Math.min(credits.resetAt, now + CREDITS_RECHECK_MS) : now + CREDITS_RECHECK_MS;
  credits.pausedUntil = until;
  credits.checkedAt = 0; // re-read the balance when the pause ends
  console.warn(`[voice] ${reason}; Pip uses the phone's voice until ${new Date(until).toISOString()}`);
}

/** Reads the plan's remaining characters from ElevenLabs. Failures are ignored (the quota error check still applies). */
async function refreshCredits() {
  credits.checkedAt = Date.now();
  try {
    const res = await fetch(`${ELEVENLABS_API}/v1/user/subscription`, {
      headers: { "xi-api-key": config.elevenLabsApiKey ?? "" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return;
    const plan = (await res.json()) as { character_count?: unknown; character_limit?: unknown; next_character_count_reset_unix?: unknown };
    if (typeof plan.character_count === "number" && typeof plan.character_limit === "number") {
      credits.remaining = plan.character_limit - plan.character_count;
    }
    credits.resetAt = typeof plan.next_character_count_reset_unix === "number" ? plan.next_character_count_reset_unix * 1000 : 0;
  } catch {
    // Unreachable or no permission to read the plan: rely on ElevenLabs' own quota answer.
  }
}

/** True if a clip of `chars` characters fits in the plan's remaining free characters. */
async function hasFreeCredits(chars: number): Promise<boolean> {
  if (Date.now() - credits.checkedAt > CREDITS_RECHECK_MS) await refreshCredits();
  if (credits.remaining !== null && credits.remaining - chars < CREDITS_RESERVE) {
    pauseVoice("ElevenLabs free credits are used up");
    return false;
  }
  return true;
}

/** If an ElevenLabs error means "no credits left" (or the key is unusable), the reason; otherwise null. */
export function quotaError(status: number, body: string): string | null {
  let code = "";
  try {
    const detail = (JSON.parse(body) as { detail?: { status?: unknown } }).detail;
    code = typeof detail?.status === "string" ? detail.status : "";
  } catch {
    // not JSON
  }
  if (code === "quota_exceeded" || /quota/i.test(code)) return "ElevenLabs free credits are used up";
  if (status === 402 || code === "payment_required") return "ElevenLabs needs a paid plan for this request";
  if (code === "invalid_api_key" || (status === 401 && !code)) return "ElevenLabs rejected the API key";
  return null;
}

// Learn the balance at startup, so /health is right from the first request.
if (voiceEnabled) {
  void refreshCredits().then(() => {
    if (credits.remaining !== null && credits.remaining < CREDITS_RESERVE) pauseVoice("ElevenLabs free credits are used up");
  });
}

// ---------- Disk cache ----------

const cache = (() => {
  let readyPromise: Promise<boolean> | null = null;
  let totalBytes = 0;
  const maxBytes = config.voiceCacheMaxMb * 1024 * 1024;

  async function init(): Promise<boolean> {
    try {
      await mkdir(CACHE_DIR, { recursive: true });
      for (const name of await readdir(CACHE_DIR)) {
        const full = path.join(CACHE_DIR, name);
        // Leftovers from a crash mid-download.
        if (name.endsWith(".tmp")) await rm(full, { force: true });
        else if (name.endsWith(".mp3")) totalBytes += (await stat(full).catch(() => null))?.size ?? 0;
      }
      return true;
    } catch (err) {
      console.warn(`[voice] clip cache disabled: ${errorText(err)}`);
      return false;
    }
  }

  /** Removes the least recently played clips until the cache is back under 80% of its cap. */
  async function evict() {
    const files = await Promise.all(
      (await readdir(CACHE_DIR))
        .filter((n) => n.endsWith(".mp3"))
        .map(async (name) => ({ name, info: await stat(path.join(CACHE_DIR, name)).catch(() => null) })),
    );
    const clips = files.filter((f) => f.info).sort((a, b) => a.info!.mtimeMs - b.info!.mtimeMs);
    totalBytes = clips.reduce((sum, f) => sum + f.info!.size, 0);
    for (const clip of clips) {
      if (totalBytes <= maxBytes * 0.8) break;
      await rm(path.join(CACHE_DIR, clip.name), { force: true }).catch(() => undefined);
      totalBytes -= clip.info!.size;
    }
  }

  return {
    ready() {
      readyPromise ??= init();
      return readyPromise;
    },
    async has(fileName: string) {
      const full = path.join(CACHE_DIR, fileName);
      const info = await stat(full).catch(() => null);
      if (!info?.isFile() || info.size === 0) return false;
      // Mark as recently played, for eviction.
      const now = new Date();
      await utimes(full, now, now).catch(() => undefined);
      return true;
    },
    async added(bytes: number) {
      totalBytes += bytes;
      if (totalBytes > maxBytes) await evict().catch((err) => console.warn(`[voice] cache cleanup failed: ${errorText(err)}`));
    },
  };
})();

function cacheKey(text: string) {
  const settings = JSON.stringify({ format: OUTPUT_FORMAT, ...VOICE_SETTINGS });
  return createHash("sha256").update([config.pipVoiceId, config.elevenLabsModel, settings, text].join("|")).digest("hex");
}

/** Serves a cached clip (with range support, which Safari needs). Private: lines can include the person's name. */
function sendCached(res: ExpressResponse, fileName: string) {
  // Replaces the default no-store: a clip never changes for a given URL.
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  return new Promise<void>((resolve, reject) => {
    res.sendFile(
      fileName,
      { root: CACHE_DIR, cacheControl: false, headers: { "Content-Type": "audio/mpeg" } },
      (err?: Error & { code?: string }) => {
        // A client that hangs up mid-clip is normal for audio.
        if (!err || res.headersSent || err.code === "ECONNABORTED") resolve();
        else reject(err);
      },
    );
  });
}

/** A short, safe summary of an ElevenLabs error body, e.g. {"detail":{"status":"...","message":"..."}}. */
function upstreamMessage(body: string) {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown; message?: unknown };
    const detail = parsed.detail as { status?: unknown; message?: unknown } | string | undefined;
    const message =
      typeof detail === "string"
        ? detail
        : [detail?.status, detail?.message ?? parsed.message].filter((v) => typeof v === "string").join(": ");
    if (message) return message.slice(0, 200);
  } catch {
    // not JSON
  }
  return body.replace(/\s+/g, " ").slice(0, 200) || "(no body)";
}

function errorText(err: unknown) {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
