import { z } from "zod";
import { runAskPipeline } from "@/lib/ai/ask-pipeline";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

const askSchema = z.object({
  question: z.string().min(1).max(2000),
  answerLanguageOverride: z.enum(["en", "ja"]).optional(),
  collectionIds: z.array(z.string().uuid()).max(5).optional(),
});

export const POST = withApiErrors(async (req: Request) => {
  const user = await requireUser();
  const { question, answerLanguageOverride, collectionIds } = askSchema.parse(await req.json());
  const result = await runAskPipeline({ user, question, answerLanguageOverride, collectionIds });
  return ok(result, { status: 201 });
});
