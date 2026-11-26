import { Hono } from "hono";
import { z } from "zod";
import { ok } from "@/lib/api/response";
import {
  buildExport,
  buildInsightProfile,
  getInsightProfile,
  listTags,
  runSearchChat,
} from "@/lib/note/repo";
import type { NoteInsightProfileDTO } from "@/types/api";
import type { AppEnv } from "@/types/hono";
import { noteItems } from "./items";
import { noteNotes } from "./notes";
import { noteProjects } from "./projects";

export const noteRoutes = new Hono<AppEnv>();

noteRoutes.route("/items", noteItems);
noteRoutes.route("/notes", noteNotes);
noteRoutes.route("/projects", noteProjects);

noteRoutes.get("/tags", async (c) => {
  const user = c.get("user");
  return ok(await listTags(user.id));
});

const searchChatSchema = z.object({
  query: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

noteRoutes.post("/search/chat", async (c) => {
  const user = c.get("user");
  const body = searchChatSchema.parse(await c.req.json().catch(() => ({})));
  const query = body.query?.trim() ?? "";
  if (!query) {
    return ok({ answer: "", sources: [], llm: false });
  }
  const history = body.history?.slice(-6);
  return ok(await runSearchChat(user.id, query, history));
});

const EMPTY_INSIGHT: NoteInsightProfileDTO = {
  projectId: "",
  generatedLabel: "",
  llm: false,
  stats: {
    noteCount: 0,
    noteCharTotal: 0,
    noteCharAvg: 0,
    notesLast30d: 0,
    urlCount: 0,
    urlReadCount: 0,
    topDomains: [],
    kindMix: [],
    topTags: [],
    languageMix: [],
    span: null,
  },
  profile: "",
  themes: [],
  leanings: [],
  blindSpots: [],
  nextSteps: [],
};

noteRoutes.get("/analyze", async (c) => {
  const user = c.get("user");
  const projectId = c.req.query("project") ?? undefined;
  return ok((await getInsightProfile(user.id, projectId)) ?? EMPTY_INSIGHT);
});

const rebuildAnalyzeSchema = z.object({
  projectId: z.string().optional(),
});

noteRoutes.post("/analyze", async (c) => {
  const user = c.get("user");
  const body = rebuildAnalyzeSchema.parse(await c.req.json().catch(() => ({})));
  return ok(await buildInsightProfile(user.id, body.projectId));
});

const exportQuerySchema = z.object({
  noteId: z.string().default(""),
  format: z.enum(["blog", "memo", "bullets"]).default("blog"),
});

noteRoutes.get("/export", async (c) => {
  const user = c.get("user");
  const { noteId, format } = exportQuerySchema.parse({
    noteId: c.req.query("noteId") ?? "",
    format: c.req.query("format") ?? "blog",
  });
  return ok(await buildExport(user.id, noteId, format));
});

const runExportSchema = z.object({
  noteId: z.string().default(""),
  format: z.enum(["blog", "memo", "bullets"]).default("blog"),
});

noteRoutes.post("/export", async (c) => {
  const user = c.get("user");
  const { noteId, format } = runExportSchema.parse(await c.req.json().catch(() => ({})));
  const draft = await buildExport(user.id, noteId, format);
  return ok({
    ...draft,
    exportedTo: format === "memo" ? "社内共有 (clipboard)" : "Markdown (download)",
  });
});
