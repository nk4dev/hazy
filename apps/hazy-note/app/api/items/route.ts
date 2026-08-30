import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { addItem, addMemo, listItems } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json(await listItems(user.id));
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text) {
    const item = await addMemo(user.id, text);
    return NextResponse.json(item, { status: 201 });
  }
  if (!url) {
    return NextResponse.json({ error: "url or text is required" }, { status: 400 });
  }
  const item = await addItem(user.id, url);
  return NextResponse.json(item, { status: 201 });
}
