import { Hono } from "hono";
import { z } from "zod";
import { ok } from "@/lib/api/response";
import { searchUserItems } from "@/lib/search/keyword-search";
import { serializeSavedUrl } from "@/lib/serializers";
import type { AppEnv } from "@/types/hono";

export const search = new Hono<AppEnv>();

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

search.get("/", async (c) => {
  const user = c.get("user");
  const { q, limit } = querySchema.parse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
  });

  const hits = await searchUserItems(user.id, q, { limit });

  return ok({
    query: q,
    items: hits.map((hit) => serializeSavedUrl(hit)),
  });
});
