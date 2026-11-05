import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { publicUser, safeTimezone, signToken, USER_COLUMNS, type UserRow } from "../auth.js";
import { pool, queryOne } from "../db.js";
import { HttpError } from "../errors.js";

export const authRouter = Router();

const Profile = z
  .object({
    focus: z.array(z.string().max(40)).max(10).optional(),
    intention: z.string().max(300).optional(),
    checkinTime: z.enum(["morning", "afternoon", "evening", "night"]).optional(),
  })
  .default({});

const SignUp = z.object({
  name: z.string().trim().min(1, "Please tell us your name").max(60),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  timezone: z.string().optional(),
  profile: Profile,
  tone: z.enum(["gentle", "cheerful", "direct"]).optional(),
});

const CHECKIN_HOURS = { morning: 9, afternoon: 14, evening: 20, night: 22 } as const;

authRouter.post("/signup", async (req, res) => {
  const body = SignUp.parse(req.body);
  const existing = await queryOne("SELECT 1 FROM users WHERE email = $1", [body.email]);
  if (existing) throw new HttpError(409, "An account with this email already exists. Try signing in.", "email_taken");

  const hash = await bcrypt.hash(body.password, 10);
  const timezone = safeTimezone(body.timezone) ?? "UTC";
  const checkinHour = CHECKIN_HOURS[body.profile.checkinTime ?? "evening"];

  const client = await pool.connect();
  let user: UserRow;
  try {
    await client.query("BEGIN");
    const inserted = await client.query<UserRow>(
      `INSERT INTO users (email, password_hash, name, timezone, profile, preferences)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${USER_COLUMNS}`,
      [body.email, hash, body.name, timezone, body.profile, { tone: body.tone ?? "gentle", memoryEnabled: true }],
    );
    user = inserted.rows[0]!;
    // Gentle defaults; the person can change all of these in Reminders.
    await client.query(
      `INSERT INTO reminders (user_id, kind, title, body, hour, minute, enabled, created_by) VALUES
        ($1, 'mood', 'How are you feeling?', 'Take 30 seconds to check in with yourself.', $2, 0, true, 'system'),
        ($1, 'affirmation', 'Your affirmation for today', NULL, $3, 0, true, 'system'),
        ($1, 'breathing', 'Time for a breather', 'One minute of slow breathing can reset your day.', 15, 0, false, 'system'),
        ($1, 'selfcare', 'A little self-care', 'Drink some water, stretch, or step outside for a moment.', 18, 30, false, 'system')`,
      [user.id, checkinHour, checkinHour === 9 ? 8 : 9],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

const SignIn = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

authRouter.post("/login", async (req, res) => {
  const body = SignIn.parse(req.body);
  const row = await queryOne<UserRow & { password_hash: string }>(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [body.email],
  );
  const ok = row ? await bcrypt.compare(body.password, row.password_hash) : false;
  if (!row || !ok) throw new HttpError(401, "That email and password don't match.", "invalid_credentials");
  res.json({ token: signToken(row.id), user: publicUser(row) });
});
