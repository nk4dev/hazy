// AI completions are centralized in `apps/api` (Hono Worker).
// hazy-note delegates all chat completions to apps/api's /v1/ai/chat.

import { auth } from "@clerk/nextjs/server";

const API_BASE_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8787";

export class LLMError extends Error {}

export function llmConfigured(): boolean {
  return true;
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function resolveAuthToken(): Promise<string | null> {
  try {
    const session = await auth();
    if (session?.getToken) {
      const token = await session.getToken();
      if (token) return token;
    }
  } catch {
    // Called outside of a request context or in unit tests
  }
  return process.env.CLERK_SECRET_KEY ?? null;
}

/** One chat completion via apps/api (/v1/ai/chat). Throws LLMError on failure. */
export async function chat(
  messages: Msg[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number; model?: string } = {}
): Promise<string> {
  const token = await resolveAuthToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 35_000);

  let res: Response;
  try {
    const url = new URL("/v1/ai/chat", API_BASE_URL);
    res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        model: opts.model,
        json: opts.json,
      }),
    });
  } catch (e) {
    throw new LLMError(`request failed: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LLMError(`API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data?: { content?: string; model?: string };
    error?: { code: string; message: string };
  };

  if (json.error) {
    throw new LLMError(`AI service error: ${json.error.message}`);
  }

  const text = json.data?.content?.trim();
  if (!text) throw new LLMError("empty completion");
  return text;
}

/**
 * Chat completion parsed as JSON. Tolerates models that wrap the object in
 * prose or ```json fences. Throws LLMError if nothing parses.
 */
export async function chatJSON<T>(
  messages: Msg[],
  opts: { temperature?: number; maxTokens?: number; model?: string } = {}
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
