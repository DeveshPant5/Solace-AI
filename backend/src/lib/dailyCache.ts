import { query } from "../db.js";

// AI cards cached per person per day in daily_cache ("daily" on Home, "reflection"
// on Journey). Anything that changes what the AI may draw on (a check-in, a
// deleted memory, the memory switch) invalidates them. The epoch makes sure a
// generation that was already running when the data changed doesn't write its
// stale result back afterwards.

const epochs = new Map<string, number>();

export const cacheEpoch = (userId: string) => epochs.get(userId) ?? 0;

export async function invalidateDailyCache(userId: string, kinds: ("daily" | "reflection")[] = ["daily", "reflection"]) {
  epochs.set(userId, cacheEpoch(userId) + 1);
  await query("DELETE FROM daily_cache WHERE user_id = $1 AND kind = ANY($2::text[])", [userId, kinds]);
}

/** Offline (no-AI) results are cached briefly so a failing or declining model isn't called on every visit. */
export const OFFLINE_CACHE_MINUTES = 15;
