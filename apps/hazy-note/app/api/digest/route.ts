import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { getDigest } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json(await getDigest(user.id));
}
