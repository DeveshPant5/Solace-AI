import cors from "cors";
import express from "express";
import { requireAuth } from "./auth.js";
import { aiEnabled, config, voiceEnabled } from "./config.js";
import { databaseReachable } from "./db.js";
import { errorHandler, notFound } from "./errors.js";
import { requestContext, securityHeaders } from "./lib/http.js";
import { userRateLimit } from "./lib/rateLimit.js";
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
  // Only trust X-Forwarded-For when a known number of proxies sits in front (TRUST_PROXY).
  // Trusting it without a proxy would let any client pick its own address and dodge rate limits.
  app.set("trust proxy", config.trustProxy > 0 ? config.trustProxy : false);

  app.use(requestContext);
  app.use(securityHeaders);
  app.use(
    cors({
      origin: config.corsOrigins === "*" ? "*" : config.corsOrigins,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Authorization", "Content-Type", "Range"],
      exposedHeaders: ["Retry-After", "X-Request-Id"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", async (_req, res) => {
    const db = await databaseReachable();
    res.status(db ? 200 : 503).json({ ok: db, db: db ? "up" : "down", ai: aiEnabled, voice: voiceEnabled });
  });

  // Everything a signed-in person does, together: generous for real use, a ceiling for scripts.
  const signedIn = [requireAuth, userRateLimit({ limit: 600, windowMs: 10 * 60_000 })];

  app.use("/auth", authRouter);
  app.use("/onboarding", onboardingRouter); // public: used before sign-up
  app.use("/voice", voiceRouter); // public: Pip's voice (onboarding and in-app tips)
  app.use("/me", signedIn, meRouter);
  app.use("/home", signedIn, homeRouter);
  app.use("/moods", signedIn, moodsRouter);
  app.use("/assessments", signedIn, assessmentsRouter);
  app.use("/conversations", signedIn, conversationsRouter);
  app.use("/progress", signedIn, progressRouter);
  app.use("/activities", signedIn, activitiesRouter);
  app.use("/journal", signedIn, journalRouter);
  app.use("/memories", signedIn, memoriesRouter);
  app.use("/reminders", signedIn, remindersRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
