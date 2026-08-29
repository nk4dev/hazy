import { and, eq, isNull, sql } from "drizzle-orm";
import {
  rewriteForExport,
  suggestConnections,
  summariseMemo,
  summariseSource,
  synthesiseCompare,
} from "@/lib/ai";
import { fetchAndExtract } from "@/lib/extract";
import type {
  CompareBoard,
  Digest,
  ExportDraft,
  ExportFormat,
  GraphData,
  Item,
  Note,
  NoteBlock,
  Project,
  SourceKind,
  Tag,
} from "@/lib/types";
import { db, schema } from "./index";

// ─────────────────────────────────────────────────────────────
// Every function here is scoped by the caller's internal `users.id` (see
// lib/db/current-user.ts). This is the real replacement for lib/store.ts —
// same function names and return shapes, backed by Postgres instead of a
// mutable object on globalThis. The Drizzle schema is the shared `@repo/db`
// package (camelCase columns, `Date` timestamps).
// ─────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Guard lookups: an empty or malformed id must not reach Postgres as a
 * `::uuid` cast (it throws instead of returning no rows). */
const isUuid = (id: string): boolean => UUID_RE.test(id);

function relativeLabel(when: Date | string): string {
  const min = Math.floor((Date.now() - new Date(when).getTime()) / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return "今日";
  const days = Math.floor(hours / 24);
  return days === 1 ? "昨日" : `${days}日前`;
}

function kindFromUrl(url: string): SourceKind {
  const u = url.toLowerCase();
  if (u.includes("youtube") || u.includes("youtu.be") || u.includes("vimeo")) return "video";
  if (u.endsWith(".pdf") || u.includes("arxiv.org")) return "pdf";
  if (u.includes("twitter.com") || u.includes("x.com") || u.includes("bsky")) return "thread";
  return "article";
}

function siteFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

// ── Items ──────────────────────────────────────────────────
type SavedUrlWithLinks = typeof schema.savedUrls.$inferSelect & {
  collectionItems: { collectionId: string }[];
};

function toItem(row: SavedUrlWithLinks): Item {
  const site = row.kind === "note" ? (row.domain ?? "メモ") : (row.domain ?? siteFromUrl(row.url));
  return {
    id: row.id,
    url: row.url,
    kind: row.kind as SourceKind,
    site,
    title: row.title ?? site,
    addedAt: new Date(row.createdAt).toISOString(),
    addedLabel: relativeLabel(row.createdAt),
    status:
      row.fetchStatus === "success" ? "ready" : row.fetchStatus === "error" ? "ready" : "reading",
    durationLabel: row.durationLabel ?? undefined,
    summary: row.summaryLines,
    points: row.points,
    suggestedTags: row.suggestedTags,
    tags: row.tags,
    projectId: row.collectionItems[0]?.collectionId ?? null,
    quoteCandidates: row.quoteCandidates,
    relatedNoteId: row.relatedNoteId ?? undefined,
  };
}

export async function listItems(userId: string): Promise<Item[]> {
  const rows = await db.query.savedUrls.findMany({
    where: (t, { eq }) => eq(t.userId, userId),
    with: { collectionItems: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return rows.map(toItem);
}

/**
 * GET /api/items/importable — the "Hazyから追加" picker in the capture flow.
 * Every URL the user has in the hazy database (the `saved_urls` table this
 * app is connected to), newest first, so they can pull one into the note
 * pipeline (`/capture?id=…` → finishReading → 要約とタグ → 置き場所).
 *
 * Pasted memos (`kind: "note"`) are excluded — this is for real URLs. Items
 * hazy-note has already worked on (summary generated, or filed into a
 * project) are still listed; the picker marks them so and selecting one just
 * re-opens it. Unworked items sort to the top.
 */
export async function listImportable(userId: string): Promise<Item[]> {
  const rows = await db.query.savedUrls.findMany({
    where: (t, { and, eq, ne }) => and(eq(t.userId, userId), ne(t.kind, "note")),
    with: { collectionItems: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  const items = rows.map(toItem);
  const worked = (it: Item) => it.summary.length > 0 || it.projectId !== null;
  return [...items.filter((it) => !worked(it)), ...items.filter(worked)];
}

export async function getItem(userId: string, id: string): Promise<Item | undefined> {
  if (!isUuid(id)) return undefined;
  const row = await db.query.savedUrls.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.userId, userId)),
    with: { collectionItems: true },
  });
  return row ? toItem(row) : undefined;
}

export async function addItem(userId: string, url: string): Promise<Item> {
  const site = siteFromUrl(url);
  const [row] = await db
    .insert(schema.savedUrls)
    .values({
      userId,
      url,
      normalizedUrl: normalizeUrl(url),
      domain: site,
      title: site,
      kind: kindFromUrl(url),
      fetchStatus: "pending",
    })
    .onConflictDoUpdate({
      target: [schema.savedUrls.userId, schema.savedUrls.normalizedUrl],
      set: { fetchStatus: "pending", updatedAt: new Date() },
    })
    .returning();
  const item = await getItem(userId, row.id);
  if (!item) throw new Error("item vanished immediately after write");
  return item;
}

/**
 * POST /api/items — the memo path. A pasted memo becomes an item with no
 * external URL; `kind: "note"` and the raw text lives in `extracted_text`.
 */
export async function addMemo(userId: string, text: string): Promise<Item> {
  const token = `hazy:memo:${crypto.randomUUID()}`;
  const firstLine = text.trim().split("\n")[0].trim();
  const title = firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine || "メモ";
  const [row] = await db
    .insert(schema.savedUrls)
    .values({
      userId,
      url: token,
      normalizedUrl: token,
      domain: "メモ",
      title,
      kind: "note",
      extractedText: text,
      fetchStatus: "pending",
    })
    .returning();
  const item = await getItem(userId, row.id);
  if (!item) throw new Error("item vanished immediately after write");
  return item;
}

/**
 * POST /api/items/:id/read — the "読み取り" step. For a URL this fetches the
 * page, extracts its text, and asks the model for a summary + tags. For a
 * pasted memo it just distils what was written. Best-effort: a fetch or AI
 * failure still resolves the item (fetch_status "error") instead of throwing.
 *
 * "Hazyから追加" fast path: an item saved via the hazy app already has its
 * page text in `extracted_text`. If it's substantial, summarise straight from
 * that — no second network fetch, and a transient fetch failure can't downgrade
 * an item hazy already read successfully.
 */
export async function finishReading(userId: string, id: string): Promise<Item | undefined> {
  const existing = await db.query.savedUrls.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.userId, userId)),
  });
  if (!existing) return undefined;

  if (existing.kind !== "note" && (existing.extractedText?.trim().length ?? 0) >= 400) {
    const title =
      existing.title && existing.title !== existing.domain
        ? existing.title
        : (existing.domain ?? siteFromUrl(existing.url));
    const digest = await summariseSource({
      title,
      text: existing.extractedText ?? "",
      kind: existing.kind,
    });
    await db
      .update(schema.savedUrls)
      .set({
        fetchStatus: "success",
        title: digest.title?.trim() || title,
        durationLabel:
          existing.durationLabel ??
          (existing.estimatedReadMinutes ? `読了${existing.estimatedReadMinutes}分` : null),
        summaryLines: digest.summary,
        points: digest.points,
        suggestedTags: digest.suggestedTags,
        updatedAt: new Date(),
      })
      .where(eq(schema.savedUrls.id, id));
    return getItem(userId, id);
  }

  if (existing.kind === "note") {
    const digest = await summariseMemo(existing.extractedText ?? "");
    await db
      .update(schema.savedUrls)
      .set({
        fetchStatus: "success",
        summaryLines: digest.summary,
        points: digest.points,
        suggestedTags: digest.suggestedTags,
        updatedAt: new Date(),
      })
      .where(eq(schema.savedUrls.id, id));
    return getItem(userId, id);
  }

  let extracted: Awaited<ReturnType<typeof fetchAndExtract>>;
  try {
    extracted = await fetchAndExtract(existing.url);
  } catch (e) {
    await db
      .update(schema.savedUrls)
      .set({
        fetchStatus: "error",
        fetchError: (e as Error).message.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(schema.savedUrls.id, id));
    return getItem(userId, id);
  }

  const title =
    extracted.title?.trim() ||
    (existing.title && existing.title !== existing.domain
      ? existing.title
      : (existing.domain ?? siteFromUrl(existing.url)));

  const digest = await summariseSource({
    title,
    text: extracted.text,
    kind: existing.kind,
  });

  await db
    .update(schema.savedUrls)
    .set({
      fetchStatus: "success",
      title: digest.title?.trim() || title,
      description: extracted.description ?? existing.description,
      faviconUrl: extracted.favicon ?? existing.faviconUrl,
      ogImageUrl: extracted.ogImage ?? existing.ogImageUrl,
      extractedText: extracted.text || existing.extractedText,
      contentLanguage: extracted.lang ?? existing.contentLanguage,
      estimatedReadMinutes: extracted.readMinutes ?? existing.estimatedReadMinutes,
      durationLabel:
        existing.durationLabel ?? (extracted.readMinutes ? `読了${extracted.readMinutes}分` : null),
      summaryLines: digest.summary,
      points: digest.points,
      suggestedTags: digest.suggestedTags,
      updatedAt: new Date(),
    })
    .where(eq(schema.savedUrls.id, id));
  return getItem(userId, id);
}

export async function updateItem(
  userId: string,
  id: string,
  patch: Partial<Pick<Item, "tags" | "projectId" | "title" | "summary">>
): Promise<Item | undefined> {
  const existing = await getItem(userId, id);
  if (!existing) return undefined;

  const colPatch: Partial<typeof schema.savedUrls.$inferInsert> = {};
  if (patch.tags) colPatch.tags = patch.tags;
  if (patch.title !== undefined) colPatch.title = patch.title;
  if (patch.summary) colPatch.summaryLines = patch.summary;
  if (Object.keys(colPatch).length) {
    colPatch.updatedAt = new Date();
    await db.update(schema.savedUrls).set(colPatch).where(eq(schema.savedUrls.id, id));
  }

  if ("projectId" in patch) {
    await db.delete(schema.collectionItems).where(eq(schema.collectionItems.savedUrlId, id));
    if (patch.projectId) {
      await db
        .insert(schema.collectionItems)
        .values({ collectionId: patch.projectId, savedUrlId: id });
    }
  }

  return getItem(userId, id);
}

export async function deleteItem(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.savedUrls)
    .where(and(eq(schema.savedUrls.id, id), eq(schema.savedUrls.userId, userId)))
    .returning({ id: schema.savedUrls.id });
  return deleted.length > 0;
}

/** POST /api/items/sort — the "まとめて振り分け" digest action. */
export async function autoSort(userId: string): Promise<{ moved: number }> {
  const target = await db.query.collections.findFirst({
    where: (c, { and, eq }) => and(eq(c.userId, userId), eq(c.tone, "accent")),
  });
  if (!target) return { moved: 0 };

  const unsorted = await db
    .select({ id: schema.savedUrls.id })
    .from(schema.savedUrls)
    .leftJoin(schema.collectionItems, eq(schema.collectionItems.savedUrlId, schema.savedUrls.id))
    .where(
      and(
        eq(schema.savedUrls.userId, userId),
        isNull(schema.collectionItems.id),
        sql`cardinality(${schema.savedUrls.suggestedTags}) > 0`
      )
    );
  if (!unsorted.length) return { moved: 0 };

  await db
    .insert(schema.collectionItems)
    .values(unsorted.map((u) => ({ collectionId: target.id, savedUrlId: u.id })));
  return { moved: unsorted.length };
}

// ── Projects & Tags ───────────────────────────────────────────
export async function listProjects(userId: string): Promise<Project[]> {
  const rows = await db
    .select({
      id: schema.collections.id,
      name: schema.collections.name,
      tone: schema.collections.tone,
      count: sql<number>`count(${schema.collectionItems.id})::int`,
    })
    .from(schema.collections)
    .leftJoin(
      schema.collectionItems,
      eq(schema.collectionItems.collectionId, schema.collections.id)
    )
    .where(eq(schema.collections.userId, userId))
    .groupBy(schema.collections.id)
    .orderBy(schema.collections.createdAt);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tone: r.tone === "accent" ? "accent" : "neutral",
    count: r.count,
  }));
}

export async function createProject(
  userId: string,
  name: string,
  tone: "accent" | "neutral" = "neutral"
): Promise<Project> {
  const [row] = await db
    .insert(schema.collections)
    .values({ userId, name: name.trim() || "無題", tone })
    .returning();
  return {
    id: row.id,
    name: row.name,
    tone: row.tone === "accent" ? "accent" : "neutral",
    count: 0,
  };
}

export async function updateProject(
  userId: string,
  id: string,
  patch: { name?: string; tone?: "accent" | "neutral" }
): Promise<Project | undefined> {
  const set: Partial<typeof schema.collections.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name.trim() || "無題";
  if (patch.tone !== undefined) set.tone = patch.tone;
  if (Object.keys(set).length) {
    set.updatedAt = new Date();
    await db
      .update(schema.collections)
      .set(set)
      .where(and(eq(schema.collections.id, id), eq(schema.collections.userId, userId)));
  }
  return (await listProjects(userId)).find((p) => p.id === id);
}

export async function deleteProject(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.collections)
    .where(and(eq(schema.collections.id, id), eq(schema.collections.userId, userId)))
    .returning({ id: schema.collections.id });
  return deleted.length > 0;
}

export async function listTags(userId: string): Promise<Tag[]> {
  const res: unknown = await db.execute(sql`
    select label, count(*)::int as n
    from saved_urls, unnest(tags) as label
    where user_id = ${userId}
    group by label
    order by n desc, label
  `);
  // postgres.js returns an array; neon-http returns { rows }.
  const rows = (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as {
    label: string;
    n: number;
  }[];
  return rows.map((r) => ({
    id: `t-${encodeURIComponent(r.label)}`,
    label: r.label,
    tone: "neutral",
    count: r.n,
  }));
}

export async function getDigest(userId: string): Promise<Digest> {
  const [row] = await db
    .select({
      unsorted: sql<number>`count(*) filter (where ${schema.collectionItems.id} is null)::int`,
      guess: sql<number>`count(*) filter (where ${schema.collectionItems.id} is null and cardinality(${schema.savedUrls.suggestedTags}) > 0)::int`,
    })
    .from(schema.savedUrls)
    .leftJoin(schema.collectionItems, eq(schema.collectionItems.savedUrlId, schema.savedUrls.id))
    .where(eq(schema.savedUrls.userId, userId));

  const target = await db.query.collections.findFirst({
    where: (c, { and, eq }) => and(eq(c.userId, userId), eq(c.tone, "accent")),
  });

  const unsorted = row?.unsorted ?? 0;
  const guess = row?.guess ?? 0;
  return {
    unsorted,
    message:
      guess > 0 && target
        ? `未整理が${unsorted}件。${guess}件は「${target.name}」に入りそうです。`
        : `未整理が${unsorted}件。`,
  };
}

// ── Notes ──────────────────────────────────────────────────
function toNote(row: typeof schema.notes.$inferSelect): Note {
  return {
    id: row.id,
    title: row.title,
    projectId: row.collectionId ?? "",
    tags: row.tags as Note["tags"],
    status: row.status,
    updatedLabel: `自動保存 · ${relativeLabel(row.updatedAt)}`,
    blocks: row.blocks as NoteBlock[],
    sources: row.sources as Note["sources"],
    links: row.links as Note["links"],
    flags: row.flags as Note["flags"],
  };
}

export async function listNotes(userId: string): Promise<Note[]> {
  const rows = await db.query.notes.findMany({
    where: (t, { eq }) => eq(t.userId, userId),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });
  return rows.map(toNote);
}

/**
 * Create a note. The client only calls this once a `/notes/new` draft has
 * actual content (a paragraph, a title change, a tag…), so `blocks` / `tags` /
 * `status` may already carry that first edit.
 */
export async function createNote(
  userId: string,
  input: {
    title?: string;
    projectId?: string | null;
    text?: string;
    blocks?: NoteBlock[];
    tags?: Note["tags"];
    status?: Note["status"];
    sources?: Note["sources"];
  } = {}
): Promise<Note> {
  const blocks: NoteBlock[] =
    input.blocks ?? (input.text?.trim() ? [{ type: "p", text: input.text.trim() }] : []);
  const [row] = await db
    .insert(schema.notes)
    .values({
      userId,
      collectionId: input.projectId || null,
      title: input.title?.trim() || "無題のノート",
      status: input.status ?? "draft",
      tags: input.tags ?? [],
      blocks,
      sources: input.sources ?? [],
      links: [],
      flags: [],
    })
    .returning();
  return toNote(row);
}

export async function updateNote(
  userId: string,
  id: string,
  patch: Partial<Pick<Note, "title" | "status" | "projectId" | "blocks" | "tags" | "sources">>
): Promise<Note | undefined> {
  const row = await getNoteRow(userId, id);
  if (!row) return undefined;
  const set: Partial<typeof schema.notes.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.title !== undefined) set.title = patch.title.trim() || "無題のノート";
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.projectId !== undefined) set.collectionId = patch.projectId || null;
  if (patch.blocks !== undefined) set.blocks = patch.blocks;
  if (patch.tags !== undefined) set.tags = patch.tags;
  if (patch.sources !== undefined) set.sources = patch.sources;
  await db.update(schema.notes).set(set).where(eq(schema.notes.id, id));
  return getNote(userId, id);
}

export async function deleteNote(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.notes)
    .where(and(eq(schema.notes.id, id), eq(schema.notes.userId, userId)))
    .returning({ id: schema.notes.id });
  return deleted.length > 0;
}

export async function getNote(userId: string, id: string): Promise<Note | undefined> {
  if (!isUuid(id)) return undefined;
  const row = await db.query.notes.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.userId, userId)),
  });
  return row ? toNote(row) : undefined;
}

async function getNoteRow(userId: string, id: string) {
  if (!isUuid(id)) return undefined;
  return db.query.notes.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.userId, userId)),
  });
}

export async function acceptSuggestion(
  userId: string,
  noteId: string,
  blockIndex: number
): Promise<Note | undefined> {
  const row = await getNoteRow(userId, noteId);
  if (!row) return undefined;
  const blocks = row.blocks as NoteBlock[];
  const block = blocks[blockIndex];
  if (block && block.type === "suggestion") {
    blocks[blockIndex] = { type: "p", text: block.text, refs: block.ref };
    // Drop any "未着手 / 未執筆 / 下書き" style flag now that the block is filled.
    const flags = (row.flags as Note["flags"]).filter(
      (f) => !/未着手|未執筆|下書き|未完/.test(f.text)
    );
    await db
      .update(schema.notes)
      .set({ blocks, flags, updatedAt: new Date() })
      .where(eq(schema.notes.id, noteId));
  }
  return getNote(userId, noteId);
}

export async function dismissSuggestion(
  userId: string,
  noteId: string,
  blockIndex: number
): Promise<Note | undefined> {
  const row = await getNoteRow(userId, noteId);
  if (!row) return undefined;
  const blocks = row.blocks as NoteBlock[];
  if (blocks[blockIndex]?.type === "suggestion") {
    blocks.splice(blockIndex, 1);
    await db
      .update(schema.notes)
      .set({ blocks, updatedAt: new Date() })
      .where(eq(schema.notes.id, noteId));
  }
  return getNote(userId, noteId);
}

export async function appendParagraph(
  userId: string,
  noteId: string,
  text: string
): Promise<Note | undefined> {
  const row = await getNoteRow(userId, noteId);
  if (!row) return undefined;
  const blocks = [...(row.blocks as NoteBlock[]), { type: "p" as const, text }];
  await db
    .update(schema.notes)
    .set({ blocks, updatedAt: new Date() })
    .where(eq(schema.notes.id, noteId));
  return getNote(userId, noteId);
}

// ── Compare ────────────────────────────────────────────────
function toCompare(row: typeof schema.compareBoards.$inferSelect): CompareBoard {
  return {
    id: row.id,
    projectId: row.collectionId ?? "",
    sources: row.sources,
    axes: row.axes as CompareBoard["axes"],
    summary: row.summary,
    candidateAxes: row.candidateAxes,
  };
}

export async function getCompare(userId: string): Promise<CompareBoard | undefined> {
  const row = await db.query.compareBoards.findFirst({
    where: (t, { eq }) => eq(t.userId, userId),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });
  return row ? toCompare(row) : undefined;
}

/**
 * "差分をまとめる" — (re)build the compare board from the ready sources in a
 * project (or, with no project, every ready source). Needs ≥2 sources.
 */
export async function buildCompareBoard(userId: string, projectId?: string): Promise<CompareBoard> {
  const rows = await db.query.savedUrls.findMany({
    where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.fetchStatus, "success")),
    with: { collectionItems: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  const items = rows
    .map(toItem)
    .filter((it) => (projectId ? it.projectId === projectId : true))
    .filter((it) => it.summary.length > 0)
    .slice(0, 8);

  const synth = await synthesiseCompare(
    items.map((it) => ({ title: it.title, summary: it.summary }))
  );

  await db
    .delete(schema.compareBoards)
    .where(
      and(
        eq(schema.compareBoards.userId, userId),
        projectId
          ? eq(schema.compareBoards.collectionId, projectId)
          : isNull(schema.compareBoards.collectionId)
      )
    );
  const [row] = await db
    .insert(schema.compareBoards)
    .values({
      userId,
      collectionId: projectId ?? null,
      sources: items.map((it) => it.title),
      axes: synth.axes,
      summary: synth.summary,
      candidateAxes: synth.candidateAxes,
    })
    .returning();
  return toCompare(row);
}

// ── Graph ──────────────────────────────────────────────────
const GRAPH_W = 840;
const GRAPH_H = 600;

/** Deterministic ring layout so re-renders don't jump nodes around. */
function ringLayout(n: number, i: number, radius: number) {
  if (n === 1) return { x: GRAPH_W / 2, y: GRAPH_H / 2 };
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Math.round(GRAPH_W / 2 + Math.cos(a) * radius),
    y: Math.round(GRAPH_H / 2 + Math.sin(a) * radius),
  };
}

export async function buildGraph(userId: string): Promise<GraphData> {
  const notes = await listNotes(userId);
  const sourceRows = await db.query.savedUrls.findMany({
    where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.fetchStatus, "success")),
    with: { collectionItems: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  const sources = sourceRows.map(toItem).slice(0, 12);

  const noteIds = new Set(notes.map((n) => n.id));
  const nodes: GraphData["nodes"] = [
    ...notes.map((n, i) => ({
      id: n.id,
      label: n.title,
      kind: "note" as const,
      ...ringLayout(Math.max(notes.length, 1), i, notes.length > 3 ? 150 : 90),
      r: 40,
      focus: i === 0 && notes.length > 0,
    })),
    ...sources.map((s, i) => ({
      id: s.id,
      label: s.title,
      kind: "source" as const,
      ...ringLayout(Math.max(sources.length, 1), i, 250),
      r: 26,
    })),
  ];

  const edges: GraphData["edges"] = [];
  // note → note links the user (or a prior AI pass) already recorded.
  for (const n of notes) {
    for (const l of n.links) {
      if (noteIds.has(l.noteId) && n.id < l.noteId) {
        edges.push({
          id: `c-${n.id}-${l.noteId}`,
          from: n.id,
          to: l.noteId,
          kind: "citation",
          title: `${n.title} ↔ ${l.title}`,
          reason: l.reason,
        });
      }
    }
  }
  // source → note when the capture was filed against a note.
  for (const s of sources) {
    if (s.relatedNoteId && noteIds.has(s.relatedNoteId)) {
      edges.push({
        id: `c-${s.id}-${s.relatedNoteId}`,
        from: s.id,
        to: s.relatedNoteId,
        kind: "citation",
        title: `${s.title} → ノート`,
      });
    }
  }
  // AI-guessed connections between anything not already linked.
  const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
  const guesses = await suggestConnections([
    ...notes.map((n) => ({
      id: n.id,
      label: n.title,
      text: n.blocks.map((b) => ("text" in b ? b.text : "")).join(" "),
    })),
    ...sources.map((s) => ({ id: s.id, label: s.title, text: s.summary.join(" ") })),
  ]);
  for (const g of guesses) {
    const key = [g.from, g.to].sort().join("-");
    if (edges.some((e) => [e.from, e.to].sort().join("-") === key)) continue;
    edges.push({ id: `h-${key}`, from: g.from, to: g.to, kind: "hypothesis", reason: g.reason });
    linked.add(g.from);
    linked.add(g.to);
  }

  const isolated = [...notes, ...sources]
    .filter((x) => !linked.has(x.id) && !edges.some((e) => e.from === x.id || e.to === x.id))
    .map((x) => ("title" in x ? x.title : ""))
    .filter(Boolean);

  await db
    .insert(schema.graphSnapshots)
    .values({ userId, nodes, edges, isolated })
    .onConflictDoUpdate({
      target: schema.graphSnapshots.userId,
      set: { nodes, edges, isolated, updatedAt: new Date() },
    });
  return { nodes, edges, isolated };
}

export async function getGraph(userId: string): Promise<GraphData> {
  const row = await db.query.graphSnapshots.findFirst({
    where: (t, { eq }) => eq(t.userId, userId),
  });
  if (row) {
    return {
      nodes: row.nodes as GraphData["nodes"],
      edges: row.edges as GraphData["edges"],
      isolated: row.isolated as string[],
    };
  }
  return buildGraph(userId);
}

// ── Export ─────────────────────────────────────────────────
function countChars(blocks: { text?: string }[]): number {
  return blocks.reduce((n, b) => n + (b.text?.length ?? 0), 0);
}

export async function buildExport(
  userId: string,
  noteId: string,
  format: ExportFormat = "blog"
): Promise<ExportDraft> {
  let note = await getNote(userId, noteId);
  if (!note) {
    const fallback = await db.query.notes.findFirst({
      where: (t, { eq }) => eq(t.userId, userId),
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
    });
    note = fallback ? toNote(fallback) : undefined;
  }
  if (!note) {
    return {
      format,
      meta: "ノートがありません",
      title: "書き出すノートがありません",
      blocks: [{ type: "p", text: "先にノートを作成してください。" }],
      provenance: [],
    };
  }

  const draft = await rewriteForExport({
    title: note.title,
    blocks: note.blocks,
    format,
  });
  const chars = countChars(draft.blocks);
  const minutes = Math.max(1, Math.round(chars / 500));
  const meta =
    format === "bullets"
      ? `${draft.blocks.filter((b) => b.type === "p").length}項目`
      : `約${chars.toLocaleString()}字 · 読了${minutes}分`;

  return { format, meta, ...draft };
}
