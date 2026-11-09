import { createApp } from "./app.js";
import { aiEnabled, config, voiceEnabled } from "./config.js";
import { pool } from "./db.js";
import { beginShutdown } from "./lib/lifecycle.js";
import { migrate } from "./migrate.js";
import { openStreams } from "./routes/conversations.js";

/** A hosted database can take a few seconds to wake up: retry before giving up. */
async function migrateWithRetry(attempts = 10) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await migrate();
    } catch (err) {
      if (attempt >= attempts) throw err;
      const wait = Math.min(2_000 * attempt, 10_000);
      console.warn(`Database not ready (${(err as Error).message}); retrying in ${wait / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

await migrateWithRetry();
const server = createApp().listen(config.port, "0.0.0.0", () => {
  console.log(`Solace API listening on http://0.0.0.0:${config.port}`);
  console.log(aiEnabled ? `AI companion on (${config.claudeModel})` : "AI companion OFF: set ANTHROPIC_API_KEY in backend/.env to enable Sol");
  if (voiceEnabled) console.log("Pip's voice on (ElevenLabs)");
  if (config.trustProxy === 0 && config.isProduction) {
    console.warn("TRUST_PROXY is 0: if this runs behind a proxy (Render, Fly, a load balancer), set TRUST_PROXY=1 so rate limits see real client addresses.");
  }
});

let shuttingDown = false;
function shutdown(exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down…");
  // Chat streams stop writing, save what they have and tell the person to try again shortly.
  beginShutdown();
  server.close(() => {
    void pool.end().finally(() => process.exit(exitCode));
  });
  server.closeIdleConnections();
  // Give open streams a moment to finish politely, then close everything.
  setTimeout(() => {
    for (const res of openStreams) if (!res.writableEnded) res.end();
    server.closeAllConnections();
  }, 5_000).unref();
  setTimeout(() => process.exit(exitCode || 1), 10_000).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandled rejection:", reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason));
});
process.on("uncaughtException", (err) => {
  console.error(`[process] uncaught exception: ${err.name}: ${err.message}\n${err.stack ?? ""}`);
  shutdown(1);
});
