import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { queryOne } from "./db.js";
import { HttpError } from "./errors.js";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  timezone: string;
  profile: Record<string, unknown>;
  preferences: { tone?: string; memoryEnabled?: boolean } & Record<string, unknown>;
  created_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export const USER_COLUMNS = "id, email, name, timezone, profile, preferences, created_at";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new HttpError(401, "Please sign in", "unauthorized"));
  let userId: string;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "string" || typeof payload.sub !== "string") throw new Error("bad token");
    userId = payload.sub;
  } catch {
    return next(new HttpError(401, "Your session has expired. Please sign in again.", "unauthorized"));
  }
  const user = await queryOne<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
  if (!user) return next(new HttpError(401, "Account not found", "unauthorized"));
  req.user = user;
  next();
}

/** The signed-in user. Only call inside routes mounted behind requireAuth. */
export function currentUser(req: Request): UserRow {
  if (!req.user) throw new HttpError(401, "Please sign in", "unauthorized");
  return req.user;
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    profile: user.profile,
    preferences: user.preferences,
    createdAt: user.created_at,
  };
}

/** Accepts only real IANA zone names so they are safe to pass to Postgres. */
export function safeTimezone(tz: unknown): string | undefined {
  if (typeof tz !== "string" || tz.length > 64) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}
