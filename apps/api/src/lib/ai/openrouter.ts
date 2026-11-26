import OpenAI from "openai";
import { env, parseModelList } from "@/env";
import { OpenRouterError } from "@/lib/api/errors";

export type ChatCompletionOptions = {
  model?: string;
  fallbackModels?: string[];
  tools?: OpenAI.Chat.ChatCompletionTool[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
};

export type ChatCompletionResult = {
  message: OpenAI.Chat.ChatCompletionMessage;
  model: string;
  attempts: number;
};

type CooldownEntry = {
  until: number;
  consecutiveFailures: number;
  reason: string;
};

type ErrorCategory =
  | "auth"
  | "rate_limit"
  | "timeout"
  | "transient"
  | "model_not_found"
  | "unsupported_response_format"
  | "unsupported_tools"
  | "other";

type ExecutorFn = (
  body: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  options: { timeout: number }
) => Promise<OpenAI.Chat.ChatCompletion>;

type SleepFn = (ms: number) => Promise<void>;

let cachedClient: OpenAI | null = null;
const modelCooldowns = new Map<string, CooldownEntry>();

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      maxRetries: 0,
      defaultHeaders: {
        "HTTP-Referer": env.OPENROUTER_SITE_URL,
        "X-Title": env.OPENROUTER_APP_NAME,
      },
    });
  }
  return cachedClient;
}

const defaultExecutor: ExecutorFn = (body, options) =>
  getClient().chat.completions.create(body, options);

let executorImpl: ExecutorFn = defaultExecutor;
let sleepImpl: SleepFn = defaultSleep;

/** Test hook to mock OpenRouter transport and eliminate retry sleeps. */
export function __setOpenRouterHooksForTest(hooks: {
  executor?: ExecutorFn | null;
  sleep?: SleepFn | null;
}): void {
  executorImpl = hooks.executor ?? defaultExecutor;
  sleepImpl = hooks.sleep ?? defaultSleep;
}

export function resetOpenRouterState(): void {
  modelCooldowns.clear();
  cachedClient = null;
  executorImpl = defaultExecutor;
  sleepImpl = defaultSleep;
}

export function getModelCooldowns(now = Date.now()): Record<string, CooldownEntry> {
  const out: Record<string, CooldownEntry> = {};
  for (const [model, entry] of modelCooldowns.entries()) {
    if (entry.until > now) {
      out[model] = { ...entry };
    }
  }
  return out;
}

function jitter(minMs: number, maxMs: number): number {
  return Math.round(minMs + Math.random() * (maxMs - minMs));
}

function extractUpstreamStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const err = error as { status?: unknown; code?: unknown };
  if (typeof err.status === "number" && err.status >= 100) return err.status;
  if (typeof err.code === "number" && err.code >= 400) return err.code;
  return undefined;
}

function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const headers = (error as { headers?: unknown }).headers;
  if (!headers) return undefined;

  let raw: string | null | undefined;
  if (typeof (headers as Headers).get === "function") {
    raw = (headers as Headers).get("retry-after");
  } else if (typeof headers === "object") {
    const rec = headers as Record<string, unknown>;
    const v = rec["retry-after"] ?? rec["Retry-After"];
    if (typeof v === "string") raw = v;
  }

  if (!raw) return undefined;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return Math.min(3000, Math.max(250, Math.round(seconds * 1000)));
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error ?? "Unknown error");
}

function classifyError(
  error: unknown,
  ctx: { hasJson: boolean; hasTools: boolean }
): { category: ErrorCategory; status?: number; message: string } {
  const status = extractUpstreamStatus(error);
  const message = extractErrorMessage(error);
  const name = error instanceof Error ? error.name : "";

  if (status === 401 || status === 403) {
    return { category: "auth", status, message };
  }

  if (
    ctx.hasJson &&
    status === 400 &&
    /response_format|json_object|structured/i.test(message)
  ) {
    return { category: "unsupported_response_format", status, message };
  }

  if (
    ctx.hasTools &&
    (status === 400 || status === 404) &&
    /\btools?\b|\bfunction/i.test(message)
  ) {
    return { category: "unsupported_tools", status, message };
  }

  if (
    status === 404 ||
    /no endpoints found|model not found|retired|deprecated|not available/i.test(message)
  ) {
    return { category: "model_not_found", status, message };
  }

  if (status === 429 || /rate limit|too many requests/i.test(message)) {
    return { category: "rate_limit", status: status ?? 429, message };
  }

  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    name === "APIConnectionTimeoutError" ||
    status === 408 ||
    status === 524 ||
    /timed?\s*out|timeout|aborted/i.test(message)
  ) {
    return { category: "timeout", status, message };
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 529 ||
    name === "APIConnectionError" ||
    /empty response|no message|fetch failed|network|econnreset|socket/i.test(message)
  ) {
    return { category: "transient", status, message };
  }

  return { category: "other", status, message };
}

function recordFailureCooldown(model: string, category: ErrorCategory, now = Date.now()): void {
  const prev = modelCooldowns.get(model);
  const consecutiveFailures = (prev?.consecutiveFailures ?? 0) + 1;

  if (category === "model_not_found") {
    modelCooldowns.set(model, {
      until: now + 600_000,
      consecutiveFailures,
      reason: category,
    });
    return;
  }

  if (category === "rate_limit") {
    const duration = 60_000 * Math.min(5, consecutiveFailures);
    modelCooldowns.set(model, {
      until: now + duration,
      consecutiveFailures,
      reason: category,
    });
    return;
  }

  if ((category === "transient" || category === "timeout") && consecutiveFailures >= 2) {
    modelCooldowns.set(model, {
      until: now + 30_000,
      consecutiveFailures,
      reason: category,
    });
    return;
  }

  modelCooldowns.set(model, {
    until: prev?.until ?? 0,
    consecutiveFailures,
    reason: category,
  });
}

function clearCooldown(model: string): void {
  modelCooldowns.delete(model);
}

function orderCandidates(configured: string[], now = Date.now()): string[] {
  const healthy: string[] = [];
  const cooled: { model: string; until: number }[] = [];

  for (const model of configured) {
    const entry = modelCooldowns.get(model);
    if (!entry || entry.until <= now) {
      healthy.push(model);
    } else {
      cooled.push({ model, until: entry.until });
    }
  }

  cooled.sort((a, b) => a.until - b.until);
  return [...healthy, ...cooled.map((c) => c.model)];
}

function extractMessageFromCompletion(
  completion: OpenAI.Chat.ChatCompletion
): OpenAI.Chat.ChatCompletionMessage {
  const embeddedError = (
    completion as { error?: { code?: unknown; message?: string; metadata?: unknown } }
  )?.error;
  if (!completion.choices || embeddedError) {
    const err = new Error(
      `OpenRouter upstream error: ${embeddedError?.message ?? JSON.stringify(completion).slice(0, 200)}`
    ) as Error & { status?: number };
    if (typeof embeddedError?.code === "number") {
      err.status = embeddedError.code;
    }
    throw err;
  }

  const message = completion.choices[0]?.message;
  if (!message) {
    throw new Error("OpenRouter returned no message.");
  }
  const hasToolCalls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
  if (!message.content && !hasToolCalls) {
    throw new Error("OpenRouter returned an empty response.");
  }
  return message;
}

function logEvent(payload: {
  event: "retry" | "fallback" | "cooldown" | "downgrade_json";
  model: string;
  nextModel?: string;
  status?: number;
  category: ErrorCategory;
  attempt: number;
  durationMs: number;
}): void {
  console.warn(JSON.stringify({ source: "openrouter", ...payload }));
}

export async function createChatCompletionWithMeta(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  const primary = options.model ?? env.OPENROUTER_MODEL_ID;
  const fallbacksCsv =
    options.fallbackModels !== undefined
      ? options.fallbackModels.join(",")
      : env.OPENROUTER_FALLBACK_MODELS;
  const configured = parseModelList(primary, fallbacksCsv);
  const candidates = orderCandidates(configured);

  const timeoutMs = options.timeoutMs ?? env.OPENROUTER_TIMEOUT_MS;
  const temperature = options.temperature ?? 0.3;
  let totalAttempts = 0;

  const failureCategories: ErrorCategory[] = [];
  let lastStatus: number | undefined;
  let lastModel = candidates[0] ?? primary;

  for (let idx = 0; idx < candidates.length; idx++) {
    const model = candidates[idx];
    const nextModel = candidates[idx + 1];
    lastModel = model;

    let useJson = Boolean(options.json);
    let downgradedJson = false;

    for (let attempt = 0; ; attempt++) {
      totalAttempts++;
      const startedAt = Date.now();
      const body: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages,
        temperature,
        ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
        ...(options.tools?.length ? { tools: options.tools, tool_choice: "auto" as const } : {}),
        ...(useJson ? { response_format: { type: "json_object" as const } } : {}),
      };

      try {
        const completion = await executorImpl(body, { timeout: timeoutMs });
        const message = extractMessageFromCompletion(completion);
        clearCooldown(model);
        return {
          message,
          model: completion.model || model,
          attempts: totalAttempts,
        };
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const classified = classifyError(error, {
          hasJson: useJson,
          hasTools: Boolean(options.tools?.length),
        });
        lastStatus = classified.status;

        if (classified.category === "auth") {
          throw new OpenRouterError({
            status: 503,
            code: "ai_unavailable",
            message: "AI provider authentication failed.",
            upstreamStatus: classified.status,
            model,
            cause: error,
          });
        }

        if (classified.category === "unsupported_response_format" && !downgradedJson) {
          useJson = false;
          downgradedJson = true;
          logEvent({
            event: "downgrade_json",
            model,
            status: classified.status,
            category: classified.category,
            attempt: attempt + 1,
            durationMs,
          });
          continue;
        }

        const retryable =
          classified.category === "rate_limit" ||
          classified.category === "timeout" ||
          classified.category === "transient";

        if (attempt === 0 && retryable) {
          const delayMs =
            classified.category === "rate_limit"
              ? (extractRetryAfterMs(error) ?? jitter(500, 1000))
              : classified.category === "timeout"
                ? jitter(400, 800)
                : jitter(400, 900);
          logEvent({
            event: "retry",
            model,
            status: classified.status,
            category: classified.category,
            attempt: attempt + 1,
            durationMs,
          });
          await sleepImpl(delayMs);
          continue;
        }

        failureCategories.push(classified.category);

        if (classified.category !== "unsupported_tools") {
          recordFailureCooldown(model, classified.category);
          logEvent({
            event: "cooldown",
            model,
            status: classified.status,
            category: classified.category,
            attempt: attempt + 1,
            durationMs,
          });
        }

        if (nextModel) {
          logEvent({
            event: "fallback",
            model,
            nextModel,
            status: classified.status,
            category: classified.category,
            attempt: attempt + 1,
            durationMs,
          });
        }
        break;
      }
    }
  }

  const allRateLimited =
    failureCategories.length > 0 && failureCategories.every((c) => c === "rate_limit");
  const allTimedOut =
    failureCategories.length > 0 && failureCategories.every((c) => c === "timeout");

  if (allRateLimited) {
    throw new OpenRouterError({
      status: 429,
      code: "ai_rate_limited",
      message: "AI provider is temporarily rate-limited. Please try again shortly.",
      upstreamStatus: lastStatus ?? 429,
      model: lastModel,
      details: { triedModels: candidates },
    });
  }

  if (allTimedOut) {
    throw new OpenRouterError({
      status: 504,
      code: "ai_timeout",
      message: "AI provider request timed out. Please try again shortly.",
      upstreamStatus: lastStatus ?? 504,
      model: lastModel,
      details: { triedModels: candidates },
    });
  }

  throw new OpenRouterError({
    status: 503,
    code: "ai_unavailable",
    message: "AI provider is temporarily unavailable. Please try again shortly.",
    upstreamStatus: lastStatus,
    model: lastModel,
    details: { triedModels: candidates },
  });
}

/** Single completion call with retries and model fallback. */
export async function createChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: ChatCompletionOptions = {}
): Promise<OpenAI.Chat.ChatCompletionMessage> {
  const { message } = await createChatCompletionWithMeta(messages, options);
  return message;
}

export async function askOpenRouterWithMeta(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: ChatCompletionOptions = {}
): Promise<{ content: string; model: string }> {
  const { message, model } = await createChatCompletionWithMeta(messages, options);
  const content = message.content?.trim();
  if (!content) {
    throw new OpenRouterError({
      status: 502,
      code: "ai_unavailable",
      message: "AI provider returned an empty response.",
      model,
    });
  }
  return { content, model };
}

export async function askOpenRouter(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  const { content } = await askOpenRouterWithMeta(messages, options);
  return content;
}

/** Parse JSON from LLM text, tolerating ```json fences or surrounding prose. */
export function parseJsonFromLlmText<T>(raw: string): T {
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
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error(`Could not parse JSON from model response: ${cleaned.slice(0, 120)}`);
  }
}

/**
 * Completion parsed as JSON, walking the fallback chain if a model returns
 * malformed non-JSON output.
 */
export async function chatJSON<T>(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: ChatCompletionOptions = {}
): Promise<{ data: T; model: string }> {
  const primary = options.model ?? env.OPENROUTER_MODEL_ID;
  const fallbacksCsv =
    options.fallbackModels !== undefined
      ? options.fallbackModels.join(",")
      : env.OPENROUTER_FALLBACK_MODELS;
  const configured = parseModelList(primary, fallbacksCsv);
  const candidates = orderCandidates(configured);

  let lastParseError: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    const remaining = candidates.slice(i + 1);
    const res = await askOpenRouterWithMeta(messages, {
      ...options,
      model,
      fallbackModels: remaining,
      json: true,
    });
    try {
      return { data: parseJsonFromLlmText<T>(res.content), model: res.model };
    } catch (err) {
      lastParseError = err;
      logEvent({
        event: "fallback",
        model: res.model,
        nextModel: remaining[0],
        category: "other",
        attempt: 1,
        durationMs: 0,
      });
    }
  }

  throw new OpenRouterError({
    status: 502,
    code: "ai_unavailable",
    message: "AI provider returned invalid JSON.",
    cause: lastParseError,
  });
}
