import { z } from "zod";
import { runAskPipeline } from "@/lib/ai/ask-pipeline";
import { ValidationError } from "@/lib/api/errors";
import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

const messageSchema = z.object({
  question: z.string().min(1).max(2000),
  answerLanguageOverride: z.enum(["en", "ja"]).optional(),
});

export const POST = withApiErrors(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id: threadId } = await params;
    const { question, answerLanguageOverride } = messageSchema.parse(await req.json());

    try {
      const result = await runAskPipeline({ user, question, threadId, answerLanguageOverride });
      return ok(result, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "Thread not found") {
        throw new ValidationError("Thread not found");
      }
      throw error;
    }
  }
);
