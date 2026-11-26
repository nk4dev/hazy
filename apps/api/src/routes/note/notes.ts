import { Hono } from "hono";
import { z } from "zod";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import {
  acceptSuggestion,
  appendParagraph,
  createNote,
  deleteNote,
  dismissSuggestion,
  getNote,
  listNotes,
  updateNote,
} from "@/lib/note/repo";
import type { AppEnv } from "@/types/hono";

export const noteNotes = new Hono<AppEnv>();

const deltaOpSchema = z.object({
  insert: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  retain: z.union([z.number(), z.record(z.string(), z.unknown())]).optional(),
  delete: z.number().optional(),
});

const suggestionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  text: z.string(),
  ref: z.string().optional(),
});

const tagBadgeSchema = z.object({
  label: z.string(),
  tone: z.enum(["accent", "neutral", "outline"]),
});

const sourceRefSchema = z.object({
  n: z.number(),
  label: z.string(),
  cited: z.boolean(),
  url: z.string().optional(),
});

noteNotes.get("/", async (c) => {
  const user = c.get("user");
  return ok(await listNotes(user.id));
});

const createNoteSchema = z.object({
  title: z.string().optional(),
  projectId: z.string().nullable().optional(),
  text: z.string().optional(),
  body: z.array(deltaOpSchema).optional(),
  suggestions: z.array(suggestionSchema).optional(),
  tags: z.array(tagBadgeSchema).optional(),
  sources: z.array(sourceRefSchema).optional(),
  status: z.enum(["draft", "done"]).optional(),
});

noteNotes.post("/", async (c) => {
  const user = c.get("user");
  const body = createNoteSchema.parse(await c.req.json().catch(() => ({})));
  const note = await createNote(user.id, body);
  return ok(note, { status: 201 });
});

noteNotes.get("/:id", async (c) => {
  const user = c.get("user");
  const note = await getNote(user.id, c.req.param("id"));
  if (!note) throw new NotFoundError("Note");
  return ok(note);
});

const patchNoteSchema = z.object({
  text: z.string().optional(),
  title: z.string().optional(),
  status: z.enum(["draft", "done"]).optional(),
  projectId: z.string().nullable().optional(),
  body: z.array(deltaOpSchema).optional(),
  suggestions: z.array(suggestionSchema).optional(),
  tags: z.array(tagBadgeSchema).optional(),
  sources: z.array(sourceRefSchema).optional(),
});

noteNotes.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const raw = (await c.req.json()) as Record<string, unknown>;
  const parsed = patchNoteSchema.parse(raw);

  if (parsed.text !== undefined && Object.keys(raw).length === 1) {
    const trimmed = parsed.text.trim();
    if (!trimmed) throw new ValidationError("text is required");
    const note = await appendParagraph(user.id, id, trimmed);
    if (!note) throw new NotFoundError("Note");
    return ok(note);
  }

  const { text: _text, ...patch } = parsed;
  const note = await updateNote(user.id, id, patch);
  if (!note) throw new NotFoundError("Note");
  return ok(note);
});

noteNotes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const deleted = await deleteNote(user.id, id);
  if (!deleted) throw new NotFoundError("Note");
  return ok({ id });
});

const suggestionActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["accept", "dismiss"]),
});

noteNotes.post("/:id/suggestion", async (c) => {
  const user = c.get("user");
  const noteId = c.req.param("id");
  const { id: suggestionId, action } = suggestionActionSchema.parse(await c.req.json());
  const note =
    action === "accept"
      ? await acceptSuggestion(user.id, noteId, suggestionId)
      : await dismissSuggestion(user.id, noteId, suggestionId);
  if (!note) throw new NotFoundError("Note");
  return ok(note);
});
