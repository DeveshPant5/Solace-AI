// Imported first by tests that must never reach a real AI or voice service (and
// spend the free allowance), whatever keys backend/.env holds. Module imports run
// in order, so this sets the switches before config.ts reads them.
process.env.AI_DISABLED = "1";
process.env.VOICE_DISABLED = "1";
process.env.LOG_REQUESTS ??= "0";
