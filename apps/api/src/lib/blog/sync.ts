import { and, eq, inArray } from "drizzle-orm";
import type { getDb } from "@/db";
import { blogConnections, blogPublications, savedUrls } from "@/db/schema";

type Database = ReturnType<typeof getDb>;
import { sha256Hex } from "@/lib/auth/api-token";
import { decryptCredentials } from "@/lib/blog/crypto";
import { getBlogProvider } from "@/lib/blog/providers";
import type { RemoteBlogPost } from "@/lib/blog/providers/types";
import { parseAndNormalizeUrl } from "@/lib/metadata/normalize-url";

function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const t of tags) {
    const clean = t.trim().toLowerCase();
    if (clean && clean.length <= 50) seen.add(clean);
  }
  return [...seen].slice(0, 30);
}

export async function upsertPublishedPostToSavedUrls(
  db: Database,
  connection: typeof blogConnections.$inferSelect,
  post: RemoteBlogPost,
  noteId?: string | null
): Promise<string | null> {
  if (!post.externalUrl) return null;
  let normalizedUrl: string;
  let cleanUrl: string;
  let domain: string;
  try {
    const parsed = parseAndNormalizeUrl(post.externalUrl);
    normalizedUrl = parsed.normalizedUrl;
    cleanUrl = parsed.url;
    domain = parsed.domain;
  } catch {
    return null;
  }

  const tags = dedupeTags(["blog", connection.provider, ...post.tags]);
  const [saved] = await db
    .insert(savedUrls)
    .values({
      userId: connection.userId,
      profileId: connection.profileId,
      url: cleanUrl,
      normalizedUrl,
      domain,
      title: post.title,
      description: post.bodyMarkdown.slice(0, 280),
      extractedText: post.bodyMarkdown,
      tags,
      fetchStatus: "success",
      relatedNoteId: noteId ?? null,
    })
    .onConflictDoUpdate({
      target: [savedUrls.profileId, savedUrls.normalizedUrl],
      set: {
        title: post.title,
        description: post.bodyMarkdown.slice(0, 280),
        extractedText: post.bodyMarkdown,
        tags,
        fetchStatus: "success",
        ...(noteId ? { relatedNoteId: noteId } : {}),
        updatedAt: new Date(),
      },
    })
    .returning({ id: savedUrls.id });

  return saved?.id ?? null;
}

export async function syncBlogPostsIncremental(
  db: Database,
  connection: typeof blogConnections.$inferSelect,
  posts: RemoteBlogPost[],
  deletedExternalIds: string[] = []
): Promise<{ upserted: number; deleted: number }> {
  let upserted = 0;
  const now = new Date();

  for (const post of posts) {
    const contentHash = await sha256Hex(`${post.title}\n${post.bodyMarkdown}\n${post.tags.join(",")}`);
    const savedUrlId =
      post.status === "published"
        ? await upsertPublishedPostToSavedUrls(db, connection, post)
        : null;

    await db
      .insert(blogPublications)
      .values({
        userId: connection.userId,
        profileId: connection.profileId,
        connectionId: connection.id,
        savedUrlId,
        externalId: post.externalId,
        externalSlug: post.externalSlug,
        externalUrl: post.externalUrl,
        title: post.title,
        status: post.status,
        tags: post.tags,
        contentHash,
        publishedAt: post.publishedAt,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: [blogPublications.connectionId, blogPublications.externalId],
        set: {
          savedUrlId,
          externalSlug: post.externalSlug,
          externalUrl: post.externalUrl,
          title: post.title,
          status: post.status,
          tags: post.tags,
          contentHash,
          publishedAt: post.publishedAt,
          lastSyncedAt: now,
          updatedAt: now,
        },
      });
    upserted++;
  }

  let deleted = 0;
  if (deletedExternalIds.length > 0) {
    const res = await db
      .update(blogPublications)
      .set({ status: "archived", lastSyncedAt: now, updatedAt: now })
      .where(
        and(
          eq(blogPublications.connectionId, connection.id),
          inArray(blogPublications.externalId, deletedExternalIds)
        )
      )
      .returning({ id: blogPublications.id });
    deleted = res.length;
  }

  await db
    .update(blogConnections)
    .set({ lastSyncedAt: now, lastSyncError: null, updatedAt: now })
    .where(eq(blogConnections.id, connection.id));

  return { upserted, deleted };
}

export async function syncBlogConnection(
  db: Database,
  connection: typeof blogConnections.$inferSelect
): Promise<{ upserted: number; deleted: number }> {
  try {
    const creds = await decryptCredentials<Record<string, unknown>>(
      connection.encryptedCredentials
    );
    const adapter = getBlogProvider(connection.provider);
    const posts = await adapter.listPublished(connection.config, creds);
    return await syncBlogPostsIncremental(db, connection, posts, []);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await db
      .update(blogConnections)
      .set({ lastSyncError: message, updatedAt: new Date() })
      .where(eq(blogConnections.id, connection.id));
    throw err;
  }
}
