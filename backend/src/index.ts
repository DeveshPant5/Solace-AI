import { createApp } from "./app.js";
import { aiEnabled, config } from "./config.js";
import { pool } from "./db.js";
import { migrate } from "./migrate.js";

await migrate();
const server = createApp().listen(config.port, "0.0.0.0", () => {
  console.log(`Solace API listening on http://0.0.0.0:${config.port}`);
  console.log(
    aiEnabled
      ? `AI companion on (${config.claudeModel})`
      : "AI companion OFF: set ANTHROPIC_API_KEY in backend/.env to enable Sol",
  );
});

function shutdown() {
  server.close(() => void pool.end().then(() => process.exit(0)));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
