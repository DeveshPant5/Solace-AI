import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { currentUser, publicUser, requireAuth, safeTimezone, signToken, USER_COLUMNS, type UserRow } from "../auth.js";
import { isFocusId } from "../content/catalog.js";
import { pool, queryOne } from "../db.js";
import { HttpError, pgCode } from "../errors.js";
import { rateLimit, RateLimiter, tooMany, userRateLimit } from "../lib/rateLimit.js";
import { lineField, textField } from "../lib/text.js";

export const authRouter = Router();

const BCRYPT_COST = 10;
// Compared against when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("solace-timing-equaliser", BCRYPT_COST);

const MINUTE = 60_000;
const signupLimit = rateLimit({ limit: 20, windowMs: 60 * MINUTE });
const loginIpLimit = rateLimit({ limit: 30, windowMs: 15 * MINUTE });
/** Failed sign-ins per account, whichever address they come from. */
const loginFailures = new RateLimiter(10, 15 * MINUTE);
const passwordChangeLimit = userRateLimit({ limit: 10, windowMs: 15 * MINUTE });

const Email = z.email("Enter a valid email").trim().toLowerCase().max(254, "That email is too long");
// bcrypt only reads the first 72 bytes of a password; longer ones would silently lose their tail.
const NewPassword = z
  .string()
  .min(8, "Use at least 8 characters")
  .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "Please keep your password under 72 characters");

/** Only the app's known focus areas are kept (they end up in Sol's context). */
export const FocusList = z
  .array(z.string().max(40))
  .max(10)
  .transform((items) => [...new Set(items)].filter(isFocusId));

export const ProfileInput = z.object({
  focus: FocusList.optional(),
  intention: textField(300).optional(),
  checkinTime: z.enum(["morning", "afternoon", "evening", "night"]).optional(),
});

export const NameInput = lineField(60).pipe(z.string().min(1, "Please tell us your name"));

const SignUp = z.object({
  name: NameInput,
  email: Email,
  password: NewPassword,
  timezone: z.string().optional(),
  profile: ProfileInput.default({}),
  tone: z.enum(["gentle", "cheerful", "direct"]).optional(),
});

const CHECKIN_HOURS = { morning: 9, afternoon: 14, evening: 20, night: 22 } as const;
const EMAIL_TAKEN = () => new HttpError(409, "An account with this email already exists. Try signing in.", "email_taken");

authRouter.post("/signup", signupLimit, async (req, res) => {
  const body = SignUp.parse(req.body);
  const existing = await queryOne("SELECT 1 FROM users WHERE email = $1", [body.email]);
  if (existing) throw EMAIL_TAKEN();

  const hash = await bcrypt.hash(body.password, BCRYPT_COST);
  const timezone = (await safeTimezone(body.timezone)) ?? "UTC";
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
    await client.query("ROLLBACK").catch(() => undefined);
    // Two sign-ups for the same email at once (a double tap): the second one lost the race.
    if (pgCode(err) === "23505") throw EMAIL_TAKEN();
    throw err;
  } finally {
    client.release();
  }
  res.status(201).json({ token: signToken(user.id, 0), user: publicUser(user) });
});

const SignIn = z.object({
  email: Email,
  password: z.string().min(1, "Enter your password").max(200),
});

const TOO_MANY_TRIES = "Let's pause for a moment. There were too many sign-in tries, so please wait a few minutes and try again.";

authRouter.post("/login", loginIpLimit, async (req, res) => {
  const body = SignIn.parse(req.body);
  if (loginFailures.isLimited(body.email)) throw tooMany(loginFailures.retryAfter(body.email), TOO_MANY_TRIES);

  const row = await queryOne<UserRow & { password_hash: string; token_version: number }>(
    `SELECT ${USER_COLUMNS}, password_hash, token_version FROM users WHERE email = $1`,
    [body.email],
  );
  const ok = await bcrypt.compare(body.password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    loginFailures.hit(body.email);
    throw new HttpError(401, "That email and password don't match.", "invalid_credentials");
  }
  loginFailures.reset(body.email);
  const { password_hash: _hash, token_version: version, ...user } = row;
  res.json({ token: signToken(user.id, version), user: publicUser(user) });
});

/** Signs out everywhere: every token issued so far stops working. */
authRouter.post("/logout", requireAuth, async (req, res) => {
  const user = currentUser(req);
  await queryOne("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [user.id]);
  res.status(204).end();
});

const ChangePassword = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(200),
  newPassword: NewPassword,
});

/** Changes the password, signs out every other device, and returns a fresh token for this one. */
authRouter.post("/password", requireAuth, passwordChangeLimit, async (req, res) => {
  const user = currentUser(req);
  const body = ChangePassword.parse(req.body);
  const row = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  if (!row || !(await bcrypt.compare(body.currentPassword, row.password_hash))) {
    throw new HttpError(400, "Your current password doesn't match.", "invalid_credentials");
  }
  const hash = await bcrypt.hash(body.newPassword, BCRYPT_COST);
  const updated = await queryOne<{ token_version: number }>(
    "UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING token_version",
    [user.id, hash],
  );
  res.json({ token: signToken(user.id, updated!.token_version) });
});

