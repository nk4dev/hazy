import { and, eq, inArray } from "drizzle-orm";
import type { getDb } from "@/db";
import { collectionItems, collections, savedUrls } from "@/db/schema";

type Database = ReturnType<typeof getDb>;
import type { BlogProvider } from "./providers/types";

export type CitationStyle = "list" | "footnote" | "cards";

export async function buildCitationsMarkdown(
  db: Database,
  opts: {
    userId: string;
    profileId: string;
    savedUrlIds?: string[];
    collectionIds?: string[];
    style?: CitationStyle;
    provider?: BlogProvider;
  }
): Promise<string> {
  const urlIds = new Set(opts.savedUrlIds ?? []);

  if (opts.collectionIds && opts.collectionIds.length > 0) {
    const ownedCols = await db
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.userId, opts.userId),
          eq(collections.profileId, opts.profileId),
          inArray(collections.id, opts.collectionIds)
        )
      );
    const colIds = ownedCols.map((c) => c.id);
    if (colIds.length > 0) {
      const items = await db
        .select({ savedUrlId: collectionItems.savedUrlId })
        .from(collectionItems)
        .where(inArray(collectionItems.collectionId, colIds));
      for (const item of items) urlIds.add(item.savedUrlId);
    }
  }

  if (urlIds.size === 0) return "";

  const rows = await db.query.savedUrls.findMany({
    where: and(
      eq(savedUrls.userId, opts.userId),
      eq(savedUrls.profileId, opts.profileId),
      inArray(savedUrls.id, [...urlIds])
    ),
    columns: { id: true, url: true, title: true, summary: true },
  });

  if (rows.length === 0) return "";

  const style = opts.style ?? "list";
  const lines: string[] = ["", "## 参考文献", ""];

  if (style === "cards" && opts.provider === "zenn") {
    for (const r of rows) {
      lines.push(r.url, "");
    }
  } else if (style === "footnote") {
    rows.forEach((r, i) => {
      const label = r.title ? `${r.title} (${r.url})` : r.url;
      lines.push(`[^${i + 1}]: ${label}`);
    });
  } else {
    rows.forEach((r, i) => {
      const title = r.title || r.url;
      lines.push(`${i + 1}. [${title}](${r.url})`);
    });
  }

  return lines.join("\n").trimEnd();
}
