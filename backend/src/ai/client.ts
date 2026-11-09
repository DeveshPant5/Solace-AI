import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Groq from "groq-sdk";
import { z } from "zod";
import { aiProvider, config } from "../config.js";
import { aiAllowed, recordAiOutput, recordAiRequest, type AiCaller } from "../lib/budget.js";

// The AI service is chosen at startup (see AI_PROVIDER in config.ts): Groq's
// open models, or Claude. Both clients use one retry and a bounded wait, so an
// outage falls back to offline content quickly instead of holding requests open.
export const anthropic =
  aiProvider === "anthropic" ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: 60_000, maxRetries: 1 }) : null;
// Groq's SDK waits however long a 429's retry-after says (hours, once the free daily allowance is used up),
// so its own retries are off and withGroqRetry() below retries only short waits.
export const groq = aiProvider === "groq" ? new Groq({ apiKey: config.groqApiKey, timeout: 60_000, maxRetries: 0 }) : null;

/** Waits longer than this aren't worth holding a request open for. */
const MAX_RETRY_WAIT_MS = 5_000;

/**
 * Runs a Groq request with one retry: after a short rate-limit wait (at most a few
 * seconds), a server error or a dropped connection. Anything else fails at once.
 */
export async function withGroqRetry<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    const wait = retryWaitMs(err);
    if (wait === null) throw err;
    await new Promise((resolve) => setTimeout(resolve, wait));
    return request();
  }
}

function retryWaitMs(err: unknown): number | null {
  if (err instanceof Groq.APIUserAbortError) return null;
  if (err instanceof Groq.RateLimitError) {
    const seconds = Number(err.headers?.get("retry-after") ?? NaN);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : 1_000;
    return ms <= MAX_RETRY_WAIT_MS ? ms : null;
  }
  if (err instanceof Groq.APIConnectionError || (err instanceof Groq.APIError && (err.status ?? 0) >= 500)) return 500;
  return null;
}
export const MODEL = config.claudeModel;

/** Per-call wait for the short structured calls that sit on a request's path. */
const STRUCTURED_TIMEOUT_MS = 30_000;

/**
 * One structured-output call. Returns null (so callers use offline content)
 * when AI is off, today's budget is used up, the model declines, or the call fails.
 */
export async function structured<T extends z.ZodType>(
  schema: T,
  system: string,
  prompt: string,
  label: string,
  caller: AiCaller = {},
): Promise<z.infer<T> | null> {
  if (!aiProvider || !aiAllowed(caller)) return null;
  recordAiRequest(caller);
  try {
    return aiProvider === "groq"
      ? await structuredGroq(schema, system, prompt, label)
      : await structuredAnthropic(schema, system, prompt, label);
  } catch (err) {
    logAiError(label, err);
    return null;
  }
}

async function structuredAnthropic<T extends z.ZodType>(schema: T, system: string, prompt: string, label: string) {
  const response = await anthropic!.messages.parse(
    {
      model: MODEL,
      max_tokens: 4096,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: prompt }],
    },
    { timeout: STRUCTURED_TIMEOUT_MS },
  );
  recordAiOutput(response.usage?.output_tokens);
  if (response.stop_reason === "refusal") {
    console.warn(`[ai:${label}] declined`, response.stop_details?.category ?? "");
    return null;
  }
  if (response.stop_reason === "max_tokens") console.warn(`[ai:${label}] hit max_tokens`);
  return (response.parsed_output ?? null) as z.infer<T> | null;
}

async function structuredGroq<T extends z.ZodType>(schema: T, system: string, prompt: string, label: string) {
  const model = config.groqFastModel;
  const jsonSchema = strictJsonSchema(schema);
  const strict = supportsStrictJson(model);
  const response = await withGroqRetry(() =>
    groq!.chat.completions.create(
      {
        model,
        messages: [
          {
            role: "system",
            content: strict ? system : `${system}\n\nReply with only a JSON object that matches this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
          },
          { role: "user", content: prompt },
        ],
        response_format: strict
          ? { type: "json_schema", json_schema: { name: label.replace(/\W+/g, "_"), strict: true, schema: jsonSchema } }
          : { type: "json_object" },
        max_completion_tokens: 1500,
        ...groqReasoning(model),
      },
      { timeout: STRUCTURED_TIMEOUT_MS },
    ),
  );
  recordAiOutput(response.usage?.completion_tokens);
  const choice = response.choices[0];
  if (choice?.finish_reason === "length") console.warn(`[ai:${label}] hit max_completion_tokens`);
  let json: unknown;
  try {
    json = JSON.parse(choice?.message.content ?? "");
  } catch {
    console.warn(`[ai:${label}] reply wasn't valid JSON`);
    return null;
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.warn(`[ai:${label}] reply didn't match the schema: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    return null;
  }
  return parsed.data as z.infer<T>;
}

// ---------- Groq helpers ----------

/** Models that support Groq's strict (constrained) JSON Schema output; others use JSON object mode. */
function supportsStrictJson(model: string) {
  return /^(openai\/gpt-oss-(20b|120b)|qwen\/qwen3|meta-models\/muse-spark)/.test(model);
}

/**
 * Reasoning settings per model family: gpt-oss thinks a little and keeps it to
 * itself (reasoning tokens count against the free limits); other models get no
 * reasoning parameters, since they would reject them.
 */
export function groqReasoning(model: string): { reasoning_effort?: "none" | "low"; include_reasoning?: boolean } {
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: "low", include_reasoning: false };
  if (model.startsWith("qwen/")) return { reasoning_effort: "none" };
  return {};
}

/** The zod schema as JSON Schema for strict mode (every field required, no extras), minus keys strict mode doesn't use. */
function strictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$schema" || key === "default") continue;
      out[key] = strip(value);
    }
    return out;
  };
  return strip(z.toJSONSchema(schema, { io: "output", unrepresentable: "any" })) as Record<string, unknown>;
}

// ---------- Errors ----------

/**
 * What kind of failure this was, so the person can be told something useful:
 * "busy" (too many requests this minute), "daily_limit" (today's free allowance
 * is used up), or "other".
 */
export function aiErrorKind(err: unknown): "busy" | "daily_limit" | "other" {
  const rateLimited =
    err instanceof Anthropic.RateLimitError || err instanceof Groq.RateLimitError || (err as { status?: number } | null)?.status === 429;
  if (!rateLimited) return "other";
  const headers = (err as { headers?: Headers }).headers;
  const retryAfter = Number(headers?.get?.("retry-after") ?? NaN);
  const requestsLeft = headers?.get?.("x-ratelimit-remaining-requests");
  // Groq's request allowance is per day: none left, or a long wait, means the day's allowance is gone.
  if (requestsLeft === "0" || (Number.isFinite(retryAfter) && retryAfter > 300)) return "daily_limit";
  return "busy";
}

/** Logs an AI failure without the request or response content (which can hold personal details). */
export function logAiError(label: string, err: unknown) {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Groq.AuthenticationError) {
    const key = err instanceof Groq.AuthenticationError ? "GROQ_API_KEY" : "ANTHROPIC_API_KEY";
    console.error(`[ai:${label}] the AI service rejected the API key. Check ${key} in backend/.env.`);
  } else if (aiErrorKind(err) !== "other") {
    console.error(`[ai:${label}] rate limited (${aiErrorKind(err) === "daily_limit" ? "daily allowance used up" : "too many requests this minute"})`);
  } else if (err instanceof Anthropic.APIError || err instanceof Groq.APIError) {
    console.error(`[ai:${label}] API error ${err.status ?? ""}: ${err.message.slice(0, 300)}`);
  } else if (err instanceof Error) {
    // SDK parse errors append the raw tool JSON after " JSON:"; keep only the description.
    console.error(`[ai:${label}] ${err.name}: ${err.message.split(" JSON:")[0]!.slice(0, 300)}`);
  } else {
    console.error(`[ai:${label}] ${String(err).slice(0, 300)}`);
  }
}
