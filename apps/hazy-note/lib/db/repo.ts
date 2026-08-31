import { and, eq, isNull, sql } from "drizzle-orm";
import {
  analyseTendencies,
  answerSearchChat,
  rewriteForExport,
  summariseMemo,
  summariseSource,
} from "@/lib/ai";
import { fetchAndExtract } from "@/lib/extract";
import {
  type DeltaOp,
  deltaToMarkdown,
  deltaToPlainText,
  isDelta,
  legacyBlocksToDelta,
} from "@/lib/note-delta";
import { buildCorpus, type SearchDoc, textSearch, toHit } from "@/lib/search";
import type {
  ExportDraft,
  ExportFormat,
  InsightProfile,
  InsightStats,
  Item,
  Note,
  NoteSuggestion,
  Project,
  ProjectDetail,
  SearchChatAnswer,
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
type SavedUrlRow = typeof schema.savedUrls.$inferSelect;

function toItem(row: SavedUrlRow): Item {
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
    projectId: row.projectId ?? null,
    quoteCandidates: row.quoteCandidates,
    relatedNoteId: row.relatedNoteId ?? undefined,
  };
}

export async function listItems(userId: string): Promise<Item[]> {
  const rows = await db.query.savedUrls.findMany({
    where: (t, { eq }) => eq(t.userId, userId),
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
    await db
      .update(schema.savedUrls)
      .set({ projectId: patch.projectId || null, updatedAt: new Date() })
      .where(eq(schema.savedUrls.id, id));
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

// ── Projects & Tags ───────────────────────────────────────────
// A "project" (hazy-note's own `projects` table — separate from hazy's
// `collections`) is a space the user creates deliberately to develop an idea:
// `description`, the sources filed under it (`saved_urls.project_id`) and the
// notes under it (`notes.project_id`). `tone` is just a colour.

function toProjectRow(r: {
  id: string;
  name: string;
  description: string | null;
  tone: string;
  count: number;
}): Project {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    tone: r.tone === "accent" ? "accent" : "neutral",
    count: r.count,
  };
}

export async function listProjects(userId: string): Promise<Project[]> {
  const rows = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      description: schema.projects.description,
      tone: schema.projects.tone,
      count: sql<number>`count(${schema.savedUrls.id})::int`,
    })
    .from(schema.projects)
    .leftJoin(schema.savedUrls, eq(schema.savedUrls.projectId, schema.projects.id))
    .where(eq(schema.projects.userId, userId))
    .groupBy(schema.projects.id)
    .orderBy(schema.projects.createdAt);
  return rows.map(toProjectRow);
}

/** GET /api/projects/:id — the project workspace: its idea, sources and notes. */
export async function getProject(userId: string, id: string): Promise<ProjectDetail | undefined> {
  if (!isUuid(id)) return undefined;
  const project = (await listProjects(userId)).find((p) => p.id === id);
  if (!project) return undefined;

  const sourceRows = await db.query.savedUrls.findMany({
    where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.projectId, id)),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  const sources = sourceRows.map(toItem);

  const noteRows = await db.query.notes.findMany({
    where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.projectId, id)),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });
  const notes = noteRows.map((n) => ({
    id: n.id,
    title: n.title,
    status: n.status,
    updatedLabel: relativeLabel(n.updatedAt),
  }));

  return { ...project, sources, notes };
}

export async function createProject(
  userId: string,
  name: string,
  opts: { tone?: "accent" | "neutral"; description?: string } = {}
): Promise<Project> {
  const [row] = await db
    .insert(schema.projects)
    .values({
      userId,
      name: name.trim() || "無題のプロジェクト",
      tone: opts.tone ?? "neutral",
      description: opts.description?.trim() || null,
    })
    .returning();
  return toProjectRow({ ...row, count: 0 });
}

export async function updateProject(
  userId: string,
  id: string,
  patch: { name?: string; description?: string | null; tone?: "accent" | "neutral" }
): Promise<Project | undefined> {
  const set: Partial<typeof schema.projects.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name.trim() || "無題のプロジェクト";
  if (patch.description !== undefined) set.description = patch.description?.trim() || null;
  if (patch.tone !== undefined) set.tone = patch.tone;
  if (Object.keys(set).length) {
    set.updatedAt = new Date();
    await db
      .update(schema.projects)
      .set(set)
      .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)));
  }
  return (await listProjects(userId)).find((p) => p.id === id);
}

export async function deleteProject(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
    .returning({ id: schema.projects.id });
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

// ── Notes ──────────────────────────────────────────────────
function toNote(row: typeof schema.notes.$inferSelect): Note {
  // Notes written before the Quill editor only have `blocks`; convert on read
  // (persisted back to `body` / `suggestions` on the next save).
  const rowBody = row.body as DeltaOp[];
  const rowSug = row.suggestions as NoteSuggestion[];
  const hasBody = isDelta(rowBody) && rowBody.length > 0;
  const hasSug = rowSug.length > 0;
  const legacy = hasBody && hasSug ? null : legacyBlocksToDelta(row.blocks);
  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? "",
    tags: row.tags as Note["tags"],
    status: row.status,
    updatedLabel: `自動保存 · ${relativeLabel(row.updatedAt)}`,
    body: hasBody ? rowBody : (legacy?.body ?? []),
    suggestions: hasSug ? rowSug : (legacy?.suggestions ?? []),
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

/** Notes + sources flattened to text — the corpus behind `/search` chat mode. */
export async function getSearchCorpus(userId: string): Promise<SearchDoc[]> {
  const [notes, items] = await Promise.all([listNotes(userId), listItems(userId)]);
  return buildCorpus(notes, items);
}

/**
 * Chat search: keyword-retrieve a shortlist from the user's library, let the
 * model answer over it, and hand back the answer + the records it cited.
 */
export async function runSearchChat(
  userId: string,
  query: string,
  history?: { role: "user" | "assistant"; content: string }[]
): Promise<SearchChatAnswer> {
  const corpus = await getSearchCorpus(userId);
  const hits = textSearch(corpus, query, 8);
  // Nothing matched on keywords — give the model the most recent slice anyway.
  const shortlist = hits.length
    ? hits.map((h) => corpus.find((d) => d.id === h.id))
    : corpus.slice(0, 8);
  const docs = shortlist.filter((d): d is SearchDoc => Boolean(d));

  const { answer, usedIndexes, llm } = await answerSearchChat({
    query,
    history,
    candidates: docs.map((d) => ({ title: d.title, text: d.text })),
  });

  const usedDocs = usedIndexes.length
    ? usedIndexes.map((i) => docs[i - 1]).filter((d): d is SearchDoc => Boolean(d))
    : docs;
  return { answer, sources: usedDocs.map((d) => toHit(d)), llm };
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
    body?: DeltaOp[];
    suggestions?: NoteSuggestion[];
    tags?: Note["tags"];
    status?: Note["status"];
    sources?: Note["sources"];
  } = {}
): Promise<Note> {
  const body: DeltaOp[] =
    input.body ?? (input.text?.trim() ? [{ insert: `${input.text.trim()}\n` }] : []);
  const [row] = await db
    .insert(schema.notes)
    .values({
      userId,
      projectId: input.projectId || null,
      title: input.title?.trim() || "無題のノート",
      status: input.status ?? "draft",
      tags: input.tags ?? [],
      blocks: [],
      body,
      suggestions: input.suggestions ?? [],
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
  patch: Partial<
    Pick<Note, "title" | "status" | "projectId" | "body" | "suggestions" | "tags" | "sources">
  >
): Promise<Note | undefined> {
  const row = await getNoteRow(userId, id);
  if (!row) return undefined;
  const set: Partial<typeof schema.notes.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.title !== undefined) set.title = patch.title.trim() || "無題のノート";
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.projectId !== undefined) set.projectId = patch.projectId || null;
  if (patch.body !== undefined) set.body = patch.body;
  if (patch.suggestions !== undefined) set.suggestions = patch.suggestions;
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

/**
 * Accept a sidebar suggestion: the client has already inserted its text into
 * the Quill body (and that save is in flight), so here we just drop it from the
 * list and clear any "未着手 / 未執筆 / 下書き" flag.
 */
export async function acceptSuggestion(
  userId: string,
  noteId: string,
  suggestionId: string
): Promise<Note | undefined> {
  const row = await getNoteRow(userId, noteId);
  if (!row) return undefined;
  const current = toNote(row).suggestions;
  if (!current.some((s) => s.id === suggestionId)) return toNote(row);
  const suggestions = current.filter((s) => s.id !== suggestionId);
  const flags = (row.flags as Note["flags"]).filter(
    (f) => !/未着手|未執筆|下書き|未完/.test(f.text)
  );
  await db
    .update(schema.notes)
    .set({ suggestions, flags, updatedAt: new Date() })
    .where(eq(schema.notes.id, noteId));
  return getNote(userId, noteId);
}

export async function dismissSuggestion(
  userId: string,
  noteId: string,
  suggestionId: string
): Promise<Note | undefined> {
  const row = await getNoteRow(userId, noteId);
  if (!row) return undefined;
  const suggestions = toNote(row).suggestions.filter((s) => s.id !== suggestionId);
  await db
    .update(schema.notes)
    .set({ suggestions, updatedAt: new Date() })
    .where(eq(schema.notes.id, noteId));
  return getNote(userId, noteId);
}

export async function appendParagraph(
  userId: string,
  noteId: string,
  text: string
): Promise<Note | undefined> {
  const row = await getNoteRow(userId, noteId);
  if (!row) return undefined;
  const body = [...toNote(row).body];
  body.push({ insert: body.length ? `\n${text}\n` : `${text}\n` });
  await db
    .update(schema.notes)
    .set({ body, updatedAt: new Date() })
    .where(eq(schema.notes.id, noteId));
  return getNote(userId, noteId);
}

// ── Insight (傾向分析) ──────────────────────────────────────

/** Count occurrences of `key(x)` over `xs` and return the top `n`, desc. */
function topCounts<T>(
  xs: T[],
  key: (x: T) => string | null | undefined,
  n: number
): { value: string; count: number }[] {
  const m = new Map<string, number>();
  for (const x of xs) {
    const k = key(x)?.trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function toInsight(row: typeof schema.insightProfiles.$inferSelect): InsightProfile {
  return {
    projectId: row.projectId ?? "",
    generatedLabel: `分析 · ${relativeLabel(row.updatedAt)}`,
    llm: row.llm,
    stats: row.stats as unknown as InsightStats,
    profile: row.profile,
    themes: row.themes,
    leanings: row.leanings,
    blindSpots: row.blindSpots,
    nextSteps: row.nextSteps,
  };
}

export async function getInsightProfile(
  userId: string,
  projectId?: string
): Promise<InsightProfile | undefined> {
  const row = await db.query.insightProfiles.findFirst({
    where: (t, { and, eq, isNull: _isNull }) =>
      and(eq(t.userId, userId), projectId ? eq(t.projectId, projectId) : _isNull(t.projectId)),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });
  return row ? toInsight(row) : undefined;
}

/**
 * "傾向を分析する" — aggregate the user's notes + saved URLs (optionally scoped
 * to one project) into `InsightStats`, then ask the model for the interpretive
 * layer. One cached row per (user, project|null), replaced on each rebuild.
 */
export async function buildInsightProfile(
  userId: string,
  projectId?: string
): Promise<InsightProfile> {
  const noteRows = await db.query.notes.findMany({
    where: (t, { and, eq }) =>
      and(eq(t.userId, userId), projectId ? eq(t.projectId, projectId) : undefined),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });
  const urlRows = await db.query.savedUrls.findMany({
    where: (t, { and, eq, ne }) =>
      and(
        eq(t.userId, userId),
        ne(t.kind, "note"),
        projectId ? eq(t.projectId, projectId) : undefined
      ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const notes = noteRows
    .map((r) => ({ title: r.title, text: deltaToPlainText(r.body).trim(), createdAt: r.createdAt }))
    .filter((n) => n.text.length > 0);

  const now = Date.now();
  const day = 86_400_000;
  const noteCharTotal = notes.reduce((n, x) => n + x.text.length, 0);

  const tagBag = [
    ...noteRows.flatMap((r) => (r.tags as { label: string }[]).map((t) => t.label)),
    ...urlRows.flatMap((r) => r.tags),
  ];

  const allDates = [...noteRows.map((r) => r.createdAt), ...urlRows.map((r) => r.createdAt)].sort(
    (a, b) => +new Date(a) - +new Date(b)
  );

  const stats: InsightStats = {
    noteCount: notes.length,
    noteCharTotal,
    noteCharAvg: notes.length ? Math.round(noteCharTotal / notes.length) : 0,
    notesLast30d: notes.filter((n) => now - +new Date(n.createdAt) < 30 * day).length,
    urlCount: urlRows.length,
    urlReadCount: urlRows.filter((r) => r.fetchStatus === "success").length,
    topDomains: topCounts(urlRows, (r) => r.domain, 6).map((c) => ({
      domain: c.value,
      count: c.count,
    })),
    kindMix: topCounts(urlRows, (r) => r.kind, 6).map((c) => ({
      kind: c.value as SourceKind,
      count: c.count,
    })),
    topTags: topCounts(tagBag, (t) => t.toLowerCase(), 12).map((c) => ({
      label: c.value,
      count: c.count,
    })),
    languageMix: topCounts(urlRows, (r) => r.contentLanguage, 4).map((c) => ({
      lang: c.value,
      count: c.count,
    })),
    span: allDates.length
      ? {
          firstLabel: relativeLabel(allDates[0]),
          lastLabel: relativeLabel(allDates[allDates.length - 1]),
        }
      : null,
  };

  const read = await analyseTendencies({
    stats,
    noteExcerpts: notes.map((n) => ({ title: n.title, text: n.text })),
    urlBlurbs: urlRows.map((r) => ({
      title: r.title ?? r.domain ?? r.url,
      domain: r.domain ?? "",
      summary: r.summary ?? r.summaryLines.join(" "),
    })),
  });

  await db
    .delete(schema.insightProfiles)
    .where(
      and(
        eq(schema.insightProfiles.userId, userId),
        projectId
          ? eq(schema.insightProfiles.projectId, projectId)
          : isNull(schema.insightProfiles.projectId)
      )
    );
  const [row] = await db
    .insert(schema.insightProfiles)
    .values({
      userId,
      projectId: projectId ?? null,
      stats: stats as unknown as Record<string, unknown>,
      profile: read.profile,
      themes: read.themes,
      leanings: read.leanings,
      blindSpots: read.blindSpots,
      nextSteps: read.nextSteps,
      llm: read.llm,
      updatedAt: new Date(),
    })
    .returning();
  return toInsight(row);
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
    markdown: deltaToMarkdown(note.body),
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
