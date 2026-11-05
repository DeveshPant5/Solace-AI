import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";
import { Router, type Response as ExpressResponse } from "express";
import { z } from "zod";
import { config, voiceEnabled } from "../config.js";
import { HttpError } from "../errors.js";
import { rateLimit } from "../lib/rateLimit.js";

// Pip's spoken lines, via ElevenLabs text to speech. Public: onboarding runs before sign-up.
// Audio is cached on disk forever, keyed by everything that changes the sound.

export const voiceRouter = Router();

const CACHE_DIR = fileURLToPath(new URL("../../.cache/voice/", import.meta.url));
const ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const OUTPUT_FORMAT = "mp3_44100_64";
// Calm and warm: steadier than default, very little added style, and a touch slower than normal speech.
const VOICE_SETTINGS = { stability: 0.6, similarity_boost: 0.75, style: 0.05, use_speaker_boost: true, speed: 0.92 };
const UPSTREAM_TIMEOUT_MS = 30_000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const SpeakQuery = z.object({ text: z.string().trim().min(1).max(300) });

voiceRouter.get("/speak", rateLimit({ limit: 80, windowMs: 10 * 60_000 }), async (req, res) => {
  const { text } = SpeakQuery.parse(req.query);
  if (!voiceEnabled) throw new HttpError(503, "Pip's voice isn't set up on this server", "voice_off");

  await ensureCacheDir();
  const fileName = `${cacheKey(text)}.mp3`;
  if (await isCached(fileName)) return sendCached(res, fileName);

  // If the client goes away, stop the ElevenLabs request too.
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  const upstream = await synthesize(text, abort.signal);
  if (!upstream) return; // client already gone

  const source = Readable.fromWeb(upstream.body as NodeReadableStream<Uint8Array>);
  const finalPath = path.join(CACHE_DIR, fileName);
  const tmpPath = path.join(CACHE_DIR, `${fileName}.${randomUUID()}.tmp`);
  const file = createWriteStream(tmpPath);
  let fileOk = true;
  file.on("error", () => {
    fileOk = false; // the audio still reaches the client; it just isn't cached
  });

  // Safari and iOS probe with a byte range (e.g. bytes=0-1) and need a 206 answer,
  // so for those, download the whole clip first and serve it from the cache.
  const range = req.headers.range?.trim();
  if (range && range !== "bytes=0-") {
    try {
      await pipeline(source, file);
      if (file.bytesWritten === 0) throw new Error("ElevenLabs sent no audio");
      await rename(tmpPath, finalPath);
    } catch (err) {
      file.destroy();
      await rm(tmpPath, { force: true }).catch(() => {});
      if (abort.signal.aborted) return;
      console.error(`[voice] ElevenLabs stream failed: ${errorText(err)}`);
      throw voiceFailed();
    }
    return sendCached(res, fileName);
  }

  // Everyone else: stream to the client while writing the cache file alongside.
  let bytes = 0;
  const tee = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      bytes += chunk.length;
      if (fileOk) file.write(chunk);
      done(null, chunk);
    },
  });
  res.status(200);
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  const length = upstream.headers.get("content-length");
  if (length && !upstream.headers.get("content-encoding")) res.setHeader("Content-Length", length);

  try {
    await pipeline(source, tee, res);
  } catch (err) {
    // Client hung up, or ElevenLabs broke off mid-clip. Headers are already sent, so just close.
    file.destroy();
    await rm(tmpPath, { force: true }).catch(() => {});
    const clientLeft = (err as { code?: string } | null)?.code === "ERR_STREAM_PREMATURE_CLOSE";
    if (!clientLeft) console.error(`[voice] ElevenLabs stream failed: ${errorText(err)}`);
    if (!res.writableEnded) res.destroy();
    return;
  }

  // The clip arrived in full: keep it.
  try {
    file.end();
    await finished(file);
    if (!fileOk || bytes === 0) throw new Error("nothing to cache");
    await rename(tmpPath, finalPath);
  } catch (err) {
    file.destroy();
    await rm(tmpPath, { force: true }).catch(() => {});
    console.warn(`[voice] could not cache clip: ${errorText(err)}`);
  }
});

// ---------- Helpers ----------

let cacheDirReady: Promise<unknown> | null = null;
function ensureCacheDir() {
  cacheDirReady ??= mkdir(CACHE_DIR, { recursive: true }).catch((err) => {
    cacheDirReady = null;
    throw err;
  });
  return cacheDirReady;
}

function cacheKey(text: string) {
  const settings = JSON.stringify({ format: OUTPUT_FORMAT, ...VOICE_SETTINGS });
  return createHash("sha256").update([config.pipVoiceId, config.elevenLabsModel, settings, text].join("|")).digest("hex");
}

async function isCached(fileName: string) {
  const info = await stat(path.join(CACHE_DIR, fileName)).catch(() => null);
  return Boolean(info?.isFile() && info.size > 0);
}

/** Serves a cached clip (with range support, which Safari needs). */
function sendCached(res: ExpressResponse, fileName: string) {
  return new Promise<void>((resolve, reject) => {
    res.sendFile(
      fileName,
      { root: CACHE_DIR, maxAge: ONE_YEAR_MS, immutable: true, headers: { "Content-Type": "audio/mpeg" } },
      (err?: Error & { code?: string }) => {
        // A client that hangs up mid-clip is normal for audio.
        if (!err || res.headersSent || err.code === "ECONNABORTED") resolve();
        else reject(err);
      },
    );
  });
}

/** Starts the ElevenLabs stream. Returns null if the client left; throws a 502 if ElevenLabs fails. */
async function synthesize(text: string, clientGone: AbortSignal) {
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(`${ELEVENLABS_URL}/${encodeURIComponent(config.pipVoiceId)}/stream?output_format=${OUTPUT_FORMAT}`, {
      method: "POST",
      headers: { "xi-api-key": config.elevenLabsApiKey ?? "", "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: config.elevenLabsModel, voice_settings: VOICE_SETTINGS }),
      signal: AbortSignal.any([clientGone, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
    });
  } catch (err) {
    if (clientGone.aborted) return null;
    console.error(`[voice] ElevenLabs request failed: ${errorText(err)}`);
    throw voiceFailed();
  }

  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !upstream.body || /json|^text\//.test(type)) {
    const detail = await upstream.text().catch(() => "");
    console.error(`[voice] ElevenLabs answered ${upstream.status}: ${upstreamMessage(detail)}`);
    throw voiceFailed();
  }
  return upstream;
}

const voiceFailed = () => new HttpError(502, "Pip's voice is unavailable right now", "voice_failed");

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
