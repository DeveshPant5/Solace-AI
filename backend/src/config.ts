import { z } from "zod";

// All settings come from the environment and are checked once, at startup, so a
// typo fails loudly here instead of breaking requests later.

const env = process.env;
const isProduction = env.NODE_ENV === "production";

function fail(message: string): never {
  throw new Error(`Configuration error: ${message}`);
}

/** Reads an optional value, treating an empty string as unset. */
function read(name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function parse<T extends z.ZodType>(name: string, schema: T, fallback: z.input<T>): z.infer<T> {
  const result = schema.safeParse(read(name) ?? fallback);
  if (!result.success) fail(`${name} is invalid: ${result.error.issues[0]?.message ?? "bad value"}`);
  return result.data;
}

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._\/:-]{2,100}$/;
const modelList = z
  .string()
  .transform((v) => v.split(",").map((m) => m.trim()).filter(Boolean))
  .pipe(z.array(z.string().regex(MODEL_ID, "expected Groq model ids, comma-separated")));
const idList = z
  .string()
  .transform((v) => v.split(",").map((id) => id.trim()).filter(Boolean))
  .pipe(z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,200}$/, "expected ids, comma-separated")));
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const flag = z.enum(["0", "1", "true", "false"]).transform((v) => v === "1" || v === "true");

// ---------- Login tokens ----------

// No built-in fallback: a secret that is public (in this repo) would let anyone sign tokens.
const PLACEHOLDER_SECRETS = new Set(["change-me", "dev-only-secret-change-me", "secret", "changeme"]);
const jwtSecret = read("JWT_SECRET");
if (!jwtSecret) {
  fail(
    "JWT_SECRET is not set. Generate one with\n" +
      "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"\n" +
      "and put it in backend/.env as JWT_SECRET=...",
  );
}
if (PLACEHOLDER_SECRETS.has(jwtSecret) || jwtSecret.length < 32) {
  fail("JWT_SECRET must be a long random value (at least 32 characters), not a placeholder");
}

// ---------- Database ----------

const databaseUrl = read("DATABASE_URL") ?? (isProduction ? undefined : "postgres://solace:solace@localhost:5433/solace");
if (!databaseUrl) fail("DATABASE_URL is required when NODE_ENV=production");

// ---------- Browser origins (CORS) ----------

// The phone app sends no Origin header and is never affected. Browsers are: in
// development any origin may call the API (Expo web preview); in production only
// the origins listed in CORS_ORIGINS.
const corsRaw = read("CORS_ORIGINS");
const corsOrigins: "*" | string[] =
  corsRaw === "*" || (!corsRaw && !isProduction)
    ? "*"
    : (corsRaw ?? "")
        .split(",")
        .map((o) => o.trim().replace(/\/$/, ""))
        .filter(Boolean);

export const config = {
  isProduction,
  port: parse("PORT", int(1, 65535), "4000"),
  databaseUrl,
  jwtSecret,
  jwtExpiresIn: "30d" as const,
  /**
   * How many reverse proxies sit in front of the API (Render: 1). 0 means none,
   * so the client address is the socket address and X-Forwarded-For is ignored.
   */
  trustProxy: parse("TRUST_PROXY", int(0, 10), "0"),
  corsOrigins,
  logRequests: parse("LOG_REQUESTS", flag, "1"),

  // ---------- AI provider ----------
  /** "auto" uses Groq when GROQ_API_KEY is set, otherwise Claude when ANTHROPIC_API_KEY is set. */
  aiProviderSetting: parse("AI_PROVIDER", z.enum(["auto", "groq", "anthropic"]), "auto"),

  // ---------- Groq (open models, free tier) ----------
  groqApiKey: read("GROQ_API_KEY"),
  /** Luma's chat. Needs tool use; gpt-oss-120b also has the largest free daily allowance. */
  groqChatModel: parse("GROQ_CHAT_MODEL", z.string().regex(MODEL_ID, "expected a Groq model id"), "openai/gpt-oss-120b"),
  /** Short structured jobs (mood signal, titles, daily card, Pip's help). Free limits are per model, so this spreads the load. */
  groqFastModel: parse("GROQ_FAST_MODEL", z.string().regex(MODEL_ID, "expected a Groq model id"), "openai/gpt-oss-20b"),
  /**
   * Tried in order when a model hits its free limit (each model has its own allowance),
   * so Luma keeps talking when one is used up. Comma-separated; empty for none.
   */
  groqChatFallbacks: parse("GROQ_CHAT_FALLBACK_MODELS", modelList, "qwen/qwen3.8-27b,openai/gpt-oss-20b"),
  groqFastFallbacks: parse("GROQ_FAST_FALLBACK_MODELS", modelList, "qwen/qwen3.8-27b"),

  // ---------- Claude ----------
  anthropicApiKey: read("ANTHROPIC_API_KEY"),
  claudeModel: parse("CLAUDE_MODEL", z.string().regex(/^claude-[a-z0-9.-]+$/, "expected a Claude model id"), "claude-opus-5-5"),
  chatEffort: parse("CHAT_EFFORT", z.enum(["low", "medium", "high", "xhigh", "max"]), "low"),
  /** Emergency switch: turns every AI call off (offline content is used) without removing the key. */
  aiDisabled: parse("AI_DISABLED", flag, "0"),

  // ---------- Pip's voice (ElevenLabs) ----------
  elevenLabsApiKey: read("ELEVENLABS_API_KEY"),
  /**
   * Pip's ElevenLabs voice. Default: premade "Jessica" (young, bright and warm), which
   * suits a little seedling better than a deep adult voice. Try others in ElevenLabs'
   * Text to Speech page and put the chosen voice's id here.
   */
  pipVoiceId: parse("PIP_VOICE_ID", z.string().regex(/^[A-Za-z0-9]{8,40}$/, "expected an ElevenLabs voice id"), "cgSgspJ2msm6clMCkdW9"),
  elevenLabsModel: parse("ELEVENLABS_MODEL", z.string().regex(/^[a-z0-9_]{3,60}$/, "expected an ElevenLabs model id"), "eleven_flash_v2_5"),
  voiceDisabled: parse("VOICE_DISABLED", flag, "0"),
  voiceCacheMaxMb: parse("VOICE_CACHE_MAX_MB", int(10, 100_000), "200"),
  /** Where Pip's clips are cached (default backend/.cache/voice). */
  voiceCacheDir: read("VOICE_CACHE_DIR"),
  /** ElevenLabs API address (overridable for tests). */
  elevenLabsBaseUrl: parse("ELEVENLABS_BASE_URL", z.url(), "https://api.elevenlabs.io"),

  // ---------- Sign in with Google / Apple ----------
  /**
   * OAuth client ids whose Google ID tokens are accepted (the token's `aud`). The app
   * asks for tokens for its Web client id, so that one is enough; list it first, because
   * GET /auth/providers hands the first id to the app. Empty turns Google off.
   */
  googleClientIds: parse("GOOGLE_CLIENT_IDS", idList, ""),
  /** Apple's `aud` is the iOS bundle id (add host.exp.Exponent to test in Expo Go). */
  appleAudiences: parse("APPLE_AUDIENCES", idList, "com.solace.companion"),
  /** Where the providers publish their signing keys (overridable for tests). */
  googleJwksUrl: parse("GOOGLE_JWKS_URL", z.url(), "https://www.googleapis.com/oauth2/v3/certs"),
  appleJwksUrl: parse("APPLE_JWKS_URL", z.url(), "https://appleid.apple.com/auth/keys"),

  // ---------- Spending limits (per server process, reset at midnight UTC) ----------
  budget: {
    /** Anthropic requests per day, all features together. */
    aiDailyRequests: parse("AI_DAILY_REQUESTS", int(0, 10_000_000), "2000"),
    /** Anthropic output tokens per day (includes thinking). */
    aiDailyOutputTokens: parse("AI_DAILY_OUTPUT_TOKENS", int(0, 1_000_000_000), "1500000"),
    /** Anthropic requests per day from the public onboarding helper (no account yet). */
    aiPublicDailyRequests: parse("AI_PUBLIC_DAILY_REQUESTS", int(0, 10_000_000), "300"),
    /** Anthropic requests per person per day (chat turns and AI suggestions). */
    aiUserDailyRequests: parse("AI_USER_DAILY_REQUESTS", int(0, 100_000), "250"),
    /** ElevenLabs characters per day (cached clips are free and don't count). */
    voiceDailyChars: parse("VOICE_DAILY_CHARS", int(0, 100_000_000), "20000"),
  },
};

function pickProvider(): "groq" | "anthropic" | null {
  const setting = config.aiProviderSetting;
  if (setting === "groq") {
    if (!config.groqApiKey) fail("AI_PROVIDER=groq needs GROQ_API_KEY");
    return "groq";
  }
  if (setting === "anthropic") {
    if (!config.anthropicApiKey) fail("AI_PROVIDER=anthropic needs ANTHROPIC_API_KEY");
    return "anthropic";
  }
  return config.groqApiKey ? "groq" : config.anthropicApiKey ? "anthropic" : null;
}

/** Which AI service powers Luma and the AI suggestions, or null when AI is off (offline content is used). */
export const aiProvider = config.aiDisabled ? null : pickProvider();
export const aiEnabled = aiProvider !== null;
/** For logs: the model that writes Luma's replies. */
export const aiChatModel =
  aiProvider === "groq" ? `${config.groqChatModel} on Groq` : aiProvider === "anthropic" ? `${config.claudeModel} (Anthropic)` : null;
export const voiceEnabled = Boolean(config.elevenLabsApiKey) && !config.voiceDisabled;
