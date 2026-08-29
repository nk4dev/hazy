import { type NextRequest, NextResponse } from "next/server";
import { requireAppUser } from "@/lib/db/current-user";
import { buildExport } from "@/lib/db/repo";
import type { ExportFormat } from "@/lib/types";

export const dynamic = "force-dynamic";

const FORMATS: ExportFormat[] = ["blog", "memo", "bullets"];

export async function GET(req: NextRequest) {
  const user = await requireAppUser();
  const sp = req.nextUrl.searchParams;
  const noteId = sp.get("noteId") ?? "";
  const fmt = sp.get("format") as ExportFormat | null;
  const format = fmt && FORMATS.includes(fmt) ? fmt : "blog";
  return NextResponse.json(await buildExport(user.id, noteId, format));
}

/** POST — "書き出す". Same canned draft; echoes a fake destination. */
export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const noteId = typeof body.noteId === "string" ? body.noteId : "";
  const format: ExportFormat = FORMATS.includes(body.format) ? body.format : "blog";
  const draft = await buildExport(user.id, noteId, format);
  return NextResponse.json({
    ...draft,
    exportedTo: format === "memo" ? "社内共有 (clipboard)" : "Markdown (download)",
  });
}
