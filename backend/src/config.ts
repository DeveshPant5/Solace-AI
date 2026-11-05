const env = process.env;

function required(name: string, fallback?: string): string {
  const value = env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

const jwtSecret = required("JWT_SECRET", env.NODE_ENV === "production" ? undefined : "dev-only-secret-change-me");
if (env.NODE_ENV === "production" && jwtSecret === "change-me") {
  throw new Error("Set JWT_SECRET to a long random value before running in production");
}

export const config = {
  port: Number(env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "postgres://solace:solace@localhost:5433/solace"),
  jwtSecret,
  jwtExpiresIn: "30d" as const,
  anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
  claudeModel: env.CLAUDE_MODEL?.trim() || "claude-opus-5-5",
  chatEffort: (env.CHAT_EFFORT?.trim() || "low") as "low" | "medium" | "high" | "xhigh" | "max",
  // Pip's voice (ElevenLabs text to speech). Optional: without a key, /voice/speak answers 503 voice_off.
  elevenLabsApiKey: env.ELEVENLABS_API_KEY?.trim() || undefined,
  pipVoiceId: env.PIP_VOICE_ID?.trim() || "bIHbv24MWmeRgasZH58o", // premade "Will"
  elevenLabsModel: env.ELEVENLABS_MODEL?.trim() || "eleven_flash_v2_5",
};

export const aiEnabled = Boolean(config.anthropicApiKey);
export const voiceEnabled = Boolean(config.elevenLabsApiKey);
