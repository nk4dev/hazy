import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type OpenAI from "openai";
import { OpenRouterError } from "@/lib/api/errors";
import {
  __setOpenRouterHooksForTest,
  chatJSON,
  createChatCompletionWithMeta,
  getModelCooldowns,
  resetOpenRouterState,
} from "./openrouter";

function fakeCompletion(model: string, content: string): OpenAI.Chat.ChatCompletion {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        logprobs: null,
        message: { role: "assistant", content, refusal: null },
      },
    ],
  };
}

describe("OpenRouter resilience", () => {
  beforeEach(() => {
    resetOpenRouterState();
  });

  afterEach(() => {
    resetOpenRouterState();
  });

  test("returns actual completion.model on success", async () => {
    __setOpenRouterHooksForTest({
      sleep: async () => {},
      executor: async () => fakeCompletion("model-actual", "hello"),
    });

    const res = await createChatCompletionWithMeta([{ role: "user", content: "hi" }], {
      model: "model-a",
      fallbackModels: ["model-b"],
    });
    expect(res.message.content).toBe("hello");
    expect(res.model).toBe("model-actual");
    expect(res.attempts).toBe(1);
  });

  test("handles HTTP 200 { error: { code: 429 } } with retry and fallback", async () => {
    const called: string[] = [];
    __setOpenRouterHooksForTest({
      sleep: async () => {},
      executor: async (body) => {
        called.push(body.model);
        if (body.model === "model-a") {
          return { error: { code: 429, message: "Rate limited" } } as unknown as OpenAI.Chat.ChatCompletion;
        }
        return fakeCompletion("model-b", "ok from fallback");
      },
    });

    const res = await createChatCompletionWithMeta([{ role: "user", content: "hi" }], {
      model: "model-a",
      fallbackModels: ["model-b"],
    });

    expect(called).toEqual(["model-a", "model-a", "model-b"]);
    expect(res.model).toBe("model-b");
    expect(res.message.content).toBe("ok from fallback");
    expect(getModelCooldowns()["model-a"]).toBeDefined();
  });

  test("routes directly to healthy fallback model while primary is cooled down", async () => {
    const called: string[] = [];
    __setOpenRouterHooksForTest({
      sleep: async () => {},
      executor: async (body) => {
        called.push(body.model);
        if (body.model === "model-a") {
          const err = new Error("Too many requests") as Error & { status?: number };
          err.status = 429;
          throw err;
        }
        return fakeCompletion(body.model, "ok");
      },
    });

    await createChatCompletionWithMeta([{ role: "user", content: "first" }], {
      model: "model-a",
      fallbackModels: ["model-b"],
    });
    called.length = 0;

    await createChatCompletionWithMeta([{ role: "user", content: "second" }], {
      model: "model-a",
      fallbackModels: ["model-b"],
    });
    expect(called).toEqual(["model-b"]);
  });

  test("half-open recovery probes oldest cooled-down model and clears cooldown on success", async () => {
    let fail = true;
    const called: string[] = [];
    __setOpenRouterHooksForTest({
      sleep: async () => {},
      executor: async (body) => {
        called.push(body.model);
        if (fail) {
          const err = new Error("Rate limit") as Error & { status?: number };
          err.status = 429;
          throw err;
        }
        return fakeCompletion(body.model, "recovered");
      },
    });

    await expect(
      createChatCompletionWithMeta([{ role: "user", content: "hi" }], {
        model: "model-a",
        fallbackModels: ["model-b"],
      })
    ).rejects.toThrow(OpenRouterError);

    expect(Object.keys(getModelCooldowns()).sort()).toEqual(["model-a", "model-b"]);

    fail = false;
    called.length = 0;
    const res = await createChatCompletionWithMeta([{ role: "user", content: "retry" }], {
      model: "model-a",
      fallbackModels: ["model-b"],
    });

    expect(res.message.content).toBe("recovered");
    expect(called).toEqual(["model-a"]);
    expect(getModelCooldowns()["model-a"]).toBeUndefined();
  });

  test("chatJSON auto-downgrades response_format on 400 and strips markdown fences", async () => {
    let calls = 0;
    __setOpenRouterHooksForTest({
      sleep: async () => {},
      executor: async (body) => {
        calls++;
        if (calls === 1 && body.response_format) {
          const err = new Error("response_format is not supported") as Error & { status?: number };
          err.status = 400;
          throw err;
        }
        return fakeCompletion(body.model, '```json\n{"ok":true,"count":2}\n```');
      },
    });

    const out = await chatJSON<{ ok: boolean; count: number }>([{ role: "user", content: "json" }], {
      model: "model-a",
      fallbackModels: [],
    });

    expect(calls).toBe(2);
    expect(out.data).toEqual({ ok: true, count: 2 });
  });

  test("401 auth error fails fast without retry or fallback", async () => {
    const called: string[] = [];
    __setOpenRouterHooksForTest({
      sleep: async () => {},
      executor: async (body) => {
        called.push(body.model);
        const err = new Error("Unauthorized") as Error & { status?: number };
        err.status = 401;
        throw err;
      },
    });

    try {
      await createChatCompletionWithMeta([{ role: "user", content: "hi" }], {
        model: "model-a",
        fallbackModels: ["model-b"],
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(OpenRouterError);
      const ore = err as OpenRouterError;
      expect(ore.status).toBe(503);
      expect(ore.code).toBe("ai_unavailable");
    }
    expect(called).toEqual(["model-a"]);
  });

  test("maps exhausted rate limits to 429 ai_rate_limited and timeouts to 504 ai_timeout", async () => {
    __setOpenRouterHooksForTest({
      sleep: async () => {},
      executor: async () => {
        const err = new Error("Rate limit") as Error & { status?: number };
        err.status = 429;
        throw err;
      },
    });

    try {
      await createChatCompletionWithMeta([{ role: "user", content: "hi" }], {
        model: "model-a",
        fallbackModels: [],
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(OpenRouterError);
      expect((err as OpenRouterError).status).toBe(429);
      expect((err as OpenRouterError).code).toBe("ai_rate_limited");
    }

    resetOpenRouterState();
    __setOpenRouterHooksForTest({
      sleep: async () => {},
      executor: async () => {
        const err = new Error("Request timed out");
        err.name = "TimeoutError";
        throw err;
      },
    });

    try {
      await createChatCompletionWithMeta([{ role: "user", content: "hi" }], {
        model: "model-a",
        fallbackModels: [],
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(OpenRouterError);
      expect((err as OpenRouterError).status).toBe(504);
      expect((err as OpenRouterError).code).toBe("ai_timeout");
    }
  });
});
