import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { buildGraph, getGraph } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json(await getGraph(user.id));
}

/** "つなぎ直す" — recompute the graph from current notes and sources. */
export async function POST() {
  const user = await requireAppUser();
  return NextResponse.json(await buildGraph(user.id));
}
