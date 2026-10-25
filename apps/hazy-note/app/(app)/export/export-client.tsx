"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { SkeletonLines, Spinner } from "@/components/loading";
import { Button, Seg } from "@/components/ui";
import { api } from "@/lib/api";
import type { ExportDraft, ExportFormat, Note, NoteSourceRef } from "@/lib/types";

type RefsMode = "list" | "footnote" | "none";

/** The draft blocks → a Markdown document, optionally with a source list. */
function draftToMarkdown(
  draft: ExportDraft,
  sources: NoteSourceRef[],
  refsMode: RefsMode,
): string {
  const lines: string[] = [`# ${draft.title}`, ""];
  for (const b of draft.blocks) {
    if (b.type === "h4") lines.push(`## ${b.text}`, "");
    else if (b.type === "note") lines.push(`> ⚠️ ${b.text}`, "");
    else lines.push(b.text, "");
  }
  if (refsMode !== "none" && sources.length > 0) {
    if (refsMode === "footnote") {
      lines.push("", ...sources.map((s) => `[^${s.n}]: ${s.label}`));
    } else {
      lines.push("## 出典", "", ...sources.map((s, i) => `${i + 1}. ${s.label}`));
    }
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function slugify(title: string): string {
  const s = title
    .trim()
    .replace(/[\s/\\?%*:|"<>]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "note";
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportClient() {
  const sp = useSearchParams();
  const [format, setFormat] = useState<ExportFormat>("blog");
  const [draft, setDraft] = useState<ExportDraft | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteId, setNoteId] = useState<string>(sp.get("noteId") ?? "");
  const [refs, setRefs] = useState<RefsMode>("list");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.notes().then((ns) => {
      setNotes(ns);
      setNoteId((cur) => cur || ns[0]?.id || "");
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .export(noteId, format)
      .then(setDraft)
      .catch(() => setDraft(null))
      .finally(() => setLoading(false));
  }, [format, noteId]);

  const sources = useMemo(
    () => notes.find((n) => n.id === noteId)?.sources ?? [],
    [notes, noteId],
  );

  const markdown = useMemo(
    () => (draft ? draftToMarkdown(draft, sources, refs) : ""),
    [draft, sources, refs],
  );

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  function doDownload() {
    if (!draft) return;
    download(`${slugify(draft.title)}.md`, markdown);
    flash("Markdown をダウンロードしました");
  }

  async function doCopy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(markdown);
      flash("Markdown をコピーしました");
    } catch {
      flash("コピーできませんでした（権限を確認してください）");
    }
  }

  function run() {
    // "社内共有メモ" は貼り付けて使うのでクリップボードへ、それ以外はファイル書き出し。
    if (format === "memo") doCopy();
    else doDownload();
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_320px]">
      <main className="flex flex-col gap-[18px] p-4 pb-8 sm:p-[28px_44px_34px]">
        <div className="flex flex-wrap items-center gap-[10px]">
          <Seg
            name="exfmt"
            value={format}
            onChange={setFormat}
            options={[
              { value: "blog", label: "ブログ記事" },
              { value: "memo", label: "社内共有メモ" },
              { value: "bullets", label: "要点だけ" },
            ]}
          />
          {notes.length > 0 && (
            <select
              className="input w-auto py-[5px] text-[12px]"
              value={noteId}
              onChange={(e) => setNoteId(e.target.value)}
            >
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          )}
          <div className="ml-auto flex gap-2">
            <Button className="text-[13px]" onClick={doCopy} disabled={!draft}>
              <Icon name="copy" /> コピー
            </Button>
            <Button className="text-[13px]" onClick={doDownload} disabled={!draft}>
              <Icon name="markdown-logo" /> Markdown
            </Button>
            <Button
              variant="primary"
              className="text-[13px]"
              onClick={run}
              disabled={!draft}
            >
              <Icon name="export" /> 書き出す
            </Button>
          </div>
        </div>
        <div className="hr" />

        {toast && (
          <div className="flex items-center gap-2 rounded-lg bg-accent/[0.1] px-3 py-2 text-[13px] text-accent-300 shadow-[0_0_0_1px_var(--color-accent-800)]">
            <Icon name="check-circle" size={15} /> {toast}
          </div>
        )}

        {loading && !draft && (
          <div className="flex max-w-[62ch] flex-col gap-5">
            <div className="flex items-center gap-2 text-[13px] text-text/45">
              <Spinner className="size-3.5 text-accent" />
              下書きを生成しています…
            </div>
            <div className="skel h-[26px] w-[55%]" />
            <SkeletonLines lines={6} />
          </div>
        )}

        {draft && (
          <div className="flex max-w-[62ch] flex-col gap-4">
            <div className="text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">
              下書き · {draft.meta}
            </div>
            <h2 className="tracking-[-0.025em]">{draft.title}</h2>
            {draft.blocks.map((b, i) => {
              if (b.type === "h4")
                return (
                  <h4 key={i} className="mt-2">
                    {b.text}
                  </h4>
                );
              if (b.type === "note")
                return (
                  <div
                    key={i}
                    className="flex items-center gap-[9px] rounded-lg bg-accent/[0.07] px-[13px] py-[11px] text-[13px] leading-[1.6] shadow-[0_0_0_1px_var(--color-accent-800)]"
                  >
                    <Icon name="warning-circle" size={16} className="text-accent-400" />
                    {b.text}
                  </div>
                );
              return (
                <p
                  key={i}
                  className={`m-0 text-[15px] leading-[1.9] ${b.dim ? "opacity-55" : "opacity-90"}`}
                >
                  {b.text}
                  {b.dim && noteId && (
                    <>
                      {" "}
                      <Link href={`/notes/${noteId}`}>ノートで埋める</Link>
                    </>
                  )}
                </p>
              );
            })}
            {refs !== "none" && sources.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-white/[0.06] pt-3">
                <div className="text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">
                  出典
                </div>
                {sources.map((s, i) => (
                  <div key={s.n} className="text-[13px] leading-[1.7] opacity-70">
                    {refs === "footnote" ? `[^${s.n}] ` : `${i + 1}. `}
                    {s.label}
                  </div>
                ))}
              </div>
            )}
            {draft.warning && (
              <div className="flex items-center gap-[9px] rounded-lg bg-accent/[0.07] px-[13px] py-[11px] text-[13px] leading-[1.6] shadow-[0_0_0_1px_var(--color-accent-800)]">
                <Icon name="warning-circle" size={16} className="text-accent-400" />
                {draft.warning}
              </div>
            )}
          </div>
        )}
      </main>

      <aside className="flex flex-col gap-4 bg-neutral-900 p-[22px_18px]">
        <div className="text-[10px] uppercase tracking-[0.09em] text-text/40">どこから来たか</div>
        <div className="flex flex-col gap-2">
          {draft?.provenance.map((p) => (
            <div
              key={p.heading}
              className="flex flex-col gap-1 rounded-lg bg-surface p-[11px] shadow-[0_0_0_1px_var(--color-neutral-900)]"
            >
              <div
                className={`text-[11px] ${p.tone === "accent" ? "text-accent" : "text-text/50"}`}
              >
                {p.heading}
              </div>
              <div
                className={`text-[12.5px] leading-[1.55] ${
                  p.tone === "accent" ? "opacity-85" : "opacity-60"
                }`}
              >
                {p.from}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[6px] flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.09em] text-text/40">出典表を付ける</div>
          {(
            [
              ["list", "末尾にリンク一覧"],
              ["footnote", "脚注として本文中に"],
              ["none", "付けない"],
            ] as [RefsMode, string][]
          ).map(([v, label]) => (
            <label key={v} className="radio">
              <input
                type="radio"
                name="exrefs"
                checked={refs === v}
                onChange={() => setRefs(v)}
              />
              <span className="dot" />
              {label}
            </label>
          ))}
          {sources.length === 0 && (
            <div className="text-[11px] leading-[1.6] text-text/35">
              このノートには出典が登録されていません。
            </div>
          )}
        </div>

        <div className="mt-auto text-[11.5px] leading-[1.7] text-text/45">
          生成文はすべて出典に紐づいています。紐づかない文は書き出し前に灰色で示されます。
          「書き出す」は{format === "memo" ? "クリップボードへコピー" : "Markdown をダウンロード"}します。
        </div>
      </aside>
    </div>
  );
}
