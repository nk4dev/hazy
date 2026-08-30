import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { listImportable } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

// Saved URLs from hazy that aren't in a hazy-note project yet — the
// "Hazyから追加" capture picker.
export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json(await listImportable(user.id));
}
