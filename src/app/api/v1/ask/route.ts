import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { ok, withApiErrors } from "@/lib/api/response";
import { runAskPipeline } from "@/lib/ai/ask-pipeline";

export const runtime = "nodejs";

const askSchema = z.object({
  question: z.string().min(1).max(2000),
  answerLanguageOverride: z.enum(["en", "ja"]).optional(),
});

export const POST = withApiErrors(async (req: Request) => {
  const user = await requireUser();
  const { question, answerLanguageOverride } = askSchema.parse(await req.json());
  const result = await runAskPipeline({ user, question, answerLanguageOverride });
  return ok(result, { status: 201 });
});
