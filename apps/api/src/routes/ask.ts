import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "@/db";
import { askMessages, askThreads } from "@/db/schema";
import { runAskPipeline } from "@/lib/ai/ask-pipeline";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { serializeSavedUrl } from "@/lib/serializers";
import type { AppEnv } from "@/types/hono";

export const ask = new Hono<AppEnv>();

const askSchema = z.object({
  question: z.string().min(1).max(2000),
  answerLanguageOverride: z.enum(["en", "ja"]).optional(),
  collectionIds: z.array(z.string().uuid()).max(5).optional(),
});

async function loadOwnedThread(userId: string, id: string) {
  const db = getDb();
  const thread = await db.query.askThreads.findFirst({
    where: and(eq(askThreads.id, id), eq(askThreads.userId, userId)),
  });
  if (!thread) throw new NotFoundError("Thread");
  return thread;
}

ask.post("/", async (c) => {
  const user = c.get("user");
  const { question, answerLanguageOverride, collectionIds } = askSchema.parse(await c.req.json());
  const result = await runAskPipeline({ user, question, answerLanguageOverride, collectionIds });
  return ok(result, { status: 201 });
});

ask.get("/threads", async (c) => {
  const user = c.get("user");
  const db = getDb();
  const rows = await db.query.askThreads.findMany({
    where: eq(askThreads.userId, user.id),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
    limit: 50,
  });

  return ok({
    items: rows.map((t) => ({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
});

ask.get("/threads/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const thread = await loadOwnedThread(user.id, id);
  const db = getDb();

  const messages = await db.query.askMessages.findMany({
    where: eq(askMessages.threadId, id),
    orderBy: [asc(askMessages.createdAt)],
    with: { citations: { with: { savedUrl: true } } },
  });

  return ok({
    thread: {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      modelId: m.modelId,
      usedFallback: m.usedFallback,
      createdAt: m.createdAt.toISOString(),
      citations: m.citations
        .filter((cc): cc is typeof cc & { savedUrl: NonNullable<typeof cc.savedUrl> } =>
          Boolean(cc.savedUrl)
        )
        .map((cc) => {
          const dto = serializeSavedUrl(cc.savedUrl);
          return {
            savedUrlId: cc.savedUrlId,
            title: dto.title,
            domain: dto.domain,
            url: dto.url,
            faviconUrl: dto.faviconUrl,
            snippet: cc.snippet ?? "",
            rank: cc.rank,
          };
        }),
    })),
  });
});

ask.delete("/threads/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await loadOwnedThread(user.id, id);
  const db = getDb();
  await db.delete(askThreads).where(and(eq(askThreads.id, id), eq(askThreads.userId, user.id)));
  return ok({ id });
});

const messageSchema = z.object({
  question: z.string().min(1).max(2000),
  answerLanguageOverride: z.enum(["en", "ja"]).optional(),
  collectionIds: z.array(z.string().uuid()).max(5).optional(),
});

ask.post("/threads/:id/messages", async (c) => {
  const user = c.get("user");
  const threadId = c.req.param("id");
  const { question, answerLanguageOverride, collectionIds } = messageSchema.parse(
    await c.req.json()
  );

  try {
    const result = await runAskPipeline({
      user,
      question,
      threadId,
      answerLanguageOverride,
      collectionIds,
    });
    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Thread not found") {
      throw new ValidationError("Thread not found");
    }
    throw error;
  }
});
