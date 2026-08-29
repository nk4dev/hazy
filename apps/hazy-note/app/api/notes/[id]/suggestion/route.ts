import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { acceptSuggestion, dismissSuggestion } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** body: { blockIndex: number, action: "accept" | "dismiss" } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const blockIndex = Number(body.blockIndex);
  const action = body.action;
  if (!Number.isInteger(blockIndex) || (action !== "accept" && action !== "dismiss")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const note =
    action === "accept"
      ? await acceptSuggestion(user.id, id, blockIndex)
      : await dismissSuggestion(user.id, id, blockIndex);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(note);
}
