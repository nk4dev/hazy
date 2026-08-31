import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { runSearchChat } from "@/lib/db/repo";
import type { SearchChatAnswer } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  query?: unknown;
  history?: unknown;
};

const EMPTY: SearchChatAnswer = { answer: "", sources: [], llm: false };

/** "チャット検索" — ask a question, get an answer grounded in your own library. */
export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  const body = (await req.json().catch(() => ({}))) as Body;

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return NextResponse.json(EMPTY);

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is { role: "user" | "assistant"; content: string } =>
            !!t &&
            typeof t === "object" &&
            (t as { role?: unknown }).role !== undefined &&
            ((t as { role: string }).role === "user" ||
              (t as { role: string }).role === "assistant") &&
            typeof (t as { content?: unknown }).content === "string"
        )
        .slice(-6)
    : undefined;

  return NextResponse.json(await runSearchChat(user.id, query, history));
}
