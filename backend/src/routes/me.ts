import { Router } from "express";
import { z } from "zod";
import { currentUser, publicUser, safeTimezone, USER_COLUMNS, type UserRow } from "../auth.js";
import { query, queryOne } from "../db.js";
import { HttpError } from "../errors.js";
import { invalidateDailyCache } from "../lib/dailyCache.js";
import { NameInput, ProfileInput } from "./auth.js";

export const meRouter = Router();

meRouter.get("/", (req, res) => {
  res.json({ user: publicUser(currentUser(req)) });
});

const Patch = z.object({
  name: NameInput.optional(),
  timezone: z.string().optional(),
  profile: ProfileInput.optional(),
  preferences: z
    .object({
      tone: z.enum(["gentle", "cheerful", "direct"]).optional(),
      memoryEnabled: z.boolean().optional(),
    })
    .optional(),
});

meRouter.patch("/", async (req, res) => {
  const user = currentUser(req);
  const body = Patch.parse(req.body);
  const timezone = body.timezone ? await safeTimezone(body.timezone) : undefined;
  if (body.timezone && !timezone) throw new HttpError(400, "Unknown timezone", "invalid_input");
  const updated = await queryOne<UserRow>(
    `UPDATE users SET
       name = COALESCE($2, name),
       timezone = COALESCE($3, timezone),
       profile = profile || $4::jsonb,
       preferences = preferences || $5::jsonb
     WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [user.id, body.name ?? null, timezone ?? null, body.profile ?? {}, body.preferences ?? {}],
  );
  // Cached AI cards were written with the old settings (memory switch, tone, focus): make fresh ones.
  const prefs = body.preferences;
  const changedWhatAiUses =
    (prefs?.memoryEnabled !== undefined && prefs.memoryEnabled !== (user.preferences.memoryEnabled !== false)) ||
    (prefs?.tone !== undefined && prefs.tone !== user.preferences.tone) ||
    body.profile !== undefined ||
    (timezone !== undefined && timezone !== user.timezone);
  if (changedWhatAiUses) await invalidateDailyCache(user.id);
  res.json({ user: publicUser(updated!) });
});

// Permanently deletes the account and everything linked to it (ON DELETE CASCADE).
meRouter.delete("/", async (req, res) => {
  const user = currentUser(req);
  await query("DELETE FROM users WHERE id = $1", [user.id]);
  res.status(204).end();
});
