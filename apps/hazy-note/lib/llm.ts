// Thin OpenRouter client. Every "AI" surface in the app (summaries, tag
// suggestions, the tendency analysis, the export draft) goes through here.
// Configure it in .env.local:
//
//   OPENROUTER_API_KEY   — required for any AI output
//   OPENROUTER_MODEL_ID  — e.g. "mistralai/mistral-small-2603"
//   OPENROUTER_SITE_URL  — sent as HTTP-Referer (OpenRouter attribution)
//   OPENROUTER_APP_NAME  — sent as X-Title
//
// When the key is missing or a call fails, callers fall back to a small
// deterministic stand-in so the app keeps working offline.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export function llmConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

export class LLMError extends Error {}

/** One chat completion. Throws LLMError on any non-success. */
export async function chat(
  messages: Msg[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new LLMError("OPENROUTER_API_KEY is not set");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Hazy",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL_ID ?? "mistralai/mistral-small-2603",
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1200,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (e) {
    throw new LLMError(`request failed: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LLMError(`openrouter ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new LLMError("empty completion");
  return text;
}

/**
 * Chat completion parsed as JSON. Tolerates models that wrap the object in
 * prose or ```json fences. Throws LLMError if nothing parses.
 */
export async function chatJSON<T>(
  messages: Msg[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  const raw = await chat(messages, { ...opts, json: true });
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new LLMError(`could not parse JSON from: ${cleaned.slice(0, 300)}`);
  }
}
