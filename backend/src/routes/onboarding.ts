import { Router } from "express";
import { z } from "zod";
import { assistIntention, assistTone, isFocusId } from "../ai/onboarding.js";
import { rateLimit } from "../lib/rateLimit.js";

// Public (no account yet). Stateless: nothing is stored and the text is never logged.
export const onboardingRouter = Router();

const AssistInput = z.object({
  kind: z.enum(["intention", "tone"]),
  name: z.string().trim().max(60).optional(),
  text: z.string().trim().max(300),
  focus: z.array(z.string().max(40)).max(10).optional(),
});

onboardingRouter.post("/assist", rateLimit({ limit: 30, windowMs: 10 * 60_000 }), async (req, res) => {
  const body = AssistInput.parse(req.body);
  const input = {
    name: body.name?.replace(/\s+/g, " ") || undefined,
    text: body.text,
    focus: [...new Set(body.focus ?? [])].filter(isFocusId),
  };
  res.json(body.kind === "intention" ? await assistIntention(input) : await assistTone(input));
});
