import { Router } from "express";
import { generateDailyCard, type DailyCard } from "../ai/analysis.js";
import { buildUserContext } from "../ai/context.js";
import { currentUser, type UserRow } from "../auth.js";
import { FALLBACK_AFFIRMATIONS } from "../content/catalog.js";
import { query, queryOne } from "../db.js";
import { pgCode } from "../errors.js";
import { cacheEpoch, OFFLINE_CACHE_MINUTES } from "../lib/dailyCache.js";
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

/**
 * Today's cached card, if it is still current: written after the latest check-in
 * and assessment (so a check-in during generation can't leave a stale card), and
 * for offline cards only for a short while (so a failing model isn't retried on
 * every visit, but is retried soon).
 */
async function cachedDaily(userId: string, day: string) {
  const row = await queryOne<{ payload: Daily }>(
    `SELECT payload FROM daily_cache d
     WHERE d.user_id = $1 AND d.day = $2 AND d.kind = 'daily'
       AND d.created_at > COALESCE((SELECT max(created_at) FROM mood_entries WHERE user_id = $1), '-infinity')
       AND d.created_at > COALESCE((SELECT max(created_at) FROM assessments WHERE user_id = $1), '-infinity')
       AND (d.payload->>'source' IS DISTINCT FROM 'offline' OR d.created_at > now() - make_interval(mins => $3))`,
    [userId, day, OFFLINE_CACHE_MINUTES],
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
    const epoch = cacheEpoch(user.id);
    const latest = await queryOne<{ mood: number }>(
      "SELECT mood FROM mood_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [user.id],
    );
    const context = await buildUserContext(user);
    const ai = await generateDailyCard(context, { userId: user.id });
    const daily: Daily = ai ? { ...ai, source: "ai" } : offlineDaily(day, latest?.mood ?? null);
    // Skip the write if their data changed while this was being written (e.g. a memory was deleted).
    if (epoch === cacheEpoch(user.id)) {
      await query(
        `INSERT INTO daily_cache (user_id, day, kind, payload) VALUES ($1, $2, 'daily', $3)
         ON CONFLICT (user_id, day, kind) DO UPDATE SET payload = EXCLUDED.payload, created_at = now()`,
        [user.id, day, daily],
      ).catch((err) => {
        // The account was deleted while the card was being written: nothing to keep.
        if (pgCode(err) !== "23503") throw err;
      });
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
