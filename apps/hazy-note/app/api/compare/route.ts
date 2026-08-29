import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { buildCompareBoard, getCompare } from "@/lib/db/repo";
import type { CompareBoard } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMPTY: CompareBoard = {
  id: "",
  projectId: "",
  sources: [],
  axes: [],
  summary: "",
  candidateAxes: [],
};

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json((await getCompare(user.id)) ?? EMPTY);
}

/** "差分をまとめる" — (re)synthesise the board from the project's sources. */
export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  return NextResponse.json(await buildCompareBoard(user.id, projectId));
}
