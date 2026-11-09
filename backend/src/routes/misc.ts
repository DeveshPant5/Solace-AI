import { Router } from "express";
import { z } from "zod";
import { currentUser } from "../auth.js";
import { GUIDE_IDS } from "../content/catalog.js";
import { query, queryOne, withUserLock } from "../db.js";
import { HttpError } from "../errors.js";
import { invalidateDailyCache } from "../lib/dailyCache.js";
import { countToday, DAILY_ROW_CAP, DAILY_XP_CAP, recordActivity, XP } from "../lib/progress.js";
import { lineField, textField } from "../lib/text.js";

const Id = z.uuid();
const idParam = (raw: string) => {
  const parsed = Id.safeParse(raw);
  if (!parsed.success) throw new HttpError(404, "Not found", "not_found");
  return parsed.data;
};

// ---------------- Activities (XP for practices) ----------------

export const activitiesRouter = Router();

const Seconds = z.number().int().min(0).max(7200).optional();
const ActivityInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("breathing"),
    meta: z.object({ pattern: lineField(40).optional(), seconds: Seconds }).default({}),
  }),
  z.object({ kind: z.literal("grounding"), meta: z.object({ seconds: Seconds }).default({}) }),
  z.object({
    kind: z.literal("guide_step"),
    meta: z.object({ guide: z.enum(GUIDE_IDS), step: z.number().int().min(0).max(20) }),
  }),
]);

activitiesRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const body = ActivityInput.parse(req.body);
  const xp = await withUserLock(user.id, async (db) => {
    if (body.kind === "guide_step") {
      // Each guide step earns XP once, and is recorded once.
      const done = await queryOne(
        "SELECT 1 FROM activities WHERE user_id = $1 AND kind = 'guide_step' AND meta->>'guide' = $2 AND (meta->>'step')::int = $3",
        [user.id, body.meta.guide, body.meta.step],
        db,
      );
      if (done) return 0;
      return recordActivity(user.id, body.kind, XP.guide_step, body.meta, db);
    }
    // Practices earn XP up to 5 times a day so the streak stays honest; past a generous cap they aren't stored at all.
    const today = await countToday(db, user.id, body.kind, user.timezone);
    if (today.n >= DAILY_ROW_CAP) return 0;
    const earned = today.earned < DAILY_XP_CAP[body.kind] ? XP[body.kind] : 0;
    return recordActivity(user.id, body.kind, earned, body.meta, db);
  });
  res.status(201).json({ xp });
});

activitiesRouter.get("/guides", async (req, res) => {
  const user = currentUser(req);
  const rows = await query<{ guide: string; step: number }>(
    `SELECT DISTINCT meta->>'guide' AS guide, (meta->>'step')::int AS step
     FROM activities WHERE user_id = $1 AND kind = 'guide_step' AND meta ? 'guide' AND meta ? 'step'`,
    [user.id],
  );
  // A Map, not a plain object: a stored name like "constructor" must not collide with object built-ins.
  const done = new Map<string, number[]>();
  for (const r of rows) {
    if (!(GUIDE_IDS as readonly string[]).includes(r.guide)) continue;
    done.set(r.guide, [...(done.get(r.guide) ?? []), r.step]);
  }
  res.json({ done: Object.fromEntries(done) });
});

// ---------------- Journal ----------------

export const journalRouter = Router();

journalRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const rows = await query<{ id: string; prompt: string | null; content: string; created_at: string }>(
    "SELECT id, prompt, content, created_at FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
    [user.id],
  );
  res.json({ entries: rows.map((r) => ({ id: r.id, prompt: r.prompt, content: r.content, createdAt: r.created_at })) });
});

journalRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const body = z
    .object({
      prompt: lineField(300).optional(),
      content: textField(10000).pipe(z.string().min(1, "Write something first")),
    })
    .parse(req.body);
  const { row, xp } = await withUserLock(user.id, async (db) => {
    const today = await countToday(db, user.id, "journal", user.timezone);
    const row = await queryOne<{ id: string; created_at: string }>(
      "INSERT INTO journal_entries (user_id, prompt, content) VALUES ($1, $2, $3) RETURNING id, created_at",
      [user.id, body.prompt || null, body.content],
      db,
    );
    const earned = today.earned < DAILY_XP_CAP.journal ? XP.journal : 0;
    const xp = await recordActivity(user.id, "journal", earned, {}, db);
    return { row: row!, xp };
  });
  res.status(201).json({ entry: { id: row.id, prompt: body.prompt || null, content: body.content, createdAt: row.created_at }, xp });
});

journalRouter.delete("/:id", async (req, res) => {
  const user = currentUser(req);
  const deleted = await query("DELETE FROM journal_entries WHERE id = $1 AND user_id = $2 RETURNING id", [idParam(req.params.id), user.id]);
  // Today's AI cards may have drawn on this entry.
  if (deleted.length) await invalidateDailyCache(user.id);
  res.status(204).end();
});

// ---------------- Memories (what Luma remembers) ----------------

export const memoriesRouter = Router();

memoriesRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const rows = await query<{ id: string; content: string; category: string; created_at: string }>(
    "SELECT id, content, category, created_at FROM memories WHERE user_id = $1 ORDER BY created_at DESC",
    [user.id],
  );
  res.json({ memories: rows.map((r) => ({ id: r.id, content: r.content, category: r.category, createdAt: r.created_at })) });
});

memoriesRouter.delete("/:id", async (req, res) => {
  const user = currentUser(req);
  const deleted = await query("DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING id", [idParam(req.params.id), user.id]);
  // Today's AI cards may have drawn on this memory.
  if (deleted.length) await invalidateDailyCache(user.id);
  res.status(204).end();
});

memoriesRouter.delete("/", async (req, res) => {
  const user = currentUser(req);
  await query("DELETE FROM memories WHERE user_id = $1", [user.id]);
  await invalidateDailyCache(user.id);
  res.status(204).end();
});

// ---------------- Reminders ----------------

export const remindersRouter = Router();

interface ReminderRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  hour: number;
  minute: number;
  enabled: boolean;
  created_by: string;
}
const toReminder = (r: ReminderRow) => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  hour: r.hour,
  minute: r.minute,
  enabled: r.enabled,
  createdBy: r.created_by,
});
const REMINDER_COLUMNS = "id, kind, title, body, hour, minute, enabled, created_by";

remindersRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const rows = await query<ReminderRow>(
    `SELECT ${REMINDER_COLUMNS} FROM reminders WHERE user_id = $1
     ORDER BY CASE kind WHEN 'custom' THEN 1 ELSE 0 END, hour, minute`,
    [user.id],
  );
  res.json({ reminders: rows.map(toReminder) });
});

const MAX_REMINDERS = 30;

const ReminderInput = z.object({
  title: lineField(60).pipe(z.string().min(1)),
  body: lineField(160).nullable().optional(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  enabled: z.boolean().optional(),
});

remindersRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const body = ReminderInput.parse(req.body);
  const row = await withUserLock(user.id, async (db) => {
    const count = await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM reminders WHERE user_id = $1", [user.id], db);
    if ((count?.n ?? 0) >= MAX_REMINDERS) throw new HttpError(400, `You can have up to ${MAX_REMINDERS} reminders`, "limit");
    return queryOne<ReminderRow>(
      `INSERT INTO reminders (user_id, kind, title, body, hour, minute, enabled)
       VALUES ($1, 'custom', $2, $3, $4, $5, $6) RETURNING ${REMINDER_COLUMNS}`,
      [user.id, body.title, body.body || null, body.hour, body.minute, body.enabled ?? true],
      db,
    );
  });
  res.status(201).json({ reminder: toReminder(row!) });
});

remindersRouter.patch("/:id", async (req, res) => {
  const user = currentUser(req);
  const body = ReminderInput.partial().parse(req.body);
  const row = await queryOne<ReminderRow>(
    `UPDATE reminders SET
       title = COALESCE($3, title),
       body = CASE WHEN $4::boolean THEN $5 ELSE body END,
       hour = COALESCE($6, hour),
       minute = COALESCE($7, minute),
       enabled = COALESCE($8, enabled)
     WHERE id = $1 AND user_id = $2 RETURNING ${REMINDER_COLUMNS}`,
    [
      idParam(req.params.id),
      user.id,
      body.title ?? null,
      body.body !== undefined,
      body.body || null,
      body.hour ?? null,
      body.minute ?? null,
      body.enabled ?? null,
    ],
  );
  if (!row) throw new HttpError(404, "Reminder not found", "not_found");
  res.json({ reminder: toReminder(row) });
});

remindersRouter.delete("/:id", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  // One statement with the ownership check, so the row checked is the row deleted.
  const deleted = await query("DELETE FROM reminders WHERE id = $1 AND user_id = $2 AND kind = 'custom' RETURNING id", [id, user.id]);
  if (deleted.length) return void res.status(204).end();
  const row = await queryOne<{ kind: string }>("SELECT kind FROM reminders WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!row) throw new HttpError(404, "Reminder not found", "not_found");
  throw new HttpError(400, "Built-in reminders can be turned off but not deleted", "not_allowed");
});
