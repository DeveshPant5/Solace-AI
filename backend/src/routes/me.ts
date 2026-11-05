import { Router } from "express";
import { z } from "zod";
import { currentUser, publicUser, safeTimezone, USER_COLUMNS, type UserRow } from "../auth.js";
import { query, queryOne } from "../db.js";
import { HttpError } from "../errors.js";

export const meRouter = Router();

meRouter.get("/", (req, res) => {
  res.json({ user: publicUser(currentUser(req)) });
});

const Patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  timezone: z.string().optional(),
  profile: z
    .object({
      focus: z.array(z.string().max(40)).max(10).optional(),
      intention: z.string().max(300).optional(),
      checkinTime: z.enum(["morning", "afternoon", "evening", "night"]).optional(),
    })
    .optional(),
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
  const timezone = body.timezone ? safeTimezone(body.timezone) : undefined;
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
  res.json({ user: publicUser(updated!) });
});

// Permanently deletes the account and everything linked to it (ON DELETE CASCADE).
meRouter.delete("/", async (req, res) => {
  const user = currentUser(req);
  await query("DELETE FROM users WHERE id = $1", [user.id]);
  res.status(204).end();
});
