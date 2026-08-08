import { and, desc, asc, eq, lt, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { savedUrls, readLaterState } from "@/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { ok, withApiErrors } from "@/lib/api/response";
import { parseAndNormalizeUrl } from "@/lib/metadata/normalize-url";
import { fetchUrlMetadata } from "@/lib/metadata/fetch-metadata";
import { serializeSavedUrl } from "@/lib/serializers";

export const runtime = "nodejs";

const createSchema = z.object({ url: z.string().min(1) });

export const POST = withApiErrors(async (req: Request) => {
  const user = await requireUser();
  const { url } = createSchema.parse(await req.json());
  const { url: cleanUrl, normalizedUrl, domain } = parseAndNormalizeUrl(url);
  const db = getDb();

  const existing = await db.query.savedUrls.findFirst({
    where: and(eq(savedUrls.userId, user.id), eq(savedUrls.normalizedUrl, normalizedUrl)),
  });
  if (existing) {
    return ok(serializeSavedUrl(existing), { status: 200 });
  }

  const result = await fetchUrlMetadata(cleanUrl);

  const [row] = await db
    .insert(savedUrls)
    .values(
      result.status === "success"
        ? {
            userId: user.id,
            url: cleanUrl,
            normalizedUrl,
            domain,
            title: result.metadata.title,
            description: result.metadata.description,
            faviconUrl: result.metadata.faviconUrl,
            ogImageUrl: result.metadata.ogImageUrl,
            extractedText: result.metadata.extractedText,
            contentLanguage: result.metadata.contentLanguage,
            estimatedReadMinutes: result.metadata.estimatedReadMinutes,
            fetchStatus: "success" as const,
          }
        : {
            userId: user.id,
            url: cleanUrl,
            normalizedUrl,
            domain,
            fetchStatus: "error" as const,
            fetchError: result.error,
          }
    )
    .returning();

  await db.insert(readLaterState).values({ userId: user.id, savedUrlId: row.id });

  return ok(serializeSavedUrl(row), { status: 201 });
});

const listQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

export const GET = withApiErrors(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const { cursor, limit, sort } = listQuerySchema.parse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
  });
  const db = getDb();

  let cursorCreatedAt: Date | undefined;
  if (cursor) {
    const cursorRow = await db.query.savedUrls.findFirst({ where: eq(savedUrls.id, cursor) });
    cursorCreatedAt = cursorRow?.createdAt;
  }

  const conditions = [eq(savedUrls.userId, user.id)];
  if (cursorCreatedAt) {
    conditions.push(
      sort === "newest" ? lt(savedUrls.createdAt, cursorCreatedAt) : gt(savedUrls.createdAt, cursorCreatedAt)
    );
  }

  const rows = await db.query.savedUrls.findMany({
    where: and(...conditions),
    orderBy: sort === "newest" ? [desc(savedUrls.createdAt)] : [asc(savedUrls.createdAt)],
    limit: limit + 1,
    with: { readLaterState: true },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return ok({
    items: page.map((row) => serializeSavedUrl(row, row.readLaterState)),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});
