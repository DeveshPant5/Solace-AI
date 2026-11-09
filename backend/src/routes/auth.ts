import bcrypt from "bcryptjs";
import { Router } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { config } from "../config.js";
import { currentUser, publicUser, requireAuth, safeTimezone, signToken, USER_COLUMNS, type UserRow } from "../auth.js";
import { isFocusId } from "../content/catalog.js";
import { pool, query, queryOne } from "../db.js";
import { HttpError, pgCode } from "../errors.js";
import { PROVIDER_LABEL, verifyIdentityToken, type Provider, type VerifiedIdentity } from "../lib/identityTokens.js";
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

/** Only the app's known focus areas are kept (they end up in Luma's context). */
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

interface NewAccount {
  email: string;
  /** Null for accounts that sign in with Google or Apple. */
  passwordHash: string | null;
  name: string;
  timezone?: string;
  profile: z.infer<typeof ProfileInput>;
  tone?: "gentle" | "cheerful" | "direct";
}

/** Creates the account and its gentle default reminders. Runs inside the caller's transaction. */
async function insertAccount(client: PoolClient, account: NewAccount): Promise<UserRow> {
  const timezone = (await safeTimezone(account.timezone)) ?? "UTC";
  const checkinHour = CHECKIN_HOURS[account.profile.checkinTime ?? "evening"];
  const inserted = await client.query<UserRow>(
    `INSERT INTO users (email, password_hash, name, timezone, profile, preferences)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${USER_COLUMNS}`,
    [account.email, account.passwordHash, account.name, timezone, account.profile, { tone: account.tone ?? "gentle", memoryEnabled: true }],
  );
  const user = inserted.rows[0]!;
  // Gentle defaults; the person can change all of these in Reminders.
  await client.query(
    `INSERT INTO reminders (user_id, kind, title, body, hour, minute, enabled, created_by) VALUES
      ($1, 'mood', 'How are you feeling?', 'Take 30 seconds to check in with yourself.', $2, 0, true, 'system'),
      ($1, 'affirmation', 'Your affirmation for today', NULL, $3, 0, true, 'system'),
      ($1, 'breathing', 'Time for a breather', 'One minute of slow breathing can reset your day.', 15, 0, false, 'system'),
      ($1, 'selfcare', 'A little self-care', 'Drink some water, stretch, or step outside for a moment.', 18, 30, false, 'system')`,
    [user.id, checkinHour, checkinHour === 9 ? 8 : 9],
  );
  return user;
}

/** Runs fn in a transaction; a unique-email race (a double tap) becomes onDuplicate(). */
async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>, onDuplicate: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (pgCode(err) === "23505") return onDuplicate();
    throw err;
  } finally {
    client.release();
  }
}

authRouter.post("/signup", signupLimit, async (req, res) => {
  const body = SignUp.parse(req.body);
  const existing = await queryOne("SELECT 1 FROM users WHERE email = $1", [body.email]);
  if (existing) throw EMAIL_TAKEN();

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);
  const user = await inTransaction(
    (client) => insertAccount(client, { ...body, passwordHash }),
    // Two sign-ups for the same email at once (a double tap): the second one lost the race.
    () => Promise.reject(EMAIL_TAKEN()),
  );
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

  const row = await queryOne<UserRow & { password_hash: string | null; token_version: number }>(
    `SELECT ${USER_COLUMNS}, password_hash, token_version FROM users WHERE email = $1`,
    [body.email],
  );
  const ok = await bcrypt.compare(body.password, row?.password_hash ?? DUMMY_HASH);
  if (row && row.password_hash === null) {
    // Made with Google or Apple: there is no password to match, so point to the right button.
    throw new HttpError(401, `This account signs in with ${await providersOf(row.id)}. Use that button below.`, "use_provider");
  }
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
  const row = await queryOne<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  if (row && row.password_hash === null) {
    throw new HttpError(400, `Your account signs in with ${await providersOf(user.id)}, so there's no password to change.`, "no_password");
  }
  if (!row?.password_hash || !(await bcrypt.compare(body.currentPassword, row.password_hash))) {
    throw new HttpError(400, "Your current password doesn't match.", "invalid_credentials");
  }
  const hash = await bcrypt.hash(body.newPassword, BCRYPT_COST);
  const updated = await queryOne<{ token_version: number }>(
    "UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING token_version",
    [user.id, hash],
  );
  res.json({ token: signToken(user.id, updated!.token_version) });
});


// ---------- Sign in with Google / Apple ----------

/** "Google", "Apple" or "Google or Apple": how a password-less account signs in. */
async function providersOf(userId: string): Promise<string> {
  const rows = await query<{ provider: Provider }>("SELECT DISTINCT provider FROM user_identities WHERE user_id = $1 ORDER BY provider DESC", [
    userId,
  ]);
  return rows.map((r) => PROVIDER_LABEL[r.provider]).join(" or ") || "Google or Apple";
}

const socialLimit = rateLimit({ limit: 30, windowMs: 15 * MINUTE });

const SocialSignIn = z.object({
  /** The ID token from Google, or the identity token from Apple. */
  token: z.string().min(20).max(8192),
  /** Used only when this creates the account: what Luma should call them (from onboarding, or Apple's first-time name). */
  name: lineField(60).optional(),
  timezone: z.string().optional(),
  profile: ProfileInput.default({}),
  tone: z.enum(["gentle", "cheerful", "direct"]).optional(),
});

type LoadedUser = UserRow & { token_version: number };

async function userByIdentity(identity: VerifiedIdentity): Promise<LoadedUser | undefined> {
  return queryOne<LoadedUser>(
    `SELECT ${USER_COLUMNS}, token_version FROM users
     WHERE id = (SELECT user_id FROM user_identities WHERE provider = $1 AND subject = $2)`,
    [identity.provider, identity.subject],
  );
}

/**
 * Finds or makes the account for a verified Google/Apple identity.
 * - Already linked: signs in.
 * - Same email as an account made with Google or Apple: links this one too (both providers verified the email).
 * - Same email as a password account: refused. There's no email verification for password sign-ups, so someone
 *   could have registered this address first; linking would let them into the real owner's account later.
 * - Otherwise: a new account with no password.
 */
async function signInWithIdentity(
  identity: VerifiedIdentity,
  body: z.infer<typeof SocialSignIn>,
): Promise<{ user: LoadedUser; created: boolean }> {
  const label = PROVIDER_LABEL[identity.provider];
  const linked = await userByIdentity(identity);
  if (linked) return { user: linked, created: false };

  if (!identity.email || !identity.emailVerified) {
    throw new HttpError(400, `${label} didn't share a verified email with us, so we can't make your account this way. Email sign-up works too.`, "email_unverified");
  }
  const email = identity.email;

  const existing = await queryOne<LoadedUser & { password_hash: string | null }>(
    `SELECT ${USER_COLUMNS}, token_version, password_hash FROM users WHERE email = $1`,
    [email],
  );
  if (existing) {
    if (existing.password_hash !== null) {
      throw new HttpError(409, "You already have a Solace account with this email. Please sign in with your password.", "use_password");
    }
    await query(
      `INSERT INTO user_identities (provider, subject, user_id, email) VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, subject) DO NOTHING`,
      [identity.provider, identity.subject, existing.id, email],
    );
    const { password_hash: _hash, ...user } = existing;
    return { user, created: false };
  }

  const name = body.name || identity.givenName || "friend";
  const user = await inTransaction(
    async (client) => {
      const row = await insertAccount(client, { email, passwordHash: null, name, timezone: body.timezone, profile: body.profile, tone: body.tone });
      await client.query("INSERT INTO user_identities (provider, subject, user_id, email) VALUES ($1, $2, $3, $4)", [
        identity.provider,
        identity.subject,
        row.id,
        email,
      ]);
      return { ...row, token_version: 0 };
    },
    // A double tap: the other request made the account a moment ago.
    async () => {
      const raced = await userByIdentity(identity);
      if (!raced) throw EMAIL_TAKEN();
      return raced;
    },
  );
  return { user, created: true };
}

/**
 * Public: the Google Web client id the app asks Google for (client ids aren't secret; they ship in every app),
 * so setting GOOGLE_CLIENT_IDS on the server is enough to turn Google on in an APK that's already built.
 */
authRouter.get("/providers", (_req, res) => {
  res.json({ googleWebClientId: config.googleClientIds[0] ?? null, apple: config.appleAudiences.length > 0 });
});

for (const provider of ["google", "apple"] as const) {
  authRouter.post(`/${provider}`, socialLimit, async (req, res) => {
    const body = SocialSignIn.parse(req.body);
    const identity = await verifyIdentityToken(provider, body.token);
    const { user, created } = await signInWithIdentity(identity, body);
    const { token_version: version, ...row } = user;
    res.status(created ? 201 : 200).json({ token: signToken(row.id, version), user: publicUser(row), created });
  });
}
