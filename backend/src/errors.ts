import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
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

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.join(".") || "request";
    res.status(400).json({ error: { code: "invalid_input", message: `${field}: ${first?.message ?? "invalid"}` } });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "invalid_json", message: "Request body is not valid JSON" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "server_error", message: "Something went wrong on our side" } });
};
