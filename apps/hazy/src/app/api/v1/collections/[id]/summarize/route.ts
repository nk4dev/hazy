import { z } from "zod";
import { summarizeCollection } from "@/lib/ai/summarize-collection";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

const bodySchema = z.object({ locale: z.enum(["en", "ja"]).optional() });

export const POST = withApiErrors(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    const { locale } = bodySchema.parse(await req.json().catch(() => ({})));
    const result = await summarizeCollection(user.id, id, locale);
    return ok(result);
  }
);
