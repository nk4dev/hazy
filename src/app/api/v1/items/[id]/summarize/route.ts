import { requireUser } from "@/lib/auth/current-user";
import { ok, withApiErrors } from "@/lib/api/response";
import { summarizeItem } from "@/lib/ai/summarize-item";

export const runtime = "nodejs";

export const POST = withApiErrors(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    const result = await summarizeItem(user.id, id);
    return ok(result);
  }
);
