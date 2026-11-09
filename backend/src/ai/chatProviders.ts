import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { aiProvider, config } from "../config.js";
import { recordAiOutput } from "../lib/budget.js";
import { anthropic, groq, groqReasoning, MODEL, withGroqModels } from "./client.js";

// One model request at a time, for Sol's tool loop (ai/companion.ts), behind the
// same small interface for each AI service.

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  /** Set when the model's arguments couldn't be read at all. */
  inputError?: string;
}

export interface ToolOutcome {
  id: string;
  content: string;
  isError: boolean;
}

export interface StepResult {
  toolCalls: ToolCall[];
  stop: "end" | "tool_use" | "max_tokens" | "refusal";
}

/** The step failed in a way worth one re-issue (a tool input the SDK couldn't parse). */
export class RetryableStepError extends Error {}

export interface ChatSession {
  /** Sends the conversation so far; `onText` gets the visible reply as it streams. */
  step(onText: (delta: string) => void): Promise<StepResult>;
  /** Appends the last step's tool calls and their results, ready for the next step. */
  addToolResults(results: ToolOutcome[]): void;
}

export interface SessionOptions {
  persona: string;
  /** The per-person block (changes every request). */
  context: string;
  /** Earlier turns, visible text only, alternating and starting with the person. */
  history: { role: "user" | "assistant"; content: string }[];
  tools: ToolSpec[];
  signal: AbortSignal;
}

/**
 * Per-provider sizing. Groq's free tier allows about 8,000 tokens a minute per
 * model, so prompts there are kept small, and once a reply is written Sol doesn't
 * spend another request just to acknowledge its tool results.
 */
export const chatProfile =
  aiProvider === "groq"
    ? { historyMessages: 12, historyChars: 5_000, contextMemories: 12, followUpAfterTools: false }
    : { historyMessages: 40, historyChars: 24_000, contextMemories: 40, followUpAfterTools: true };

export function createChatSession(opts: SessionOptions): ChatSession {
  if (aiProvider === "groq") return new GroqSession(opts);
  if (aiProvider === "anthropic") return new AnthropicSession(opts);
  throw new Error("AI is not configured");
}

// ---------- Claude ----------

class AnthropicSession implements ChatSession {
  private messages: Anthropic.Beta.BetaMessageParam[];
  private system: Anthropic.Beta.BetaTextBlockParam[];
  private tools: Anthropic.Beta.BetaTool[];
  private last: Anthropic.Beta.BetaMessage | null = null;

  constructor(private opts: SessionOptions) {
    this.messages = [...opts.history];
    this.system = [
      // The persona (with the tools before it) is identical for everyone, so it is cached;
      // the per-person block changes every request and comes after the breakpoint.
      { type: "text", text: opts.persona, cache_control: { type: "ephemeral" } },
      { type: "text", text: `About the person you're talking with:\n${opts.context}` },
    ];
    this.tools = opts.tools.map((t) => ({ ...t, input_schema: t.input_schema as Anthropic.Beta.BetaTool.InputSchema, eager_input_streaming: true }));
  }

  async step(onText: (delta: string) => void): Promise<StepResult> {
    const stream = anthropic!.beta.messages.stream(
      {
        model: MODEL,
        // Sol's replies are a few sentences; this leaves room for a long one plus thinking.
        max_tokens: 8192,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: config.chatEffort },
        system: this.system,
        tools: this.tools,
        messages: this.messages,
      },
      { timeout: 180_000, maxRetries: 1, signal: this.opts.signal },
    );
    stream.on("text", onText);
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
    } catch (err) {
      if (isToolJsonError(err)) throw new RetryableStepError((err as Error).message.split(" JSON:")[0]);
      throw err;
    }
    recordAiOutput(message.usage?.output_tokens);
    this.last = message;
    if (message.stop_reason === "refusal") return { toolCalls: [], stop: "refusal" };
    const toolCalls = message.content
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));
    return { toolCalls, stop: message.stop_reason === "max_tokens" ? "max_tokens" : toolCalls.length ? "tool_use" : "end" };
  }

  addToolResults(results: ToolOutcome[]) {
    if (!this.last) return;
    this.messages.push({ role: "assistant", content: this.last.content });
    this.messages.push({
      role: "user",
      content: results.map((r) => ({ type: "tool_result" as const, tool_use_id: r.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })),
    });
  }
}

/** Only a tool input the SDK couldn't parse is worth re-issuing; API errors and dropped connections are not. */
function isToolJsonError(err: unknown): boolean {
  return (
    err instanceof Anthropic.AnthropicError &&
    !(err instanceof Anthropic.APIError) &&
    err.message.startsWith("Unable to parse tool parameter JSON")
  );
}

// ---------- Groq (OpenAI-style chat completions) ----------

interface GroqRun {
  text: string;
  finish: string | null;
  calls: { id: string; name: string; args: string }[];
}

/** Groq rejects a tool call whose arguments don't match the tool's schema with a 400 "tool_use_failed". */
function isToolUseFailed(err: unknown): boolean {
  if (!(err instanceof Groq.BadRequestError)) return false;
  const code = (err.error as { error?: { code?: string } } | undefined)?.error?.code;
  return code === "tool_use_failed" || /tool call validation failed|tool_use_failed|failed to call a function/i.test(err.message);
}

class GroqSession implements ChatSession {
  private messages: ChatCompletionMessageParam[];
  private tools: ChatCompletionTool[];
  private lastAssistant: ChatCompletionMessageParam | null = null;

  constructor(private opts: SessionOptions) {
    this.messages = [
      { role: "system", content: `${opts.persona}\n\nAbout the person you're talking with:\n${opts.context}` },
      ...opts.history.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
    ];
    this.tools = opts.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  }

  async step(onText: (delta: string) => void): Promise<StepResult> {
    let wrote = false;
    const write = (delta: string) => {
      wrote = true;
      onText(delta);
    };
    let run: GroqRun;
    try {
      run = await this.run(write, "auto");
    } catch (err) {
      // The model produced a tool call Groq couldn't validate. If nothing reached the
      // person yet, ask again for a plain reply (a written-out suggestion is still caught).
      if (!isToolUseFailed(err) || wrote) throw err;
      console.warn("[ai:companion] tool call rejected by Groq; asking for a plain reply");
      run = await this.run(write, "none");
    }
    // Occasionally the model returns nothing at all: give it one more try.
    if (!run.text && run.calls.length === 0 && !wrote) run = await this.run(write, "auto");

    const toolCalls: ToolCall[] = run.calls.map((c) => {
      try {
        return { id: c.id, name: c.name, input: JSON.parse(c.args) as unknown };
      } catch {
        return { id: c.id, name: c.name, input: null, inputError: "The arguments were not valid JSON." };
      }
    });
    this.lastAssistant = {
      role: "assistant",
      content: run.text || null,
      ...(run.calls.length ? { tool_calls: run.calls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.args } })) } : {}),
    };
    return { toolCalls, stop: run.finish === "length" ? "max_tokens" : toolCalls.length ? "tool_use" : "end" };
  }

  /** One streamed request. */
  private async run(onText: (delta: string) => void, toolChoice: "auto" | "none"): Promise<GroqRun> {
    // Retrying or switching models here is safe: a failed request fails before any reply text has streamed.
    const stream = await withGroqModels([config.groqChatModel, ...config.groqChatFallbacks], (model) =>
      groq!.chat.completions.create(
        {
          model,
          messages: this.messages,
          tools: this.tools,
          tool_choice: toolChoice,
          stream: true,
          // A few sentences plus a little reasoning; kept modest because the free tier counts tokens per minute.
          max_completion_tokens: 2048,
          ...groqReasoning(model),
        },
        { timeout: 120_000, signal: this.opts.signal },
      ),
    );

    let text = "";
    let finish: string | null = null;
    const calls = new Map<number, { id: string; name: string; args: string }>();
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta;
      if (delta?.content) {
        text += delta.content;
        onText(delta.content);
      }
      for (const tc of delta?.tool_calls ?? []) {
        const current = calls.get(tc.index) ?? { id: "", name: "", args: "" };
        if (tc.id) current.id = tc.id;
        if (tc.function?.name) current.name += tc.function.name;
        if (tc.function?.arguments) current.args += tc.function.arguments;
        calls.set(tc.index, current);
      }
      if (choice?.finish_reason) finish = choice.finish_reason;
      if (chunk.x_groq?.usage) recordAiOutput(chunk.x_groq.usage.completion_tokens);
    }
    return {
      text,
      finish,
      calls: [...calls.entries()].map(([index, c]) => ({ ...c, id: c.id || `call_${index}`, args: c.args || "{}" })),
    };
  }

  addToolResults(results: ToolOutcome[]) {
    if (!this.lastAssistant) return;
    this.messages.push(this.lastAssistant);
    for (const r of results) {
      this.messages.push({ role: "tool", tool_call_id: r.id, content: r.isError ? `Error: ${r.content}` : r.content });
    }
  }
}
