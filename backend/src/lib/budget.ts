import { config } from "../config.js";

// Daily spending limits for the paid upstreams (Anthropic and ElevenLabs).
// Counters live in this process and reset at midnight UTC. They are a safety
// net against abuse and runaway loops, not billing: also set a monthly spend
// limit in the Anthropic and ElevenLabs dashboards.

const utcDay = () => new Date().toISOString().slice(0, 10);

class DailyCounters {
  private day = utcDay();
  private counts = new Map<string, number>();
  private warned = new Set<string>();

  private roll() {
    const today = utcDay();
    if (today !== this.day) {
      this.day = today;
      this.counts.clear();
      this.warned.clear();
    }
  }

  get(key: string) {
    this.roll();
    return this.counts.get(key) ?? 0;
  }

  add(key: string, n = 1) {
    this.roll();
    this.counts.set(key, (this.counts.get(key) ?? 0) + n);
  }

  /** Logs once per day per key. */
  warnOnce(key: string, message: string) {
    this.roll();
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(message);
  }
}

const counters = new DailyCounters();

export interface AiCaller {
  /** The signed-in person the call is for, if any. */
  userId?: string;
  /** True for the public onboarding helper (no account yet). */
  publicCall?: boolean;
}

/** Whether one more Anthropic request fits today's limits. */
export function aiAllowed(caller: AiCaller = {}): boolean {
  const b = config.budget;
  if (counters.get("ai:requests") >= b.aiDailyRequests) {
    counters.warnOnce("ai:requests", `[budget] daily Anthropic request limit (${b.aiDailyRequests}) reached; using offline content until midnight UTC`);
    return false;
  }
  if (counters.get("ai:output") >= b.aiDailyOutputTokens) {
    counters.warnOnce("ai:output", `[budget] daily Anthropic output-token limit (${b.aiDailyOutputTokens}) reached; using offline content until midnight UTC`);
    return false;
  }
  if (caller.publicCall && counters.get("ai:public") >= b.aiPublicDailyRequests) {
    counters.warnOnce("ai:public", `[budget] daily limit for the public onboarding helper (${b.aiPublicDailyRequests}) reached`);
    return false;
  }
  if (caller.userId && counters.get(`ai:user:${caller.userId}`) >= b.aiUserDailyRequests) {
    counters.warnOnce(`ai:user:${caller.userId}`, `[budget] one account reached its daily AI limit (${b.aiUserDailyRequests})`);
    return false;
  }
  return true;
}

/** Counts one Anthropic request (call just before sending it). */
export function recordAiRequest(caller: AiCaller = {}) {
  counters.add("ai:requests");
  if (caller.publicCall) counters.add("ai:public");
  if (caller.userId) counters.add(`ai:user:${caller.userId}`);
}

/** Adds the output tokens a response used (thinking included). */
export function recordAiOutput(tokens: number | null | undefined) {
  if (tokens && tokens > 0) counters.add("ai:output", tokens);
}

/** Whether a clip of `chars` characters fits today's ElevenLabs limit. */
export function voiceAllowed(chars: number): boolean {
  const limit = config.budget.voiceDailyChars;
  if (counters.get("voice:chars") + chars > limit) {
    counters.warnOnce("voice:chars", `[budget] daily ElevenLabs character limit (${limit}) reached; Pip uses the device voice until midnight UTC`);
    return false;
  }
  return true;
}

export function recordVoice(chars: number) {
  counters.add("voice:chars", chars);
}
