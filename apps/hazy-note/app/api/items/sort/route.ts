import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { autoSort } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

/** "まとめて振り分け" — moves every unsorted item with tag guesses into the accent project. */
export async function POST() {
  const user = await requireAppUser();
  return NextResponse.json(await autoSort(user.id));
}
