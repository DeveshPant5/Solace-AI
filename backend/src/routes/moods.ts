import { Router } from "express";
import { z } from "zod";
import { generateCheckinReply } from "../ai/analysis.js";
import { buildUserContext } from "../ai/context.js";
import { currentUser } from "../auth.js";
import { MOOD_LABELS } from "../content/catalog.js";
import { query, queryOne } from "../db.js";
import { recordActivity, XP } from "../lib/progress.js";

export const moodsRouter = Router();

const MoodInput = z.object({
  mood: z.number().int().min(1).max(5),
  emotions: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  note: z.string().trim().max(1000).optional(),
});

const FALLBACK_REPLIES: Record<number, { message: string; activity: string }> = {
  1: { message: "Thank you for being honest about a hard moment. You don't have to fix it right now. Want to slow things down together?", activity: "breathing_478" },
  2: { message: "Sounds like a heavy one. Noticing it is already a kind thing to do for yourself.", activity: "chat" },
  3: { message: "An okay day still counts. Is there one small thing that could make it a little lighter?", activity: "none" },
  4: { message: "Love that you're feeling good. What helped today? It's worth remembering.", activity: "journal" },
  5: { message: "That's wonderful. Soak it in for a moment. You earned this one.", activity: "none" },
};

moodsRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const body = MoodInput.parse(req.body);
  const entry = await queryOne<{ id: string; created_at: string }>(
    "INSERT INTO mood_entries (user_id, mood, emotions, note) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
    [user.id, body.mood, body.emotions, body.note || null],
  );
  const xp = await recordActivity(user.id, "mood_checkin", XP.mood_checkin, { mood: body.mood });
  // A new check-in should refresh today's AI suggestions.
  await query("DELETE FROM daily_cache WHERE user_id = $1 AND kind = 'daily'", [user.id]);

  const checkin = `${MOOD_LABELS[body.mood]}${body.emotions.length ? `, feeling ${body.emotions.join(", ")}` : ""}${
    body.note ? `. Note: "${body.note}"` : ""
  }`;
  const context = await buildUserContext(user);
  const reply = (await generateCheckinReply(context, checkin)) ?? FALLBACK_REPLIES[body.mood]!;
  res.status(201).json({ entry: { id: entry!.id, createdAt: entry!.created_at, ...body }, xp, reply });
});

moodsRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const rows = await query<{ id: string; mood: number; emotions: string[]; note: string | null; created_at: string }>(
    `SELECT id, mood, emotions, note, created_at FROM mood_entries
     WHERE user_id = $1 AND created_at > now() - make_interval(days => $2)
     ORDER BY created_at DESC`,
    [user.id, days],
  );
  res.json({
    entries: rows.map((r) => ({ id: r.id, mood: r.mood, emotions: r.emotions, note: r.note, createdAt: r.created_at })),
  });
});
