import { Router } from "express";
import { generateDailyCard, type DailyCard } from "../ai/analysis.js";
import { buildUserContext } from "../ai/context.js";
import { currentUser, type UserRow } from "../auth.js";
import { FALLBACK_AFFIRMATIONS } from "../content/catalog.js";
import { query, queryOne } from "../db.js";
import { progressSummary, todayIn } from "../lib/progress.js";

export const homeRouter = Router();

type Daily = DailyCard & { source: "ai" | "offline" };

function offlineDaily(day: string, latestMood: number | null): Daily {
  const index = Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 86_400_000) % FALLBACK_AFFIRMATIONS.length;
  const affirmation = FALLBACK_AFFIRMATIONS[index]!;
  if (latestMood !== null && latestMood <= 2) {
    return {
      affirmation,
      focusTitle: "Go gently today",
      focusBody: "Your last check-in felt heavy. One slow breath at a time is enough.",
      activity: "breathing_calm",
      source: "offline",
    };
  }
  if (latestMood === null) {
    return {
      affirmation,
      focusTitle: "Check in with yourself",
      focusBody: "Thirty seconds to notice how you feel. It's the first step to feeling better.",
      activity: "mood_checkin",
      source: "offline",
    };
  }
  return {
    affirmation,
    focusTitle: "Notice one good thing",
    focusBody: "Write down a moment from today that felt even a little bit good.",
    activity: "journal",
    source: "offline",
  };
}

const inFlight = new Map<string, Promise<Daily>>();

async function cachedDaily(userId: string, day: string) {
  const row = await queryOne<{ payload: Daily }>(
    "SELECT payload FROM daily_cache WHERE user_id = $1 AND day = $2 AND kind = 'daily'",
    [userId, day],
  );
  return row?.payload ?? null;
}

/** Generates today's card once per user per day; concurrent callers share the work. */
function ensureDaily(user: UserRow, day: string): Promise<Daily> {
  const key = `${user.id}:${day}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const work = (async () => {
    const cached = await cachedDaily(user.id, day);
    if (cached) return cached;
    const latest = await queryOne<{ mood: number }>(
      "SELECT mood FROM mood_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [user.id],
    );
    const context = await buildUserContext(user);
    const ai = await generateDailyCard(context);
    const daily: Daily = ai ? { ...ai, source: "ai" } : offlineDaily(day, latest?.mood ?? null);
    if (ai) {
      await query(
        `INSERT INTO daily_cache (user_id, day, kind, payload) VALUES ($1, $2, 'daily', $3)
         ON CONFLICT (user_id, day, kind) DO UPDATE SET payload = EXCLUDED.payload, created_at = now()`,
        [user.id, day, daily],
      );
    }
    return daily;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, work);
  return work;
}

homeRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const day = todayIn(user.timezone);
  const [progress, todayMood, lastConversation, daily] = await Promise.all([
    progressSummary(user.id, user.timezone),
    queryOne<{ mood: number; emotions: string[]; created_at: string }>(
      `SELECT mood, emotions, created_at FROM mood_entries
       WHERE user_id = $1 AND (created_at AT TIME ZONE $2)::date = $3::date
       ORDER BY created_at DESC LIMIT 1`,
      [user.id, user.timezone, day],
    ),
    queryOne<{ id: string; title: string | null; updated_at: string }>(
      `SELECT c.id, c.title, c.updated_at FROM conversations c
       WHERE c.user_id = $1 AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
       ORDER BY c.updated_at DESC LIMIT 1`,
      [user.id],
    ),
    cachedDaily(user.id, day),
  ]);
  // Kick off generation so /home/daily is ready sooner.
  if (!daily) void ensureDaily(user, day).catch(() => undefined);
  res.json({
    name: user.name,
    progress,
    todayMood: todayMood ? { mood: todayMood.mood, emotions: todayMood.emotions, createdAt: todayMood.created_at } : null,
    lastConversation: lastConversation
      ? { id: lastConversation.id, title: lastConversation.title, updatedAt: lastConversation.updated_at }
      : null,
    daily,
  });
});

homeRouter.get("/daily", async (req, res) => {
  const user = currentUser(req);
  const daily = await ensureDaily(user, todayIn(user.timezone));
  res.json({ daily });
});
