import { Router } from "express";
import { generateWeeklyReflection, type Reflection } from "../ai/analysis.js";
import { buildUserContext } from "../ai/context.js";
import { currentUser } from "../auth.js";
import { MOOD_LABELS } from "../content/catalog.js";
import { query, queryOne } from "../db.js";
import { activeDays, computeStreaks, levelFor, todayIn, totalXp } from "../lib/progress.js";

export const progressRouter = Router();

progressRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const tz = user.timezone;
  const today = todayIn(tz);
  const [xp, days, moodDays, counts, assessmentKinds] = await Promise.all([
    totalXp(user.id),
    activeDays(user.id, tz),
    query<{ day: string; avg: number; n: number }>(
      `SELECT (created_at AT TIME ZONE $2)::date AS day, AVG(mood) AS avg, COUNT(*) AS n
       FROM mood_entries WHERE user_id = $1 AND created_at > now() - interval '31 days'
       GROUP BY day ORDER BY day`,
      [user.id, tz],
    ),
    query<{ kind: string; n: number }>("SELECT kind, COUNT(*) AS n FROM activities WHERE user_id = $1 GROUP BY kind", [
      user.id,
    ]),
    query<{ kind: string }>("SELECT DISTINCT kind FROM assessments WHERE user_id = $1", [user.id]),
  ]);
  const count = (kind: string) => counts.find((c) => c.kind === kind)?.n ?? 0;
  const streak = computeStreaks(days, today);
  const [journalCount, memoryCount] = await Promise.all([
    queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM journal_entries WHERE user_id = $1", [user.id]),
    queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM conversations WHERE user_id = $1", [user.id]),
  ]);

  const achievements = [
    { id: "first_checkin", title: "First check-in", description: "Logged how you feel for the first time", goal: 1, value: count("mood_checkin") },
    { id: "streak_3", title: "Three in a row", description: "Showed up 3 days in a row", goal: 3, value: streak.longest },
    { id: "streak_7", title: "A whole week", description: "Showed up 7 days in a row", goal: 7, value: streak.longest },
    { id: "breath_5", title: "Breath keeper", description: "Finished 5 breathing sessions", goal: 5, value: count("breathing") },
    { id: "ground_1", title: "Feet on the ground", description: "Tried the 5-4-3-2-1 grounding", goal: 1, value: count("grounding") },
    { id: "journal_3", title: "Storyteller", description: "Wrote 3 journal entries", goal: 3, value: journalCount?.n ?? 0 },
    { id: "talk_1", title: "Opening up", description: "Had your first conversation with Sol", goal: 1, value: count("chat") },
    { id: "checks_all", title: "Know yourself", description: "Completed all three wellbeing checks", goal: 3, value: assessmentKinds.length },
  ].map((a) => ({ ...a, value: Math.min(a.value, a.goal), earned: a.value >= a.goal }));

  res.json({
    ...levelFor(xp),
    streak,
    today,
    activeDays: days.slice(0, 120),
    moodDays: moodDays.map((d) => ({ day: d.day, mood: Math.round(d.avg * 10) / 10, count: d.n })),
    counts: {
      checkins: count("mood_checkin"),
      breathing: count("breathing"),
      grounding: count("grounding"),
      journal: journalCount?.n ?? 0,
      assessments: count("assessment"),
      conversations: memoryCount?.n ?? 0,
    },
    achievements,
  });
});

progressRouter.get("/reflection", async (req, res) => {
  const user = currentUser(req);
  const tz = user.timezone;
  const day = todayIn(tz);
  const cached = await queryOne<{ payload: Reflection }>(
    "SELECT payload FROM daily_cache WHERE user_id = $1 AND day = $2 AND kind = 'reflection'",
    [user.id, day],
  );
  if (cached) return void res.json({ reflection: cached.payload });

  const [moods, acts, journals] = await Promise.all([
    query<{ mood: number; emotions: string[]; note: string | null; created_at: string }>(
      "SELECT mood, emotions, note, created_at FROM mood_entries WHERE user_id = $1 AND created_at > now() - interval '7 days' ORDER BY created_at",
      [user.id],
    ),
    query<{ kind: string; n: number }>(
      "SELECT kind, COUNT(*) AS n FROM activities WHERE user_id = $1 AND created_at > now() - interval '7 days' GROUP BY kind",
      [user.id],
    ),
    query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM journal_entries WHERE user_id = $1 AND created_at > now() - interval '7 days'",
      [user.id],
    ),
  ]);
  if (moods.length + acts.length === 0) return void res.json({ reflection: null });

  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric" });
  const week = [
    ...moods.map(
      (m) =>
        `- ${fmt.format(new Date(m.created_at))}: mood ${MOOD_LABELS[m.mood]}${m.emotions.length ? ` (${m.emotions.join(", ")})` : ""}${
          m.note ? ` "${m.note.slice(0, 160)}"` : ""
        }`,
    ),
    `Activities: ${acts.map((a) => `${a.kind} x${a.n}`).join(", ") || "none"}`,
    `Journal entries: ${journals[0]?.n ?? 0}`,
  ].join("\n");
  const context = await buildUserContext(user);
  const reflection = await generateWeeklyReflection(context, week);
  if (reflection) {
    await query(
      `INSERT INTO daily_cache (user_id, day, kind, payload) VALUES ($1, $2, 'reflection', $3)
       ON CONFLICT (user_id, day, kind) DO UPDATE SET payload = EXCLUDED.payload`,
      [user.id, day, reflection],
    );
  }
  res.json({ reflection: reflection ?? offlineReflection(moods, acts, journals[0]?.n ?? 0) });
});

/** A simple, data-based reflection used when the AI is unavailable. */
function offlineReflection(
  moods: { mood: number; emotions: string[] }[],
  acts: { kind: string; n: number }[],
  journals: number,
): Reflection {
  const count = (kind: string) => acts.find((a) => a.kind === kind)?.n ?? 0;
  const half = Math.floor(moods.length / 2);
  const avg = (list: { mood: number }[]) => list.reduce((s, m) => s + m.mood, 0) / Math.max(list.length, 1);
  const trend = moods.length >= 4 ? avg(moods.slice(half)) - avg(moods.slice(0, half)) : 0;
  const feelings = new Map<string, number>();
  for (const m of moods) for (const e of m.emotions) feelings.set(e, (feelings.get(e) ?? 0) + 1);
  const topFeeling = [...feelings.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const reflection = [
    trend > 0.3
      ? "Your mood has been lifting as the week went on."
      : trend < -0.3
        ? "The last few days have felt heavier than the start of the week."
        : "Your mood has been fairly steady this week.",
    topFeeling ? `"${topFeeling[0]!.toUpperCase()}${topFeeling.slice(1)}" came up most often in your check-ins.` : "",
    "Every check-in helps you see your patterns more clearly.",
  ]
    .filter(Boolean)
    .join(" ");

  const highlights = [
    moods.length ? `${moods.length} mood check-in${moods.length === 1 ? "" : "s"}` : "",
    count("breathing") ? `${count("breathing")} breathing session${count("breathing") === 1 ? "" : "s"}` : "",
    journals ? `${journals} journal entr${journals === 1 ? "y" : "ies"}` : "",
  ].filter(Boolean);

  const gentleGoal = !count("breathing")
    ? "Try one two-minute breathing session before bed."
    : !journals
      ? "Write three small wins in your journal one evening."
      : "Keep your daily check-in going, even on busy days.";

  return {
    headline: trend > 0.3 ? "A week of quiet progress" : trend < -0.3 ? "A heavier week, and you kept showing up" : "A steady week",
    reflection,
    highlights,
    gentleGoal,
  };
}
