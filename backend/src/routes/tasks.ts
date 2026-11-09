import { Router } from "express";
import { z } from "zod";
import { currentUser } from "../auth.js";
import { query, queryOne, withUserLock } from "../db.js";
import { HttpError } from "../errors.js";
import { countToday, DAILY_ROW_CAP, DAILY_XP_CAP, recordActivity, XP } from "../lib/progress.js";
import { lineField } from "../lib/text.js";

// ---------------- Daily tasks ----------------
// Things a person plans to do each day at a set time: one of the app's practices
// (doing it ticks the task by itself) or their own (yoga, a walk), optionally with
// a timer. The app turns each one into a local reminder on the phone.

export const tasksRouter = Router();

export const TASK_ACTIVITIES = ["breathe_calm", "breathe_box", "breathe_478", "grounding", "journal", "checkin", "own"] as const;
type TaskActivity = (typeof TASK_ACTIVITIES)[number];
type Practice = Exclude<TaskActivity, "own">;

const DEFAULT_TITLES: Record<Practice, string> = {
  breathe_calm: "Calm breathing",
  breathe_box: "Box breathing",
  breathe_478: "4-7-8 breathing",
  grounding: "Grounding",
  journal: "Journal",
  checkin: "Check in with yourself",
};

/** The activity the app records for each practice (see /activities, /journal, /moods). */
const PRACTICE_KEY: Record<Practice, string> = {
  breathe_calm: "breathing:calm",
  breathe_box: "breathing:box",
  breathe_478: "breathing:478",
  grounding: "grounding",
  journal: "journal",
  checkin: "mood_checkin",
};

export const MAX_TASKS = 20;
const EVERY_DAY = 127;

interface TaskRow {
  id: string;
  activity: TaskActivity;
  title: string;
  hour: number;
  minute: number;
  days: number;
  minutes: number | null;
  remind: boolean;
}
const TASK_COLUMNS = "id, activity, title, hour, minute, days, minutes, remind";

const toTask = (r: TaskRow) => ({
  id: r.id,
  activity: r.activity,
  title: r.title,
  hour: r.hour,
  minute: r.minute,
  days: r.days,
  minutes: r.minutes,
  remind: r.remind,
});

const TaskInput = z.object({
  activity: z.enum(TASK_ACTIVITIES),
  title: lineField(60).optional(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  /** Bit 0 is Sunday ... bit 6 is Saturday. */
  days: z.number().int().min(1, "Pick at least one day").max(EVERY_DAY).optional(),
  minutes: z.number().int().min(1).max(180).nullable().optional(),
  remind: z.boolean().optional(),
});
type TaskInput = z.infer<typeof TaskInput>;

/** Fills in defaults and drops what doesn't apply (a timer only belongs to the person's own tasks). */
function resolve(input: TaskInput, previous?: TaskRow): Omit<TaskRow, "id"> {
  const activity = input.activity;
  let title = input.title?.trim() || "";
  if (!title && previous) {
    // Keep a name they chose; follow the practice's name if it was the default.
    const wasDefault = previous.activity !== "own" && previous.title === DEFAULT_TITLES[previous.activity];
    title = wasDefault && activity !== "own" ? DEFAULT_TITLES[activity] : previous.title;
  }
  if (!title && activity !== "own") title = DEFAULT_TITLES[activity];
  if (!title) throw new HttpError(400, "Give your task a name", "validation");
  return {
    activity,
    title,
    hour: input.hour,
    minute: input.minute,
    days: input.days ?? previous?.days ?? EVERY_DAY,
    minutes: activity === "own" ? (input.minutes === undefined ? (previous?.minutes ?? null) : input.minutes) : null,
    remind: input.remind ?? previous?.remind ?? true,
  };
}

const Id = z.uuid();
const idParam = (raw: string) => {
  const parsed = Id.safeParse(raw);
  if (!parsed.success) throw new HttpError(404, "Task not found", "not_found");
  return parsed.data;
};

/** Today's tasks with whether each is done: ticked off, or (for a practice) done in the app today. */
tasksRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const tz = user.timezone;
  const [rows, practices, today] = await Promise.all([
    query<TaskRow & { ticked: boolean }>(
      `SELECT ${TASK_COLUMNS.split(", ").map((c) => `t.${c}`).join(", ")},
         EXISTS (SELECT 1 FROM task_completions c WHERE c.task_id = t.id AND c.day = (now() AT TIME ZONE $2)::date) AS ticked
       FROM tasks t WHERE t.user_id = $1 ORDER BY t.hour, t.minute, t.created_at`,
      [user.id, tz],
    ),
    query<{ key: string }>(
      `SELECT DISTINCT kind || COALESCE(':' || (meta->>'pattern'), '') AS key FROM activities
       WHERE user_id = $1 AND kind IN ('breathing', 'grounding', 'journal', 'mood_checkin')
         AND (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date`,
      [user.id, tz],
    ),
    queryOne<{ day: string; weekday: number }>(
      "SELECT to_char(now() AT TIME ZONE $1, 'YYYY-MM-DD') AS day, EXTRACT(DOW FROM now() AT TIME ZONE $1)::int AS weekday",
      [tz],
    ),
  ]);
  const done = new Set(practices.map((p) => p.key));
  const weekday = today!.weekday;
  res.json({
    today: { day: today!.day, weekday },
    tasks: rows.map((r) => {
      const practiced = r.activity !== "own" && done.has(PRACTICE_KEY[r.activity]);
      return {
        ...toTask(r),
        dueToday: ((r.days >> weekday) & 1) === 1,
        doneToday: r.ticked || practiced,
        // A practice done in the app can't be unticked: it happened.
        doneVia: r.ticked ? "tick" : practiced ? "practice" : null,
      };
    }),
  });
});

tasksRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const task = resolve(TaskInput.parse(req.body));
  const row = await withUserLock(user.id, async (db) => {
    const count = await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM tasks WHERE user_id = $1", [user.id], db);
    if ((count?.n ?? 0) >= MAX_TASKS) throw new HttpError(400, `You can plan up to ${MAX_TASKS} tasks`, "limit");
    return queryOne<TaskRow>(
      `INSERT INTO tasks (user_id, activity, title, hour, minute, days, minutes, remind)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${TASK_COLUMNS}`,
      [user.id, task.activity, task.title, task.hour, task.minute, task.days, task.minutes, task.remind],
      db,
    );
  });
  res.status(201).json({ task: toTask(row!) });
});

tasksRouter.patch("/:id", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const changes = TaskInput.partial().parse(req.body);
  const row = await withUserLock(user.id, async (db) => {
    const previous = await queryOne<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1 AND user_id = $2`, [id, user.id], db);
    if (!previous) throw new HttpError(404, "Task not found", "not_found");
    const task = resolve(
      {
        ...changes,
        activity: changes.activity ?? previous.activity,
        hour: changes.hour ?? previous.hour,
        minute: changes.minute ?? previous.minute,
        // A rename to the same practice keeps the title unless a new one is given.
        title: changes.title ?? (changes.activity && changes.activity !== previous.activity ? undefined : previous.title),
      },
      previous,
    );
    return queryOne<TaskRow>(
      `UPDATE tasks SET activity = $3, title = $4, hour = $5, minute = $6, days = $7, minutes = $8, remind = $9
       WHERE id = $1 AND user_id = $2 RETURNING ${TASK_COLUMNS}`,
      [id, user.id, task.activity, task.title, task.hour, task.minute, task.days, task.minutes, task.remind],
      db,
    );
  });
  res.json({ task: toTask(row!) });
});

tasksRouter.delete("/:id", async (req, res) => {
  const user = currentUser(req);
  const deleted = await query("DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id", [idParam(req.params.id), user.id]);
  if (!deleted.length) throw new HttpError(404, "Task not found", "not_found");
  res.status(204).end();
});

/**
 * Ticks a task off for today (or unticks it with `{ "done": false }`). The person's
 * own tasks earn a little XP; practices earn theirs when they're done in the app.
 */
tasksRouter.post("/:id/done", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  const { done } = z.object({ done: z.boolean().default(true) }).parse(req.body ?? {});
  const xp = await withUserLock(user.id, async (db) => {
    const task = await queryOne<{ activity: TaskActivity }>("SELECT activity FROM tasks WHERE id = $1 AND user_id = $2", [id, user.id], db);
    if (!task) throw new HttpError(404, "Task not found", "not_found");
    const todaySql = "(now() AT TIME ZONE $3)::date";
    if (!done) {
      await query(`DELETE FROM task_completions WHERE task_id = $1 AND user_id = $2 AND day = ${todaySql}`, [id, user.id, user.timezone], db);
      // Taking back the tick takes back its XP, so ticking on and off earns nothing.
      await query(
        `DELETE FROM activities WHERE user_id = $2 AND kind = 'task' AND meta->>'task' = $1::text
           AND (created_at AT TIME ZONE $3)::date = ${todaySql}`,
        [id, user.id, user.timezone],
        db,
      );
      return 0;
    }
    const added = await query(
      `INSERT INTO task_completions (task_id, user_id, day) VALUES ($1, $2, ${todaySql})
       ON CONFLICT (task_id, day) DO NOTHING RETURNING task_id`,
      [id, user.id, user.timezone],
      db,
    );
    if (!added.length || task.activity !== "own") return 0;
    const today = await countToday(db, user.id, "task", user.timezone);
    if (today.n >= DAILY_ROW_CAP) return 0;
    return recordActivity(user.id, "task", today.earned < DAILY_XP_CAP.task ? XP.task : 0, { task: id }, db);
  });
  res.json({ done, xp });
});
