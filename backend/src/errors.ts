import type { ErrorRequestHandler, Request, RequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  /** Extra response headers, e.g. Retry-After on a 429. */
  headers?: Record<string, string>;

  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "Not found", "not_found"));
};

/** Postgres error code (e.g. 23505 unique violation), if this is a database error. */
export function pgCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : undefined;
}

/**
 * One log line for an unexpected error, without the parts that can carry
 * personal data (pg `detail`/`where` hold row values; SDK errors can hold model output).
 */
export function logError(err: unknown, req?: Request) {
  const e = (err ?? {}) as { name?: string; message?: string; code?: string; stack?: string };
  const where = req ? `${req.method} ${req.originalUrl.split("?")[0]} ` : "";
  const id = req?.res?.locals.requestId ? ` [${req.res.locals.requestId}]` : "";
  const message = String(e.message ?? err).split(" JSON:")[0]!.slice(0, 500);
  const stack = e.stack?.split("\n").slice(1, 6).join("\n") ?? "";
  console.error(`[error]${id} ${where}${e.name ?? "Error"}${e.code ? ` (${e.code})` : ""}: ${message}${stack ? `\n${stack}` : ""}`);
}

const FRAMEWORK_MESSAGES: Record<number, string> = {
  413: "That's a bit too much to send at once. Please shorten it and try again.",
  415: "That request format isn't supported.",
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    // Part of the response (e.g. a chat stream) is already out: log it and close cleanly.
    logError(err, req);
    if (!res.writableEnded) res.end();
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.join(".") || "request";
    res.status(400).json({ error: { code: "invalid_input", message: `${field}: ${first?.message ?? "invalid"}` } });
    return;
  }
  if (err instanceof HttpError) {
    if (err.headers) res.set(err.headers);
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "invalid_json", message: "Request body is not valid JSON" } });
    return;
  }
  if (pgCode(err) === "23505") {
    res.status(409).json({ error: { code: "conflict", message: "That already exists." } });
    return;
  }
  // Body-parser and router errors carry their own 4xx status (413 too large, 415 bad encoding, 400 bad URL).
  const status = typeof err?.status === "number" ? err.status : typeof err?.statusCode === "number" ? err.statusCode : 0;
  if (status >= 400 && status < 500) {
    const code = typeof err?.type === "string" ? err.type.replace(/\W+/g, "_") : "bad_request";
    res.status(status).json({ error: { code, message: FRAMEWORK_MESSAGES[status] ?? "That request couldn't be read." } });
    return;
  }
  logError(err, req);
  res.status(500).json({
    error: { code: "server_error", message: "Something went wrong on our side", requestId: res.locals.requestId },
  });
};
