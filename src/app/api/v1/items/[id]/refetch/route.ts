import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { savedUrls } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { ok, withApiErrors } from "@/lib/api/response";
import { NotFoundError } from "@/lib/api/errors";
import { fetchUrlMetadata } from "@/lib/metadata/fetch-metadata";
import { serializeSavedUrl } from "@/lib/serializers";

export const runtime = "nodejs";

export const POST = withApiErrors(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    const db = getDb();
    const existing = await db.query.savedUrls.findFirst({
      where: and(eq(savedUrls.id, id), eq(savedUrls.userId, user.id)),
    });
    if (!existing) throw new NotFoundError("Saved URL");

    const result = await fetchUrlMetadata(existing.url);

    const [updated] = await db
      .update(savedUrls)
      .set(
        result.status === "success"
          ? {
              title: result.metadata.title,
              description: result.metadata.description,
              faviconUrl: result.metadata.faviconUrl,
              ogImageUrl: result.metadata.ogImageUrl,
              extractedText: result.metadata.extractedText,
              contentLanguage: result.metadata.contentLanguage,
              estimatedReadMinutes: result.metadata.estimatedReadMinutes,
              fetchStatus: "success" as const,
              fetchError: null,
              updatedAt: new Date(),
            }
          : {
              fetchStatus: "error" as const,
              fetchError: result.error,
              updatedAt: new Date(),
            }
      )
      .where(and(eq(savedUrls.id, id), eq(savedUrls.userId, user.id)))
      .returning();

    return ok(serializeSavedUrl(updated));
  }
);
