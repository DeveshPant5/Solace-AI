import type { RequestHandler } from "express";
import { HttpError } from "../errors.js";

/**
 * Tiny in-memory fixed-window rate limiter keyed by `req.ip`. Each call makes
 * its own counter, so different routes don't share a budget. Fine for a single
 * process; use a shared store if the API ever runs on several instances.
 */
export function rateLimit({ limit, windowMs }: { limit: number; windowMs: number }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let nextSweep = Date.now() + windowMs;

  return (req, res, next) => {
    const now = Date.now();
    if (now >= nextSweep) {
      for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
      nextSweep = now + windowMs;
    }

    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      next(new HttpError(429, "Too many requests. Try again in a few minutes.", "rate_limited"));
      return;
    }
    next();
  };
}
