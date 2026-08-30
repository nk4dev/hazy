import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { deleteItem, getItem, updateItem } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const item = await getItem(user.id, id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const patch = await req.json().catch(() => ({}));
  const item = await updateItem(user.id, id, patch);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const ok = await deleteItem(user.id, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
