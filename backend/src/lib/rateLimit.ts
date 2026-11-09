import { isIP } from "node:net";
import type { Request, RequestHandler } from "express";
import { HttpError } from "../errors.js";

/**
 * Tiny in-memory fixed-window counters. Each limiter has its own budget. Fine
 * for a single process; use a shared store if the API ever runs on several
 * instances.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private nextSweep: number;

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    /** Hard cap on tracked keys, so a flood of new keys can't grow memory without bound. */
    private readonly maxKeys = 50_000,
  ) {
    this.nextSweep = Date.now() + windowMs;
  }

  private entry(key: string, create: boolean) {
    const now = Date.now();
    if (now >= this.nextSweep || this.hits.size >= this.maxKeys) this.sweep(now);
    let entry = this.hits.get(key);
    if (entry && entry.resetAt <= now) {
      this.hits.delete(key);
      entry = undefined;
    }
    if (!entry && create) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
    }
    return entry;
  }

  private sweep(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
    // Still full: drop the oldest keys (a Map keeps insertion order).
    while (this.hits.size >= this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
    this.nextSweep = now + this.windowMs;
  }

  /** True when the key has used up its budget (does not count a hit). */
  isLimited(key: string): boolean {
    return (this.entry(key, false)?.count ?? 0) >= this.limit;
  }

  /** Counts one hit. Returns false (and doesn't count) once the budget is used up. */
  take(key: string): boolean {
    const entry = this.entry(key, true)!;
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }

  /** Counts one hit even past the limit (for counting failures). */
  hit(key: string) {
    this.entry(key, true)!.count += 1;
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  /** Seconds until the key's window ends. */
  retryAfter(key: string): number {
    const entry = this.entry(key, false);
    return entry ? Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)) : 1;
  }
}

/**
 * The client's address. `req.ip` honours the `trust proxy` setting (see
 * TRUST_PROXY); anything that isn't a real IP falls back to the socket address.
 */
export function clientIp(req: Request): string {
  const ip = req.ip ?? "";
  if (isIP(ip)) return ip;
  return req.socket.remoteAddress ?? "unknown";
}

export const TOO_MANY = "Let's pause for a moment. There were a lot of requests in a short time, so please try again in a few minutes.";

export function tooMany(retryAfterSeconds: number, message = TOO_MANY) {
  const err = new HttpError(429, message, "rate_limited");
  err.headers = { "Retry-After": String(retryAfterSeconds) };
  return err;
}

/**
 * Express middleware. Keys on the client IP by default; pass `key` to key on
 * something else (return null to skip limiting for that request).
 */
export function rateLimit(opts: {
  limit: number;
  windowMs: number;
  key?: (req: Request) => string | null;
  message?: string;
}): RequestHandler {
  const limiter = new RateLimiter(opts.limit, opts.windowMs);
  return (req, _res, next) => {
    const key = opts.key ? opts.key(req) : clientIp(req);
    if (key === null || limiter.take(key)) return next();
    next(tooMany(limiter.retryAfter(key), opts.message));
  };
}

/** Per-person limiter for routes behind requireAuth. */
export function userRateLimit(opts: { limit: number; windowMs: number; message?: string }): RequestHandler {
  return rateLimit({ ...opts, key: (req) => (req.user ? `user:${req.user.id}` : clientIp(req)) });
}
