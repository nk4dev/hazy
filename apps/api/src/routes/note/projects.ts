import { Hono } from "hono";
import { z } from "zod";
import { NotFoundError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "@/lib/note/repo";
import type { AppEnv } from "@/types/hono";

export const noteProjects = new Hono<AppEnv>();

noteProjects.get("/", async (c) => {
  const user = c.get("user");
  return ok(await listProjects(user.id));
});

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  tone: z.enum(["accent", "neutral"]).optional(),
});

noteProjects.post("/", async (c) => {
  const user = c.get("user");
  const body = createProjectSchema.parse(await c.req.json());
  const project = await createProject(user.id, body.name, {
    tone: body.tone ?? "neutral",
    description: body.description,
  });
  return ok(project, { status: 201 });
});

noteProjects.get("/:id", async (c) => {
  const user = c.get("user");
  const project = await getProject(user.id, c.req.param("id"));
  if (!project) throw new NotFoundError("Project");
  return ok(project);
});

const patchProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  tone: z.enum(["accent", "neutral"]).optional(),
});

noteProjects.patch("/:id", async (c) => {
  const user = c.get("user");
  const patch = patchProjectSchema.parse(await c.req.json());
  const project = await updateProject(user.id, c.req.param("id"), patch);
  if (!project) throw new NotFoundError("Project");
  return ok(project);
});

noteProjects.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const deleted = await deleteProject(user.id, id);
  if (!deleted) throw new NotFoundError("Project");
  return ok({ id });
});
