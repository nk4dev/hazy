import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { deleteProject, getProject, updateProject } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const project = await getProject(user.id, id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: { name?: string; description?: string | null; tone?: "accent" | "neutral" } = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.description === "string" || body.description === null)
    patch.description = body.description;
  if (body.tone === "accent" || body.tone === "neutral") patch.tone = body.tone;
  const project = await updateProject(user.id, id, patch);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const ok = await deleteProject(user.id, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
