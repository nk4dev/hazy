import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { appendParagraph, deleteNote, getNote, updateNote } from "@/lib/db/repo";
import type { NoteBlock, NoteStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const note = await getNote(user.id, id);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(note);
}

/**
 * PATCH — either append a paragraph (`{ text }`, the "書き足す" box) or edit the
 * note in place (`{ title?, status?, projectId?, blocks?, tags? }`).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.text === "string" && Object.keys(body).length === 1) {
    const text = body.text.trim();
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
    const note = await appendParagraph(user.id, id, text);
    if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(note);
  }

  const patch: Parameters<typeof updateNote>[2] = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (body.status === "draft" || body.status === "done") patch.status = body.status as NoteStatus;
  if (typeof body.projectId === "string" || body.projectId === null)
    patch.projectId = body.projectId;
  if (Array.isArray(body.blocks)) patch.blocks = body.blocks as NoteBlock[];
  if (Array.isArray(body.tags)) patch.tags = body.tags;
  if (Array.isArray(body.sources)) patch.sources = body.sources;

  const note = await updateNote(user.id, id, patch);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const ok = await deleteNote(user.id, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
