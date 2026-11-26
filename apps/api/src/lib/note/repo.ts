import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import type {
  NoteDeltaOp,
  NoteDTO,
  NoteExportDraftDTO,
  NoteExportFormat,
  NoteInsightProfileDTO,
  NoteInsightStatsDTO,
  NoteItemDTO,
  NoteProjectDetailDTO,
  NoteProjectDTO,
  NoteSearchChatAnswerDTO,
  NoteSourceKind,
  NoteSuggestionDTO,
  NoteTagDTO,
} from "@/types/api";
import {
  analyseTendencies,
  answerSearchChat,
  rewriteForExport,
  summariseMemo,
  summariseSource,
} from "./ai";
import { deltaToMarkdown, deltaToPlainText, isDelta, legacyBlocksToDelta } from "./delta";
import { fetchAndExtract } from "./extract";
import { buildCorpus, type SearchDoc, textSearch, toHit } from "./search";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

function kindFromUrl(url: string): NoteSourceKind {
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

function toItem(row: SavedUrlRow): NoteItemDTO {
  const site = row.kind === "note" ? (row.domain ?? "メモ") : (row.domain ?? siteFromUrl(row.url));
  return {
    id: row.id,
    url: row.url,
    kind: row.kind as NoteSourceKind,
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

export async function listItems(userId: string): Promise<NoteItemDTO[]> {
  const db = getDb();
  const rows = await db.query.savedUrls.findMany({
    where: (t, { eq: eqOp }) => eqOp(t.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return rows.map(toItem);
}

export async function listImportable(userId: string): Promise<NoteItemDTO[]> {
  const db = getDb();
  const rows = await db.query.savedUrls.findMany({
    where: (t, { and: andOp, eq: eqOp, ne }) => andOp(eqOp(t.userId, userId), ne(t.kind, "note")),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  const items = rows.map(toItem);
  const worked = (it: NoteItemDTO) => it.summary.length > 0 || it.projectId !== null;
  return [...items.filter((it) => !worked(it)), ...items.filter(worked)];
}

export async function getItem(userId: string, id: string): Promise<NoteItemDTO | undefined> {
  if (!isUuid(id)) return undefined;
  const db = getDb();
  const row = await db.query.savedUrls.findFirst({
    where: (t, { and: andOp, eq: eqOp }) => andOp(eqOp(t.id, id), eqOp(t.userId, userId)),
  });
  return row ? toItem(row) : undefined;
}

export async function addItem(userId: string, url: string): Promise<NoteItemDTO> {
  const db = getDb();
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

export async function addMemo(userId: string, text: string): Promise<NoteItemDTO> {
  const db = getDb();
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

export async function finishReading(userId: string, id: string): Promise<NoteItemDTO | undefined> {
  if (!isUuid(id)) return undefined;
  const db = getDb();
  const existing = await db.query.savedUrls.findFirst({
    where: (t, { and: andOp, eq: eqOp }) => andOp(eqOp(t.id, id), eqOp(t.userId, userId)),
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
  patch: Partial<Pick<NoteItemDTO, "tags" | "projectId" | "title" | "summary">>
): Promise<NoteItemDTO | undefined> {
  const existing = await getItem(userId, id);
  if (!existing) return undefined;

  const db = getDb();
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
  if (!isUuid(id)) return false;
  const db = getDb();
  const deleted = await db
    .delete(schema.savedUrls)
    .where(and(eq(schema.savedUrls.id, id), eq(schema.savedUrls.userId, userId)))
    .returning({ id: schema.savedUrls.id });
  return deleted.length > 0;
}

// ── Projects & Tags ───────────────────────────────────────────

function toProjectRow(r: {
  id: string;
  name: string;
  description: string | null;
  tone: string;
  count: number;
}): NoteProjectDTO {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    tone: r.tone === "accent" ? "accent" : "neutral",
    count: r.count,
  };
}

export async function listProjects(userId: string): Promise<NoteProjectDTO[]> {
  const db = getDb();
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

export async function getProject(
  userId: string,
  id: string
): Promise<NoteProjectDetailDTO | undefined> {
  if (!isUuid(id)) return undefined;
  const project = (await listProjects(userId)).find((p) => p.id === id);
  if (!project) return undefined;

  const db = getDb();
  const sourceRows = await db.query.savedUrls.findMany({
    where: (t, { and: andOp, eq: eqOp }) => andOp(eqOp(t.userId, userId), eqOp(t.projectId, id)),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  const sources = sourceRows.map(toItem);

  const noteRows = await db.query.notes.findMany({
    where: (t, { and: andOp, eq: eqOp }) => andOp(eqOp(t.userId, userId), eqOp(t.projectId, id)),
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
): Promise<NoteProjectDTO> {
  const db = getDb();
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
): Promise<NoteProjectDTO | undefined> {
  if (!isUuid(id)) return undefined;
  const db = getDb();
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
  if (!isUuid(id)) return false;
  const db = getDb();
  const deleted = await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
    .returning({ id: schema.projects.id });
  return deleted.length > 0;
}

export async function listTags(userId: string): Promise<NoteTagDTO[]> {
  const db = getDb();
  const res: unknown = await db.execute(sql`
    select label, count(*)::int as n
    from saved_urls, unnest(tags) as label
    where user_id = ${userId}
    group by label
  `);
  const urlRows = (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as {
    label: string;
    n: number;
  }[];
  const urlCounts = new Map(urlRows.map((r) => [r.label, r.n]));

  const noteRows = await db.query.notes.findMany({
    where: (t, { eq: eqOp }) => eqOp(t.userId, userId),
  });
  const noteCounts = new Map<string, number>();
  for (const row of noteRows) {
    for (const t of row.tags as { label: string }[]) {
      noteCounts.set(t.label, (noteCounts.get(t.label) ?? 0) + 1);
    }
  }

  const labels = new Set([...urlCounts.keys(), ...noteCounts.keys()]);
  return [...labels]
    .map((label) => {
      const urlCount = urlCounts.get(label) ?? 0;
      const noteCount = noteCounts.get(label) ?? 0;
      return {
        id: `t-${encodeURIComponent(label)}`,
        label,
        tone: "neutral" as const,
        count: urlCount + noteCount,
        urlCount,
        noteCount,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// ── Notes ──────────────────────────────────────────────────

function toNote(row: typeof schema.notes.$inferSelect): NoteDTO {
  const rowBody = row.body as NoteDeltaOp[];
  const rowSug = row.suggestions as NoteSuggestionDTO[];
  const hasBody = isDelta(rowBody) && rowBody.length > 0;
  const hasSug = rowSug.length > 0;
  const legacy = hasBody && hasSug ? null : legacyBlocksToDelta(row.blocks);
  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? "",
    tags: row.tags as NoteDTO["tags"],
    status: row.status,
    updatedLabel: `自動保存 · ${relativeLabel(row.updatedAt)}`,
    body: hasBody ? rowBody : (legacy?.body ?? []),
    suggestions: hasSug ? rowSug : (legacy?.suggestions ?? []),
    sources: row.sources as NoteDTO["sources"],
    links: row.links as NoteDTO["links"],
    flags: row.flags as NoteDTO["flags"],
  };
}

export async function listNotes(userId: string): Promise<NoteDTO[]> {
  const db = getDb();
  const rows = await db.query.notes.findMany({
    where: (t, { eq: eqOp }) => eqOp(t.userId, userId),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });
  return rows.map(toNote);
}

export async function getSearchCorpus(userId: string): Promise<SearchDoc[]> {
  const [notes, items] = await Promise.all([listNotes(userId), listItems(userId)]);
  return buildCorpus(notes, items);
}

export async function runSearchChat(
  userId: string,
  query: string,
  history?: { role: "user" | "assistant"; content: string }[]
): Promise<NoteSearchChatAnswerDTO> {
  const corpus = await getSearchCorpus(userId);
  const hits = textSearch(corpus, query, 8);
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

export async function createNote(
  userId: string,
  input: {
    title?: string;
    projectId?: string | null;
    text?: string;
    body?: NoteDeltaOp[];
    suggestions?: NoteSuggestionDTO[];
    tags?: NoteDTO["tags"];
    status?: NoteDTO["status"];
    sources?: NoteDTO["sources"];
  } = {}
): Promise<NoteDTO> {
  const db = getDb();
  const body: NoteDeltaOp[] =
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

async function getNoteRow(userId: string, id: string) {
  if (!isUuid(id)) return undefined;
  const db = getDb();
  return db.query.notes.findFirst({
    where: (t, { and: andOp, eq: eqOp }) => andOp(eqOp(t.id, id), eqOp(t.userId, userId)),
  });
}

export async function getNote(userId: string, id: string): Promise<NoteDTO | undefined> {
  const row = await getNoteRow(userId, id);
  return row ? toNote(row) : undefined;
}

export async function updateNote(
  userId: string,
  id: string,
  patch: Partial<Pick<NoteDTO, "title" | "status" | "body" | "suggestions" | "tags" | "sources">> & {
    projectId?: string | null;
  }
): Promise<NoteDTO | undefined> {
  const row = await getNoteRow(userId, id);
  if (!row) return undefined;
  const db = getDb();
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
  if (!isUuid(id)) return false;
  const db = getDb();
  const deleted = await db
    .delete(schema.notes)
    .where(and(eq(schema.notes.id, id), eq(schema.notes.userId, userId)))
    .returning({ id: schema.notes.id });
  return deleted.length > 0;
}

export async function acceptSuggestion(
  userId: string,
  noteId: string,
  suggestionId: string
): Promise<NoteDTO | undefined> {
  const row = await getNoteRow(userId, noteId);
  if (!row) return undefined;
  const current = toNote(row).suggestions;
  if (!current.some((s) => s.id === suggestionId)) return toNote(row);
  const suggestions = current.filter((s) => s.id !== suggestionId);
  const flags = (row.flags as NoteDTO["flags"]).filter(
    (f) => !/未着手|未執筆|下書き|未完/.test(f.text)
  );
  const db = getDb();
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
): Promise<NoteDTO | undefined> {
  const row = await getNoteRow(userId, noteId);
  if (!row) return undefined;
  const suggestions = toNote(row).suggestions.filter((s) => s.id !== suggestionId);
  const db = getDb();
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
): Promise<NoteDTO | undefined> {
  const row = await getNoteRow(userId, noteId);
  if (!row) return undefined;
  const body = [...toNote(row).body];
  body.push({ insert: body.length ? `\n${text}\n` : `${text}\n` });
  const db = getDb();
  await db
    .update(schema.notes)
    .set({ body, updatedAt: new Date() })
    .where(eq(schema.notes.id, noteId));
  return getNote(userId, noteId);
}

// ── Insight (傾向分析) ──────────────────────────────────────

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

function toInsight(row: typeof schema.insightProfiles.$inferSelect): NoteInsightProfileDTO {
  return {
    projectId: row.projectId ?? "",
    generatedLabel: `分析 · ${relativeLabel(row.updatedAt)}`,
    llm: row.llm,
    stats: row.stats as unknown as NoteInsightStatsDTO,
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
): Promise<NoteInsightProfileDTO | undefined> {
  if (projectId && !isUuid(projectId)) return undefined;
  const db = getDb();
  const row = await db.query.insightProfiles.findFirst({
    where: (t, { and: andOp, eq: eqOp, isNull: isNullOp }) =>
      andOp(
        eqOp(t.userId, userId),
        projectId ? eqOp(t.projectId, projectId) : isNullOp(t.projectId)
      ),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });
  return row ? toInsight(row) : undefined;
}

export async function buildInsightProfile(
  userId: string,
  projectId?: string
): Promise<NoteInsightProfileDTO> {
  const scopedProjectId = projectId && isUuid(projectId) ? projectId : undefined;
  const db = getDb();

  const noteRows = await db.query.notes.findMany({
    where: (t, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(t.userId, userId), scopedProjectId ? eqOp(t.projectId, scopedProjectId) : undefined),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });
  const urlRows = await db.query.savedUrls.findMany({
    where: (t, { and: andOp, eq: eqOp, ne }) =>
      andOp(
        eqOp(t.userId, userId),
        ne(t.kind, "note"),
        scopedProjectId ? eqOp(t.projectId, scopedProjectId) : undefined
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

  const stats: NoteInsightStatsDTO = {
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
      kind: c.value as NoteSourceKind,
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
        scopedProjectId
          ? eq(schema.insightProfiles.projectId, scopedProjectId)
          : isNull(schema.insightProfiles.projectId)
      )
    );
  const [row] = await db
    .insert(schema.insightProfiles)
    .values({
      userId,
      projectId: scopedProjectId ?? null,
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
  format: NoteExportFormat = "blog"
): Promise<NoteExportDraftDTO> {
  const db = getDb();
  let note = await getNote(userId, noteId);
  if (!note) {
    const fallback = await db.query.notes.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.userId, userId),
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
