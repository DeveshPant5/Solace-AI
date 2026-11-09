import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { config } from "../config.js";

/**
 * Gives every request an id (echoed as X-Request-Id and included in 500 bodies)
 * and logs one line when it finishes: method, path without the query string
 * (Pip's voice lines travel there), status, duration and the account id.
 * Bodies are never logged.
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const id = randomUUID();
  res.locals.requestId = id;
  res.setHeader("X-Request-Id", id);
  if (!config.logRequests) return next();
  const started = process.hrtime.bigint();
  res.on("close", () => {
    const path = req.originalUrl.split("?")[0];
    if (path === "/health" && res.statusCode === 200) return;
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const user = req.user ? ` user=${req.user.id}` : "";
    console.log(`${req.method} ${path} ${res.statusCode} ${ms.toFixed(0)}ms id=${id}${user}${res.writableFinished ? "" : " (closed early)"}`);
  });
  next();
};

/**
 * Response hardening. The API only ever returns JSON, event streams and audio,
 * so it can forbid everything a browser might otherwise do with a response.
 */
export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  // Responses carry tokens and personal data: never store them in shared or browser caches.
  // (Pip's audio clips set their own private caching.)
  res.setHeader("Cache-Control", "no-store");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
};
