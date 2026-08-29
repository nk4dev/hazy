import { and, arrayContains, desc, eq, gte, ilike, lte, or, type SQL, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { savedUrls } from "@/db/schema";

export type SearchHit = typeof savedUrls.$inferSelect & { rank: number };

export interface ParsedQuery {
  /** Free-text portion, with any `domain:`/`tag:` tokens stripped out. */
  text: string;
  /** Value of a `domain:` token, lowercased and stripped of a leading `www.`. */
  domain: string | null;
  /** Values of every `tag:` token, lowercased. A hit must carry all of them. */
  tags: string[];
}

const FILTER_TOKEN = /(?:^|\s)(domain|tag):("[^"]+"|\S+)/gi;

/**
 * Pulls `domain:` and `tag:` filter tokens out of a raw search string so the
 * library search box doubles as a filter UI (issues #2, #5). Everything else
 * stays as free text for full-text search. `tag:"two words"` is supported.
 */
export function parseSearchQuery(raw: string): ParsedQuery {
  let domain: string | null = null;
  const tags: string[] = [];

  const text = raw
    .replace(FILTER_TOKEN, (_match, key: string, rawValue: string) => {
      const value = rawValue.replace(/^"|"$/g, "").trim().toLowerCase();
      if (value) {
        if (key.toLowerCase() === "domain") {
          domain = value.replace(/^www\./, "");
        } else {
          tags.push(value);
        }
      }
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  return { text, domain, tags };
}

export interface DateRange {
  /** Inclusive lower bound. */
  from?: Date;
  /** Inclusive upper bound. */
  to?: Date;
}

function dateRangeConditions({ from, to }: DateRange): SQL[] {
  const conditions: SQL[] = [];
  if (from) conditions.push(gte(savedUrls.createdAt, from));
  if (to) conditions.push(lte(savedUrls.createdAt, to));
  return conditions;
}

/**
 * Always-available search over a user's own saved URLs — no AI required.
 * Tries Postgres full-text search first (fast, ranked); if that comes back
 * empty (e.g. a short/odd query the tsquery parser doesn't like), falls
 * back to a plain ILIKE scan so search never just returns nothing.
 */
export async function searchUserItems(
  userId: string,
  query: string,
  { limit = 8, dateRange = {} }: { limit?: number; dateRange?: DateRange } = {}
): Promise<SearchHit[]> {
  const { text, domain, tags } = parseSearchQuery(query);
  const trimmed = text.trim();
  const hasFilters = domain !== null || tags.length > 0;
  if (!trimmed && !hasFilters) return [];

  const db = getDb();

  const scopeConditions: SQL[] = [eq(savedUrls.userId, userId), ...dateRangeConditions(dateRange)];
  if (domain) scopeConditions.push(ilike(savedUrls.domain, `%${domain}%`));
  if (tags.length > 0) scopeConditions.push(arrayContains(savedUrls.tags, tags));

  // Filters with no free text: just return the matching rows, newest first.
  if (!trimmed) {
    const rows = await db
      .select()
      .from(savedUrls)
      .where(and(...scopeConditions))
      .orderBy(desc(savedUrls.createdAt))
      .limit(limit);
    return rows.map((row) => ({ ...row, rank: 0 }));
  }

  const ftsRows = await db
    .select({
      row: savedUrls,
      rank: sql<number>`ts_rank(${savedUrls.searchVector}, plainto_tsquery('simple', ${trimmed}))`,
    })
    .from(savedUrls)
    .where(
      and(
        ...scopeConditions,
        sql`${savedUrls.searchVector} @@ plainto_tsquery('simple', ${trimmed})`
      )
    )
    .orderBy((t) => desc(t.rank))
    .limit(limit);

  if (ftsRows.length > 0) {
    return ftsRows.map(({ row, rank }) => ({ ...row, rank }));
  }

  const likeTerm = `%${trimmed}%`;
  const likeRows = await db
    .select()
    .from(savedUrls)
    .where(
      and(
        ...scopeConditions,
        or(
          ilike(savedUrls.title, likeTerm),
          ilike(savedUrls.description, likeTerm),
          ilike(savedUrls.summary, likeTerm),
          ilike(savedUrls.domain, likeTerm),
          ilike(savedUrls.extractedText, likeTerm)
        )
      )
    )
    .orderBy(desc(savedUrls.createdAt))
    .limit(limit);

  return likeRows.map((row) => ({ ...row, rank: 0 }));
}

/**
 * A user's most recently saved items, unfiltered by any query match.
 * Used as a last-resort fallback by callers (like Ask) that want to
 * ground answers in the user's library even when keyword search finds
 * no literal overlap with the question — e.g. natural-language questions
 * or a library whose content language differs from the question's.
 */
export async function getRecentUserItems(
  userId: string,
  limit: number,
  dateRange: DateRange = {}
): Promise<SearchHit[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(savedUrls)
    .where(and(eq(savedUrls.userId, userId), ...dateRangeConditions(dateRange)))
    .orderBy(desc(savedUrls.createdAt))
    .limit(limit);

  return rows.map((row) => ({ ...row, rank: 0 }));
}
