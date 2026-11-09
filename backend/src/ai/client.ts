import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { aiEnabled, config } from "../config.js";
import { aiAllowed, recordAiOutput, recordAiRequest, type AiCaller } from "../lib/budget.js";

// One retry (the SDK default is two) and a bounded wait, so an outage falls back
// to offline content quickly instead of holding requests open for minutes.
export const anthropic = aiEnabled
  ? new Anthropic({ apiKey: config.anthropicApiKey, timeout: 60_000, maxRetries: 1 })
  : null;
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
  if (!anthropic || !aiAllowed(caller)) return null;
  recordAiRequest(caller);
  try {
    const response = await anthropic.messages.parse(
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
    return response.parsed_output ?? null;
  } catch (err) {
    logAiError(label, err);
    return null;
  }
}

/** Logs an AI failure without the request or response content (which can hold personal details). */
export function logAiError(label: string, err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error(`[ai:${label}] Anthropic rejected the API key. Check ANTHROPIC_API_KEY in backend/.env.`);
  } else if (err instanceof Anthropic.RateLimitError) {
    console.error(`[ai:${label}] rate limited`);
  } else if (err instanceof Anthropic.APIError) {
    console.error(`[ai:${label}] API error ${err.status ?? ""}: ${err.message.slice(0, 300)}`);
  } else if (err instanceof Error) {
    // SDK parse errors append the raw tool JSON after " JSON:"; keep only the description.
    console.error(`[ai:${label}] ${err.name}: ${err.message.split(" JSON:")[0]!.slice(0, 300)}`);
  } else {
    console.error(`[ai:${label}] ${String(err).slice(0, 300)}`);
  }
}
