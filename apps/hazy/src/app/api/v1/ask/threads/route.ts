import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { askThreads } from "@/db/schema";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

export const GET = withApiErrors(async () => {
  const user = await requireUser();
  const db = getDb();
  const rows = await db.query.askThreads.findMany({
    where: eq(askThreads.userId, user.id),
    orderBy: [desc(askThreads.updatedAt)],
    limit: 50,
  });

  return ok({
    items: rows.map((t) => ({
      id: t.id,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
});
