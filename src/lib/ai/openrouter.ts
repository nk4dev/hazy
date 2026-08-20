import OpenAI from "openai";
import { env } from "@/lib/env";

let cached: OpenAI | null = null;

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

const REQUEST_TIMEOUT_MS = 20_000;

function extractMessage(completion: OpenAI.Chat.ChatCompletion): OpenAI.Chat.ChatCompletionMessage {
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
  return message;
}

/** Single non-streaming call, optionally offering tools for the model to
 * invoke. Returns the raw response message (content and/or tool_calls) —
 * callers that need a tool-calling loop drive it themselves by feeding
 * tool results back in as `role: "tool"` messages and calling again. */
export async function createChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: { tools?: OpenAI.Chat.ChatCompletionTool[] } = {}
): Promise<OpenAI.Chat.ChatCompletionMessage> {
  const client = getClient();
  const completion = await client.chat.completions.create(
    {
      model: env.OPENROUTER_MODEL_ID,
      messages,
      temperature: 0.3,
      ...(options.tools ? { tools: options.tools, tool_choice: "auto" as const } : {}),
    },
    { timeout: REQUEST_TIMEOUT_MS }
  );
  return extractMessage(completion);
}

export async function askOpenRouter(
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): Promise<string> {
  const message = await createChatCompletion(messages);
  const content = message.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }
  return content;
}
