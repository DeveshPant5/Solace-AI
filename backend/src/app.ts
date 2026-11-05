import cors from "cors";
import express from "express";
import { requireAuth } from "./auth.js";
import { aiEnabled, config, voiceEnabled } from "./config.js";
import { errorHandler, notFound } from "./errors.js";
import { assessmentsRouter } from "./routes/assessments.js";
import { authRouter } from "./routes/auth.js";
import { conversationsRouter } from "./routes/conversations.js";
import { homeRouter } from "./routes/home.js";
import { meRouter } from "./routes/me.js";
import { activitiesRouter, journalRouter, memoriesRouter, remindersRouter } from "./routes/misc.js";
import { moodsRouter } from "./routes/moods.js";
import { onboardingRouter } from "./routes/onboarding.js";
import { progressRouter } from "./routes/progress.js";
import { voiceRouter } from "./routes/voice.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ai: aiEnabled, model: aiEnabled ? config.claudeModel : null, voice: voiceEnabled });
  });

  app.use("/auth", authRouter);
  app.use("/onboarding", onboardingRouter); // public: used before sign-up
  app.use("/voice", voiceRouter); // public: Pip's voice (onboarding and in-app tips)
  app.use("/me", requireAuth, meRouter);
  app.use("/home", requireAuth, homeRouter);
  app.use("/moods", requireAuth, moodsRouter);
  app.use("/assessments", requireAuth, assessmentsRouter);
  app.use("/conversations", requireAuth, conversationsRouter);
  app.use("/progress", requireAuth, progressRouter);
  app.use("/activities", requireAuth, activitiesRouter);
  app.use("/journal", requireAuth, journalRouter);
  app.use("/memories", requireAuth, memoriesRouter);
  app.use("/reminders", requireAuth, remindersRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
