import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { buildInsightProfile, getInsightProfile } from "@/lib/db/repo";
import type { InsightProfile, InsightStats } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMPTY_STATS: InsightStats = {
  noteCount: 0,
  noteCharTotal: 0,
  noteCharAvg: 0,
  notesLast30d: 0,
  urlCount: 0,
  urlReadCount: 0,
  topDomains: [],
  kindMix: [],
  topTags: [],
  languageMix: [],
  span: null,
};

const EMPTY: InsightProfile = {
  projectId: "",
  generatedLabel: "",
  llm: false,
  stats: EMPTY_STATS,
  profile: "",
  themes: [],
  leanings: [],
  blindSpots: [],
  nextSteps: [],
};

export async function GET(req: NextRequest) {
  const user = await requireAppUser();
  const projectId = req.nextUrl.searchParams.get("project") ?? undefined;
  return NextResponse.json((await getInsightProfile(user.id, projectId)) ?? EMPTY);
}

/** "傾向を分析する" — (re)build the tendency read from the user's notes + sources. */
export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  return NextResponse.json(await buildInsightProfile(user.id, projectId));
}
