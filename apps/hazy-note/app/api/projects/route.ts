import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { createProject, listProjects } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json(await listProjects(user.id));
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const tone = body.tone === "accent" ? "accent" : "neutral";
  return NextResponse.json(await createProject(user.id, name, tone), { status: 201 });
}
