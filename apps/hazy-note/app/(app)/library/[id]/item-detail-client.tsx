"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { Loading, Spinner } from "@/components/loading";
import { Button, Tag } from "@/components/ui";
import { api } from "@/lib/api";
import type { Item, Project, SourceKind } from "@/lib/types";

const KIND_ICON: Record<SourceKind, string> = {
  article: "globe",
  pdf: "file-pdf",
  video: "youtube-logo",
  thread: "chat-circle",
  note: "note-pencil",
};

/** The item's overview — shown when you click a card in the 受信箱. No AI runs
 *  on open; "要約する" / "取り込み直す" are explicit. */
export function ItemDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<null | "read" | "note" | "save">(null);

  const load = useCallback(() => {
    api
      .item(id)
      .then(setItem)
      .catch(() => setNotFound(true));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    api.projects().then(setProjects).catch(() => {});
  }, []);

  async function runReading() {
    setBusy("read");
    try {
      const done = await api.finishReading(id).catch(() => null);
      if (done) setItem(done);
    } finally {
      setBusy(null);
    }
  }

  async function moveTo(projectId: string) {
    if (!item) return;
    setBusy("save");
    try {
      setItem(await api.updateItem(id, { projectId: projectId || null }));
    } finally {
      setBusy(null);
    }
  }

  async function openNote() {
    if (!item) return;
    if (item.relatedNoteId) return router.push(`/notes/${item.relatedNoteId}`);
    setBusy("note");
    try {
      const note = await api.addNote({ title: item.title });
      router.push(`/notes/${note.id}`);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("このアイテムを削除しますか？")) return;
    await api.deleteItem(id);
    router.push("/library");
  }

  if (notFound) return <div className="p-8 text-text/50">アイテムが見つかりません。</div>;
  if (!item) return <Loading label="アイテムを開いています" />;

  const unread = item.summary.length === 0 && item.points.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-[680px] flex-col gap-5 p-[26px_30px_44px]">
      <Link href="/library" className="btn btn-ghost self-start text-[12px] text-text/50">
        <Icon name="arrow-left" /> 受信箱
      </Link>

      <div className="flex flex-col gap-[10px]">
        <div className="flex items-center gap-[9px] text-[12px] text-text/50">
          <Icon name={KIND_ICON[item.kind]} className="text-accent" />
          {item.site}
          {item.durationLabel ? ` · ${item.durationLabel}` : ""}
          <span className="ml-auto">{item.addedLabel}</span>
        </div>
        <h2 className="tracking-[-0.02em]">{item.title}</h2>
        {item.kind !== "note" && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-[12px] text-accent no-underline hover:underline"
          >
            {item.url}
          </a>
        )}
      </div>

      {unread ? (
        <div className="flex flex-col items-start gap-3 rounded-[10px] bg-surface p-4 text-[13px] leading-[1.7] text-text/60 shadow-[0_0_0_1px_var(--color-neutral-900)]">
          まだ要約していません。
          <Button variant="primary" onClick={runReading} disabled={busy === "read"}>
            {busy === "read" ? <Spinner className="size-4" /> : <Icon name="sparkle" />}
            {busy === "read" ? "読み取り中…" : "要約する"}
          </Button>
        </div>
      ) : (
        <>
          {item.summary.length > 0 && (
            <div className="flex flex-col gap-[6px] rounded-lg bg-surface px-[13px] py-[12px] text-[13px] leading-[1.75] opacity-85 shadow-[0_0_0_1px_var(--color-neutral-900)]">
              {item.summary.map((s, i) => (
                <div key={i}>・{s}</div>
              ))}
            </div>
          )}
          {item.points.length > 0 && (
            <div className="flex flex-col gap-[6px] rounded-lg bg-accent/[0.08] p-[12px] shadow-[0_0_0_1px_var(--color-accent-800)]">
              <div className="text-[10px] uppercase tracking-[0.09em] text-accent">抽出した論点</div>
              <div className="flex flex-col gap-[4px] text-[12.5px] leading-[1.7] opacity-90">
                {item.points.map((p, i) => (
                  <div key={i}>・{p}</div>
                ))}
              </div>
            </div>
          )}
          {item.quoteCandidates > 0 && (
            <div className="flex items-center gap-[7px] rounded-md bg-white/[0.05] px-[10px] py-2 text-[12px] opacity-80">
              <Icon name="quotes" size={14} className="text-accent" />
              引用候補 {item.quoteCandidates}件
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-[6px]">
        {item.tags.map((t) => (
          <Tag key={t} tone="neutral">
            {t}
          </Tag>
        ))}
        {item.tags.length === 0 && <span className="text-[12px] text-text/40">タグなし</span>}
      </div>

      <label className="flex items-center gap-2 rounded-lg bg-surface px-[11px] py-[9px] text-[12.5px] shadow-[0_0_0_1px_var(--color-neutral-900)]">
        <Icon name="folder-open" size={15} className="text-accent" />
        置き場所
        <select
          className="input ml-auto w-auto py-[4px] text-[12px]"
          value={item.projectId ?? ""}
          onChange={(e) => moveTo(e.target.value)}
          disabled={busy === "save"}
        >
          <option value="">未整理のまま</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="primary" onClick={openNote} disabled={busy === "note"}>
          <Icon name={item.relatedNoteId ? "arrow-right" : "note-pencil"} />
          {item.relatedNoteId ? "ノートを開く" : "このアイテムからノートを作る"}
        </Button>
        {!unread && (
          <Button onClick={runReading} disabled={busy === "read"}>
            {busy === "read" ? <Spinner className="size-4" /> : <Icon name="arrow-clockwise" />}
            要約し直す
          </Button>
        )}
        <Link href={`/capture?id=${item.id}`} className="btn btn-secondary text-[13px]">
          <Icon name="sliders" /> 取り込みを開き直す
        </Link>
        <button
          type="button"
          onClick={remove}
          className="btn btn-ghost ml-auto text-[13px] text-text/45"
        >
          <Icon name="trash" /> 削除
        </button>
      </div>
    </main>
  );
}
