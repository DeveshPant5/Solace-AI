import { Router } from "express";
import { z } from "zod";
import { assistIntention, assistTone, isFocusId } from "../ai/onboarding.js";
import { rateLimit } from "../lib/rateLimit.js";
import { lineField, textField } from "../lib/text.js";

// Public (no account yet). Stateless: nothing is stored and the text is never logged.
// Spending is capped by the per-address limit here and the daily public budget (AI_PUBLIC_DAILY_REQUESTS).
export const onboardingRouter = Router();

const AssistInput = z.object({
  kind: z.enum(["intention", "tone"]),
  name: lineField(60).optional(),
  text: textField(300),
  focus: z.array(z.string().max(40)).max(10).optional(),
});

onboardingRouter.post("/assist", rateLimit({ limit: 30, windowMs: 10 * 60_000 }), async (req, res) => {
  const body = AssistInput.parse(req.body);
  const input = {
    name: body.name || undefined,
    text: body.text,
    focus: [...new Set(body.focus ?? [])].filter(isFocusId),
  };
  res.json(body.kind === "intention" ? await assistIntention(input) : await assistTone(input));
});
