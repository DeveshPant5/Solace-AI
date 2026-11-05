import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { aiEnabled, config } from "../config.js";

export const anthropic = aiEnabled ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;
export const MODEL = config.claudeModel;

/**
 * One structured-output call. Returns null (so callers use offline content)
 * when AI is off, the model declines, or the call fails.
 */
export async function structured<T extends z.ZodType>(
  schema: T,
  system: string,
  prompt: string,
  label: string,
): Promise<z.infer<T> | null> {
  if (!anthropic) return null;
  try {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") {
      console.warn(`[ai:${label}] declined`, response.stop_details?.category ?? "");
      return null;
    }
    return response.parsed_output ?? null;
  } catch (err) {
    logAiError(label, err);
    return null;
  }
}

export function logAiError(label: string, err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error(`[ai:${label}] Anthropic rejected the API key. Check ANTHROPIC_API_KEY in backend/.env.`);
  } else if (err instanceof Anthropic.RateLimitError) {
    console.error(`[ai:${label}] rate limited`);
  } else if (err instanceof Anthropic.APIError) {
    console.error(`[ai:${label}] API error ${err.status}: ${err.message}`);
  } else {
    console.error(`[ai:${label}]`, err);
  }
}
