import { z } from "zod";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";
import { searchUserItems } from "@/lib/search/keyword-search";
import { serializeSavedUrl } from "@/lib/serializers";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApiErrors(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const { q, limit } = querySchema.parse({
    q: searchParams.get("q"),
    limit: searchParams.get("limit") ?? undefined,
  });

  const hits = await searchUserItems(user.id, q, { limit });

  return ok({
    query: q,
    items: hits.map((hit) => serializeSavedUrl(hit)),
  });
});
