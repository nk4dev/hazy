"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Loading, Spinner } from "@/components/loading";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import type { Item, ProjectDetail, SourceKind } from "@/lib/types";

const KIND_ICON: Record<SourceKind, string> = {
  article: "globe",
  pdf: "file-pdf",
  video: "youtube-logo",
  thread: "chat-circle",
  note: "note-pencil",
};

/** A project workspace — the idea, the sources gathered for it, the notes
 *  written under it. Projects are created deliberately by the user. */
export function ProjectClient({ id }: { id: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [desc, setDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [pickQuery, setPickQuery] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);
  const descTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    api
      .project(id)
      .then((d) => {
        setDetail(d);
        setDesc(d.description ?? "");
      })
      .catch(() => setNotFound(true));
  }, [id]);
  useEffect(load, [load]);

  function saveDesc(next: string) {
    setDesc(next);
    if (descTimer.current) clearTimeout(descTimer.current);
    descTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.updateProject(id, { description: next });
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  async function rename() {
    if (!detail) return;
    const name = window.prompt("プロジェクト名", detail.name);
    if (name == null || name.trim() === detail.name) return;
    await api.updateProject(id, { name: name.trim() });
    load();
  }

  async function removeProject() {
    if (!window.confirm("このプロジェクトを削除しますか？（出典・ノートは残ります）")) return;
    await api.deleteProject(id);
    router.push("/notes");
  }

  async function addSource(itemId: string) {
    await api.updateItem(itemId, { projectId: id });
    setAdding(false);
    setPickQuery("");
    load();
  }

  async function removeSource(itemId: string) {
    await api.updateItem(itemId, { projectId: null });
    load();
  }

  async function newNote() {
    setCreatingNote(true);
    try {
      const note = await api.addNote({ projectId: id });
      router.push(`/notes/${note.id}`);
    } finally {
      setCreatingNote(false);
    }
  }

  const candidates = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    return allItems
      .filter((it) => it.kind !== "note" && it.projectId !== id)
      .filter((it) => !q || `${it.title} ${it.site}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allItems, pickQuery, id]);

  function openPicker() {
    setAdding(true);
    if (allItems.length === 0) api.items().then(setAllItems).catch(() => {});
  }

  if (notFound) return <div className="p-8 text-text/50">プロジェクトが見つかりません。</div>;
  if (!detail) return <Loading label="プロジェクトを開いています" />;

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 p-4 pb-12 sm:p-[26px_30px_48px]">
      <div className="flex items-center gap-[10px] text-[12px] text-text/45">
        <Icon name="folder-open" />
        プロジェクト
        <span className="ml-auto flex items-center gap-[7px] text-[11px]">
          {saving && <Spinner className="size-[11px] text-accent" />}
          {saving ? "保存中…" : "自動保存"}
        </span>
      </div>

      <div className="flex items-center gap-[10px]">
        <span
          className={`h-[8px] w-[8px] rounded-full ${
            detail.tone === "accent" ? "bg-accent" : "bg-neutral-600"
          }`}
        />
        <h2 className="tracking-[-0.02em]">{detail.name}</h2>
        <button
          type="button"
          onClick={rename}
          className="btn btn-ghost px-[8px] py-[4px] text-[12px] text-text/50"
        >
          <Icon name="pencil-simple" /> 改名
        </button>
        <button
          type="button"
          onClick={removeProject}
          className="btn btn-ghost ml-auto px-[8px] py-[4px] text-[12px] text-text/45"
        >
          <Icon name="trash" /> 削除
        </button>
      </div>

      <section className="flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-[0.09em] text-text/40">アイデア</div>
        <textarea
          value={desc}
          onChange={(e) => saveDesc(e.target.value)}
          rows={4}
          placeholder="この企画で言いたいこと・仮説を書く…"
          className="w-full resize-y rounded-lg bg-surface px-[13px] py-[11px] text-[14px] leading-[1.8] text-text/90 caret-accent outline-none shadow-[0_0_0_1px_var(--color-neutral-900)] placeholder:text-text/30 focus:shadow-[0_0_0_1px_var(--color-accent-800)]"
        />
      </section>

      <section className="flex flex-col gap-[9px]">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.09em] text-text/40">
          出典 {detail.sources.length > 0 && `· ${detail.sources.length}`}
          <button
            type="button"
            onClick={openPicker}
            className="ml-auto text-text/50 hover:text-text"
            title="出典を追加"
          >
            <Icon name="plus" size={12} />
          </button>
        </div>

        {adding && (
          <div className="relative flex flex-col gap-[6px] rounded-lg bg-surface p-[10px] shadow-[0_0_0_1px_var(--color-neutral-900)]">
            <input
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
              placeholder="受信箱から探す…"
              className="input text-[13px]"
            />
            <ul className="flex max-h-[220px] flex-col gap-px overflow-auto">
              {candidates.length === 0 && (
                <li className="px-[6px] py-2 text-[12px] text-text/40">候補がありません</li>
              )}
              {candidates.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => addSource(it.id)}
                    className="flex w-full items-start gap-[9px] rounded-md px-[8px] py-[7px] text-left hover:bg-white/[0.05]"
                  >
                    <Icon
                      name={KIND_ICON[it.kind]}
                      size={14}
                      className="mt-[2px] text-accent"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-text">{it.title}</span>
                      <span className="block truncate text-[11px] text-text/50">{it.site}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="btn btn-ghost self-end text-[11px] text-text/45"
            >
              閉じる
            </button>
          </div>
        )}

        {detail.sources.length === 0 && !adding && (
          <div className="rounded-lg bg-surface px-[13px] py-3 text-[12px] text-text/45 shadow-[0_0_0_1px_var(--color-neutral-900)]">
            まだ出典がありません。「＋」で受信箱から集めます。
          </div>
        )}
        {detail.sources.map((s) => (
          <div
            key={s.id}
            className="group flex items-center gap-[9px] rounded-lg bg-surface px-[12px] py-[9px] shadow-[0_0_0_1px_var(--color-neutral-900)]"
          >
            <Icon name={KIND_ICON[s.kind]} size={14} className="text-accent" />
            <Link
              href={`/library/${s.id}`}
              className="min-w-0 flex-1 truncate text-[13px] text-text no-underline hover:text-accent-300"
            >
              {s.title}
            </Link>
            <span className="shrink-0 text-[11px] text-text/40">{s.site}</span>
            <button
              type="button"
              onClick={() => removeSource(s.id)}
              className="hidden shrink-0 text-[11px] text-text/40 hover:text-text group-hover:block"
              title="このプロジェクトから外す"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-[9px]">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.09em] text-text/40">
          ノート {detail.notes.length > 0 && `· ${detail.notes.length}`}
        </div>
        {detail.notes.map((n) => (
          <Link
            key={n.id}
            href={`/notes/${n.id}`}
            className="flex items-center gap-[9px] rounded-lg bg-surface px-[12px] py-[9px] no-underline shadow-[0_0_0_1px_var(--color-neutral-900)] hover:shadow-[0_0_0_1px_var(--color-accent-800)]"
          >
            <Icon
              name={n.status === "done" ? "check-circle" : "circle-dashed"}
              size={14}
              className={n.status === "done" ? "text-accent" : "text-text/40"}
            />
            <span className="min-w-0 flex-1 truncate text-[13px] text-text">{n.title}</span>
            <span className="shrink-0 text-[11px] text-text/40">{n.updatedLabel}</span>
          </Link>
        ))}
        <Button variant="primary" className="self-start text-[13px]" onClick={newNote} disabled={creatingNote}>
          {creatingNote ? <Spinner className="size-4" /> : <Icon name="note-pencil" />}
          このプロジェクトでノートを書く
        </Button>
      </section>

      <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
        <Link href={`/analyze?project=${id}`} className="btn btn-secondary text-[13px]">
          <Icon name="chart-donut" /> この出典を分析する
        </Link>
        <Link href="/export" className="btn btn-secondary text-[13px]">
          <Icon name="export" /> 書き出す
        </Link>
      </div>
    </main>
  );
}
