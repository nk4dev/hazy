import OpenAI from "openai";
import { env } from "@/env";

let cached: OpenAI | null = null;

export const DEFAULT_FREE_MODELS: readonly string[] = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-small-24b-instruct-2501:free",
];

/** Lazily built — never constructed at module load, so a missing
 * OPENROUTER_API_KEY never crashes the build or a keyless boot. */
function getClient(): OpenAI {
  if (!cached) {
    cached = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": env.OPENROUTER_SITE_URL,
        "X-Title": env.OPENROUTER_APP_NAME,
      },
    });
  }
  return cached;
}

export function resolveModels(options?: { model?: string; models?: string[] }): string[] {
  if (options?.models && options.models.length > 0) {
    return options.models;
  }
  const configuredFallbacks = env.OPENROUTER_FALLBACK_MODELS
    ? env.OPENROUTER_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
    : [];

  const fallbackList = configuredFallbacks.length > 0 ? configuredFallbacks : DEFAULT_FREE_MODELS;
  const primary = options?.model ?? env.OPENROUTER_MODEL_ID;

  // Ensure primary is first, then append fallbacks with deduplication
  return [primary, ...fallbackList.filter((m) => m !== primary)];
}

const REQUEST_TIMEOUT_MS = 20_000;

// OpenRouter's shared/free model routes frequently return a transient 429
// ("temporarily rate-limited upstream, retry shortly") or a provider 5xx. One
// short retry clears most of them without the caller falling back to canned
// keyword results.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503]);
const RETRY_DELAY_MS = 1_200;

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return typeof status === "number" && RETRYABLE_STATUS.has(status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ChatCompletionMessageWithModel = OpenAI.Chat.ChatCompletionMessage & {
  model?: string;
};

function extractMessage(
  completion: OpenAI.Chat.ChatCompletion
): ChatCompletionMessageWithModel {
  if (!completion.choices) {
    // OpenRouter returns HTTP 200 with an `{ error }` body (no `choices`)
    // for cases the SDK doesn't treat as a thrown error — a deprecated/
    // retired model, no provider currently serving it, rate limiting, etc.
    const errorMessage = (completion as { error?: { message?: string } }).error?.message;
    throw new Error(
      `OpenRouter returned no choices: ${errorMessage ?? JSON.stringify(completion)}`
    );
  }
  const message = completion.choices[0]?.message;
  if (!message) {
    throw new Error("OpenRouter returned no message.");
  }
  return Object.assign(message, { model: completion.model });
}

export type ChatCompletionOptions = {
  tools?: OpenAI.Chat.ChatCompletionTool[];
  model?: string;
  models?: string[];
  temperature?: number;
};

/** Single non-streaming call, optionally offering tools for the model to
 * invoke. Supports OpenRouter automated model fallback by passing an ordered
 * list of models via the OpenRouter `models` parameter. */
export async function createChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionMessageWithModel> {
  const client = getClient();
  const models = resolveModels(options);

  const body = {
    model: models[0],
    models,
    messages,
    temperature: options.temperature ?? 0.3,
    ...(options.tools ? { tools: options.tools, tool_choice: "auto" as const } : {}),
  };

  for (let attempt = 0; ; attempt++) {
    try {
      const completion = await client.chat.completions.create(body, {
        timeout: REQUEST_TIMEOUT_MS,
      });
      return extractMessage(completion);
    } catch (error) {
      if (attempt === 0 && isRetryable(error)) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw error;
    }
  }
}

export async function askOpenRouter(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: ChatCompletionOptions
): Promise<string> {
  const message = await createChatCompletion(messages, options);
  const content = message.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }
  return content;
}

/**
 * Asks a user prompt using free models with OpenRouter's sequential fallback.
 */
export async function askFreeModel(
  prompt: string,
  models?: string[]
): Promise<string> {
  const freeModels = models && models.length > 0 ? models : resolveModels();
  const message = await createChatCompletion(
    [{ role: "user", content: prompt }],
    { models: freeModels }
  );
  const content = message.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }
  return content;
}
