import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "@/db";
import { readLaterState, savedUrls } from "@/db/schema";
import { summarizeItem } from "@/lib/ai/summarize-item";
import { NotFoundError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { fetchUrlMetadata } from "@/lib/metadata/fetch-metadata";
import { parseAndNormalizeUrl } from "@/lib/metadata/normalize-url";
import { serializeSavedUrl } from "@/lib/serializers";
import type { AppEnv } from "@/types/hono";

export const items = new Hono<AppEnv>();

async function loadOwnedItem(userId: string, id: string) {
  const db = getDb();
  const row = await db.query.savedUrls.findFirst({
    where: and(eq(savedUrls.id, id), eq(savedUrls.userId, userId)),
    with: { readLaterState: true },
  });
  if (!row) throw new NotFoundError("Saved URL");
  return row;
}

/** Lowercase, trim, drop blanks/overlong entries, de-dupe, cap the list. */
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (tag && tag.length <= 50) seen.add(tag);
  }
  return [...seen].slice(0, 30);
}

const listQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

items.get("/", async (c) => {
  const user = c.get("user");
  const { cursor, limit, sort } = listQuerySchema.parse({
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit"),
    sort: c.req.query("sort"),
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
      sort === "newest"
        ? lt(savedUrls.createdAt, cursorCreatedAt)
        : gt(savedUrls.createdAt, cursorCreatedAt)
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

const createSchema = z.object({ url: z.string().min(1) });

items.post("/", async (c) => {
  const user = c.get("user");
  const { url } = createSchema.parse(await c.req.json());
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

items.get("/:id", async (c) => {
  const user = c.get("user");
  const row = await loadOwnedItem(user.id, c.req.param("id"));
  return ok(serializeSavedUrl(row, row.readLaterState));
});

const patchSchema = z.object({
  summary: z.string().max(4000).nullable().optional(),
  title: z.string().max(500).nullable().optional(),
  tags: z.array(z.string()).max(100).optional(),
});

items.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await loadOwnedItem(user.id, id);
  const { tags, ...body } = patchSchema.parse(await c.req.json());
  const db = getDb();
  const [updated] = await db
    .update(savedUrls)
    .set({
      ...body,
      ...(tags ? { tags: normalizeTags(tags) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(savedUrls.id, id), eq(savedUrls.userId, user.id)))
    .returning();
  return ok(serializeSavedUrl(updated));
});

items.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await loadOwnedItem(user.id, id);
  const db = getDb();
  await db.delete(savedUrls).where(and(eq(savedUrls.id, id), eq(savedUrls.userId, user.id)));
  return ok({ id });
});

items.post("/:id/refetch", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
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
});

items.post("/:id/summarize", async (c) => {
  const user = c.get("user");
  const result = await summarizeItem(user.id, c.req.param("id"));
  return ok(result);
});
