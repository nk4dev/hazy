import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { createNote, listNotes } from "@/lib/db/repo";
import { isDelta } from "@/lib/note-delta";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json(await listNotes(user.id));
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const note = await createNote(user.id, {
    title: typeof body.title === "string" ? body.title : undefined,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    text: typeof body.text === "string" ? body.text : undefined,
    body: isDelta(body.body) ? body.body : undefined,
    suggestions: Array.isArray(body.suggestions) ? body.suggestions : undefined,
    tags: Array.isArray(body.tags) ? body.tags : undefined,
    sources: Array.isArray(body.sources) ? body.sources : undefined,
    status: body.status === "draft" || body.status === "done" ? body.status : undefined,
  });
  return NextResponse.json(note, { status: 201 });
}
