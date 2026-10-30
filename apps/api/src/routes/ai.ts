import { Hono } from "hono";
import { z } from "zod";
import { createChatCompletion } from "@/lib/ai/openrouter";
import { ServiceNotConfiguredError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { isOpenRouterConfigured } from "@/env";
import type { AiChatResponseDTO } from "@/types/api";
import type { AppEnv } from "@/types/hono";

export const ai = new Hono<AppEnv>();

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })
  ),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  model: z.string().optional(),
  models: z.array(z.string()).optional(),
  json: z.boolean().optional(),
});

ai.post("/chat", async (c) => {
  if (!isOpenRouterConfigured()) {
    throw new ServiceNotConfiguredError("openrouter");
  }

  const { messages, temperature, model, models } = chatSchema.parse(await c.req.json());
  const completion = await createChatCompletion(messages, {
    temperature,
    model,
    models,
  });

  const response: AiChatResponseDTO = {
    content: completion.content ?? "",
    model: completion.model,
  };

  return ok(response);
});
