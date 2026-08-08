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

export async function askOpenRouter(messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> {
  const client = getClient();
  const completion = await client.chat.completions.create(
    {
      model: env.OPENROUTER_MODEL_ID,
      messages,
      temperature: 0.3,
    },
    { timeout: REQUEST_TIMEOUT_MS }
  );

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }
  return content;
}
