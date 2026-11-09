import { query, queryOne, withUserLock, type Db } from "../db.js";

export const XP = {
  mood_checkin: 10,
  assessment_question: 2,
  assessment_bonus: 20,
  breathing: 15,
  grounding: 15,
  guide_step: 5,
  journal: 15,
  chat_daily: 10,
  task: 10,
} as const;

// A garden that grows as you show up for yourself.
const LEVELS = [
  { name: "Seed", xp: 0 },
  { name: "Sprout", xp: 60 },
  { name: "Seedling", xp: 150 },
  { name: "Bud", xp: 300 },
  { name: "Bloom", xp: 500 },
  { name: "Blossom", xp: 800 },
  { name: "Grove", xp: 1200 },
  { name: "Garden", xp: 1800 },
  { name: "Sanctuary", xp: 2600 },
];

export function levelFor(totalXp: number) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (totalXp >= LEVELS[i]!.xp) index = i;
  const current = LEVELS[index]!;
  const next = LEVELS[index + 1];
  return {
    level: index + 1,
    name: current.name,
    xp: totalXp,
    levelStartXp: current.xp,
    nextLevelXp: next?.xp ?? null,
    nextLevelName: next?.name ?? null,
  };
}

/**
 * How many times a day each kind earns XP, so levels and streaks stay honest.
 * Past the cap the action still works and is still counted; it just earns 0 XP.
 */
export const DAILY_XP_CAP = {
  mood_checkin: 3,
  breathing: 5,
  grounding: 5,
  journal: 3,
  chat: 1,
  task: 5,
} as const;

/** Past this many rows of one kind in a day, practice sessions are no longer recorded at all. */
export const DAILY_ROW_CAP = 30;

export async function recordActivity(
  userId: string,
  kind: string,
  xp: number,
  meta: Record<string, unknown> = {},
  db?: Db,
): Promise<number> {
  await query("INSERT INTO activities (user_id, kind, xp, meta) VALUES ($1, $2, $3, $4)", [userId, kind, xp, meta], db);
  return xp;
}

/** Activities of one kind the person logged today (in their time zone). */
export async function countToday(db: Db, userId: string, kind: string, timezone: string, extraWhere = "", extraParams: unknown[] = []) {
  const row = await queryOne<{ n: number; earned: number }>(
    `SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE xp > 0) AS earned FROM activities
     WHERE user_id = $1 AND kind = $2
       AND (created_at AT TIME ZONE $3)::date = (now() AT TIME ZONE $3)::date ${extraWhere}`,
    [userId, kind, timezone, ...extraParams],
    db,
  );
  return { n: row?.n ?? 0, earned: row?.earned ?? 0 };
}

/** Awards the once-a-day chat XP if it hasn't been awarded today (user's timezone). */
export async function awardDailyChatXp(userId: string, timezone: string): Promise<number> {
  return withUserLock(userId, async (db) => {
    const today = await countToday(db, userId, "chat", timezone);
    if (today.n > 0) return 0;
    return recordActivity(userId, "chat", XP.chat_daily, {}, db);
  });
}

export async function totalXp(userId: string): Promise<number> {
  const row = await queryOne<{ total: number | null }>("SELECT SUM(xp) AS total FROM activities WHERE user_id = $1", [
    userId,
  ]);
  return row?.total ?? 0;
}

/** Distinct local days (YYYY-MM-DD, newest first) on which the user did anything. */
export async function activeDays(userId: string, timezone: string, limit = 400): Promise<string[]> {
  const rows = await query<{ day: string }>(
    `SELECT DISTINCT (created_at AT TIME ZONE $2)::date AS day FROM activities
     WHERE user_id = $1 ORDER BY day DESC LIMIT $3`,
    [userId, timezone, limit],
  );
  return rows.map((r) => r.day);
}

export function todayIn(timezone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Current streak counts consecutive days ending today, or ending yesterday if
 * the user hasn't done anything yet today (the streak is still alive).
 */
export function computeStreaks(days: string[], today: string) {
  const set = new Set(days);
  let current = 0;
  let cursor = set.has(today) ? today : shiftDay(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of [...days].sort()) {
    run = prev && shiftDay(prev, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }
  return { current, longest, activeToday: set.has(today) };
}

export async function progressSummary(userId: string, timezone: string) {
  const [xp, days] = await Promise.all([totalXp(userId), activeDays(userId, timezone)]);
  const today = todayIn(timezone);
  return { ...levelFor(xp), streak: computeStreaks(days, today), today };
}
