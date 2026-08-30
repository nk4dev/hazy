import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { acceptSuggestion, dismissSuggestion } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** body: { id: string, action: "accept" | "dismiss" } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const suggestionId = typeof body.id === "string" ? body.id : "";
  const action = body.action;
  if (!suggestionId || (action !== "accept" && action !== "dismiss")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const note =
    action === "accept"
      ? await acceptSuggestion(user.id, id, suggestionId)
      : await dismissSuggestion(user.id, id, suggestionId);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(note);
}
