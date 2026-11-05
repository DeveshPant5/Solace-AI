import { Router } from "express";
import { z } from "zod";
import { generateMoves } from "../ai/analysis.js";
import { buildUserContext } from "../ai/context.js";
import { currentUser } from "../auth.js";
import { ASSESSMENTS, FALLBACK_MOVES, scoreAssessment, type AssessmentKind } from "../content/assessments.js";
import { query, queryOne } from "../db.js";
import { HttpError } from "../errors.js";
import { recordActivity, XP } from "../lib/progress.js";

export const assessmentsRouter = Router();

assessmentsRouter.get("/catalog", (_req, res) => {
  res.json({
    assessments: Object.values(ASSESSMENTS).map((a) => ({
      kind: a.kind,
      title: a.title,
      subtitle: a.subtitle,
      intro: a.intro,
      questions: a.questions,
      options: a.options,
      xpPerQuestion: XP.assessment_question,
      bonusXp: XP.assessment_bonus,
    })),
  });
});

const Submit = z.object({
  kind: z.enum(["mood", "anxiety", "kindness"]),
  answers: z.array(z.number().int().min(0).max(3)),
});

assessmentsRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const body = Submit.parse(req.body);
  const def = ASSESSMENTS[body.kind];
  if (body.answers.length !== def.questions.length) {
    throw new HttpError(400, `Expected ${def.questions.length} answers`, "invalid_input");
  }
  const { score, maxScore, band } = scoreAssessment(def, body.answers);
  const summary =
    `They just completed the ${def.title} (${def.intro}).\n` +
    def.questions.map((q, i) => `- ${q}: ${def.options[body.answers[i]!]}`).join("\n") +
    `\nResult: ${band.label} (${score}/${maxScore}). ${band.summary}`;
  const context = await buildUserContext(user);
  const moves = (await generateMoves(context, summary)) ?? FALLBACK_MOVES[def.kind][band.band] ?? [];

  const row = await queryOne<{ id: string; created_at: string }>(
    `INSERT INTO assessments (user_id, kind, answers, score, max_score, band, moves)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
    [user.id, def.kind, body.answers, score, maxScore, band.band, JSON.stringify(moves)],
  );
  const xp = await recordActivity(
    user.id,
    "assessment",
    def.questions.length * XP.assessment_question + XP.assessment_bonus,
    { kind: def.kind, band: band.band },
  );
  await query("DELETE FROM daily_cache WHERE user_id = $1 AND kind = 'daily'", [user.id]);
  res.status(201).json({
    result: {
      id: row!.id,
      kind: def.kind,
      title: def.title,
      score,
      maxScore,
      band: band.band,
      label: band.label,
      summary: band.summary,
      moves,
      createdAt: row!.created_at,
    },
    xp,
  });
});

assessmentsRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const rows = await query<{
    id: string;
    kind: AssessmentKind;
    score: number;
    max_score: number;
    band: string;
    created_at: string;
  }>(
    "SELECT id, kind, score, max_score, band, created_at FROM assessments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 60",
    [user.id],
  );
  res.json({
    results: rows.map((r) => {
      const def = ASSESSMENTS[r.kind];
      const band = def.bands.find((b) => b.band === r.band);
      return {
        id: r.id,
        kind: r.kind,
        title: def.title,
        score: r.score,
        maxScore: r.max_score,
        band: r.band,
        label: band?.label ?? r.band,
        createdAt: r.created_at,
      };
    }),
  });
});
