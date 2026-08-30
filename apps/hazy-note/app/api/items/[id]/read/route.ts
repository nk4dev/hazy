import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { finishReading } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Canned "読み取り完了" — flips status to ready and fills the mock summary. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const user = await requireAppUser();
  const { id } = await params;
  const item = await finishReading(user.id, id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(item);
}
