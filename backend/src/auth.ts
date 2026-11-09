import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { query, queryOne } from "./db.js";
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

const JWT_OPTIONS = { algorithm: "HS256", issuer: "solace-api" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `ver` is the account's token version: signing out or changing the password
 * bumps it, which revokes every token issued before.
 */
export function signToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, ver: tokenVersion }, config.jwtSecret, { ...JWT_OPTIONS, expiresIn: config.jwtExpiresIn });
}

export const USER_COLUMNS = "id, email, name, timezone, profile, preferences, created_at";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return next(new HttpError(401, "Please sign in", "unauthorized"));
  let userId: string;
  let version: number;
  try {
    // Pin the algorithm. Tokens issued before the issuer claim existed are still accepted.
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.sub !== "string" || !UUID.test(payload.sub)) throw new Error("bad token");
    if (payload.iss !== undefined && payload.iss !== JWT_OPTIONS.issuer) throw new Error("bad issuer");
    userId = payload.sub;
    version = typeof payload.ver === "number" ? payload.ver : 0;
  } catch {
    return next(new HttpError(401, "Your session has expired. Please sign in again.", "unauthorized"));
  }
  // A database error here propagates as a 500, never a 401: the app signs people out on 401.
  const user = await queryOne<UserRow & { token_version: number }>(
    `SELECT ${USER_COLUMNS}, token_version FROM users WHERE id = $1`,
    [userId],
  );
  if (!user || user.token_version !== version) {
    return next(new HttpError(401, "Your session has ended. Please sign in again.", "unauthorized"));
  }
  const { token_version: _version, ...row } = user;
  req.user = row;
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

// Time zone names are used both by Intl (in Node) and by Postgres (AT TIME ZONE).
// Only names that both understand the same way are accepted: offset strings such
// as "+05:30" mean opposite things in the two (POSIX vs ISO sign).
let pgZones: Promise<Map<string, string>> | null = null;
function postgresZones() {
  pgZones ??= query<{ name: string }>("SELECT name FROM pg_timezone_names")
    .then((rows) => new Map(rows.map((r) => [r.name.toLowerCase(), r.name])))
    .catch((err) => {
      pgZones = null;
      throw err;
    });
  return pgZones;
}

/** A canonical IANA time zone name that both Node and Postgres accept, or undefined. */
export async function safeTimezone(tz: unknown): Promise<string | undefined> {
  if (typeof tz !== "string" || tz.length > 64 || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(tz)) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    return undefined;
  }
  return (await postgresZones()).get(tz.toLowerCase());
}
