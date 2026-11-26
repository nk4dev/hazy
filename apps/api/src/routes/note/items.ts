import { Hono } from "hono";
import { z } from "zod";
import { NotFoundError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import {
  addItem,
  addMemo,
  deleteItem,
  finishReading,
  getItem,
  listImportable,
  listItems,
  updateItem,
} from "@/lib/note/repo";
import type { AppEnv } from "@/types/hono";

export const noteItems = new Hono<AppEnv>();

noteItems.get("/", async (c) => {
  const user = c.get("user");
  return ok(await listItems(user.id));
});

noteItems.get("/importable", async (c) => {
  const user = c.get("user");
  return ok(await listImportable(user.id));
});

const createItemSchema = z
  .object({
    url: z.string().trim().optional(),
    text: z.string().trim().optional(),
  })
  .refine((v) => Boolean(v.url || v.text), { message: "url or text is required" });

noteItems.post("/", async (c) => {
  const user = c.get("user");
  const { url, text } = createItemSchema.parse(await c.req.json());
  if (text) {
    return ok(await addMemo(user.id, text), { status: 201 });
  }
  return ok(await addItem(user.id, url as string), { status: 201 });
});

noteItems.get("/:id", async (c) => {
  const user = c.get("user");
  const item = await getItem(user.id, c.req.param("id"));
  if (!item) throw new NotFoundError("Item");
  return ok(item);
});

const patchItemSchema = z.object({
  tags: z.array(z.string()).optional(),
  projectId: z.string().nullable().optional(),
  title: z.string().optional(),
  summary: z.array(z.string()).optional(),
});

noteItems.patch("/:id", async (c) => {
  const user = c.get("user");
  const patch = patchItemSchema.parse(await c.req.json());
  const item = await updateItem(user.id, c.req.param("id"), patch);
  if (!item) throw new NotFoundError("Item");
  return ok(item);
});

noteItems.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const deleted = await deleteItem(user.id, id);
  if (!deleted) throw new NotFoundError("Item");
  return ok({ id });
});

noteItems.post("/:id/read", async (c) => {
  const user = c.get("user");
  const item = await finishReading(user.id, c.req.param("id"));
  if (!item) throw new NotFoundError("Item");
  return ok(item);
});
