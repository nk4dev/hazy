import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { askMessages, askThreads } from "@/db/schema";
import { NotFoundError } from "@/lib/api/errors";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";
import { serializeSavedUrl } from "@/lib/serializers";

export const runtime = "nodejs";

async function loadOwnedThread(userId: string, id: string) {
  const db = getDb();
  const thread = await db.query.askThreads.findFirst({
    where: and(eq(askThreads.id, id), eq(askThreads.userId, userId)),
  });
  if (!thread) throw new NotFoundError("Thread");
  return thread;
}

export const GET = withApiErrors(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
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
          .filter((c): c is typeof c & { savedUrl: NonNullable<typeof c.savedUrl> } =>
            Boolean(c.savedUrl)
          )
          .map((c) => {
            const dto = serializeSavedUrl(c.savedUrl);
            return {
              savedUrlId: c.savedUrlId,
              title: dto.title,
              domain: dto.domain,
              url: dto.url,
              faviconUrl: dto.faviconUrl,
              snippet: c.snippet ?? "",
              rank: c.rank,
            };
          }),
      })),
    });
  }
);

export const DELETE = withApiErrors(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    await loadOwnedThread(user.id, id);
    const db = getDb();
    await db.delete(askThreads).where(and(eq(askThreads.id, id), eq(askThreads.userId, user.id)));
    return ok({ id });
  }
);
