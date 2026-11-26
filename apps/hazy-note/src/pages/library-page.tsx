import { useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBreadcrumb } from "@/components/breadcrumbs";
import { Icon } from "@/components/icon";
import { Button, Seg, Tag } from "@/components/ui";
import {
  useAddNoteItemMutation,
  useDeleteNoteItemMutation,
  useFinishReadingNoteItemMutation,
  useNoteItemsQuery,
  useNoteProjectsQuery,
} from "@/lib/hooks";
import { NoteLink, useNoteNavigate } from "@/lib/navigation";
import type { Item, SourceKind } from "@/lib/types";

const KIND_ICON: Record<SourceKind, string> = {
  article: "globe",
  pdf: "file-pdf",
  video: "youtube-logo",
  thread: "chat-circle",
  note: "note-pencil",
};

export function LibraryPage() {
  const router = useNoteNavigate();
  const searchStr = useLocation().searchStr;
  const { projectFilter, tagFilter } = useMemo(() => {
    const sp = new URLSearchParams(searchStr);
    return { projectFilter: sp.get("project"), tagFilter: sp.get("tag") };
  }, [searchStr]);

  const { data: items = [] } = useNoteItemsQuery();
  const { data: projects = [] } = useNoteProjectsQuery();
  const addItem = useAddNoteItemMutation();
  const finishReading = useFinishReadingNoteItemMutation();
  const deleteItem = useDeleteNoteItemMutation();

  const [view, setView] = useState<"card" | "list">("card");
  const [url, setUrl] = useState("");
  const readingWatched = useRef<Set<string>>(new Set());

  // Auto-finish any "reading" item shortly after it appears.
  useEffect(() => {
    for (const it of items) {
      if (it.status === "reading" && !readingWatched.current.has(it.id)) {
        readingWatched.current.add(it.id);
        setTimeout(() => {
          void finishReading.mutateAsync(it.id).catch(() => {});
        }, 2600);
      }
    }
  }, [items, finishReading]);

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name;

  const filtered = useMemo(() => {
    let list = items;
    if (projectFilter) list = list.filter((i) => i.projectId === projectFilter);
    if (tagFilter)
      list = list.filter((i) => i.tags.includes(tagFilter) || i.suggestedTags.includes(tagFilter));
    return list;
  }, [items, projectFilter, tagFilter]);

  const heading = projectFilter
    ? (projectName(projectFilter) ?? "プロジェクト")
    : tagFilter
      ? `#${tagFilter}`
      : "受信箱";

  useBreadcrumb(projectFilter || tagFilter ? [{ label: heading }] : null);

  async function ingest() {
    if (!url.trim() || addItem.isPending) return;
    const item = await addItem.mutateAsync(url.trim());
    setUrl("");
    router.push(`/capture?id=${item.id}`);
  }

  return (
    <main className="flex flex-col gap-5 p-4 pb-10 sm:p-[26px_30px_40px]">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <div className="mb-[5px] text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">
            {projectFilter || tagFilter ? "フィルタ中" : "受信箱"}
          </div>
          <h3 className="tracking-[-0.02em]">{heading}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {projectFilter && (
            <NoteLink href={`/projects/${projectFilter}`} className="btn btn-secondary text-[12px]">
              <Icon name="folder-open" /> プロジェクトを開く
            </NoteLink>
          )}
          {(projectFilter || tagFilter) && (
            <NoteLink href="/library" className="btn btn-ghost text-[12px]">
              <Icon name="x" /> フィルタ解除
            </NoteLink>
          )}
          <Seg
            name="libview"
            value={view}
            onChange={setView}
            options={[
              { value: "card", label: "カード" },
              { value: "list", label: "リスト" },
            ]}
          />
          <Button>
            <Icon name="sliders-horizontal" />
            絞り込み
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-[9px] rounded-xl bg-surface p-[9px] shadow-[0_0_0_1px_var(--color-neutral-800),inset_0_0_44px_rgba(145,132,217,0.07)]">
        <Icon name="link" size={17} className="ml-[7px] self-center text-accent" />
        <input
          className="flex-1 self-center bg-transparent text-[14px] text-text outline-none placeholder:text-text/40"
          placeholder="URLを貼る、またはファイルをドロップ — 記事・PDF・動画・スレッド"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void ingest()}
        />
        <Button variant="primary" onClick={() => void ingest()} disabled={addItem.isPending}>
          <Icon name="arrow-right" />
          {addItem.isPending ? "読み取り中…" : "読み取って整理"}
        </Button>
        <NoteLink
          href="/capture?from=hazy"
          className="btn self-center whitespace-nowrap text-[12px] no-underline"
        >
          <Icon name="tray" />
          Hazyから
        </NoteLink>
      </div>

      {view === "card" ? (
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              projectName={projectName(it.projectId)}
              onDelete={() => void deleteItem.mutateAsync(it.id)}
            />
          ))}
          <NoteLink
            href="/capture"
            className="card items-start justify-center gap-2 bg-transparent no-underline shadow-[inset_0_0_0_1px_var(--color-neutral-900)]"
          >
            <Icon name="plus" size={20} className="text-accent" />
            <div className="card-title text-[15px] text-text">ここにドロップ</div>
            <p className="card-body text-[12px]">
              拡張機能・共有シート・メール転送からも入ります。
            </p>
          </NoteLink>
        </div>
      ) : (
        <div className="flex flex-col rounded-lg bg-surface elev-sm">
          {filtered.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3 last:border-0"
            >
              <Icon name={KIND_ICON[it.kind]} size={15} className="text-text/50" />
              <span className="min-w-0 flex-1 truncate text-[13.5px]">
                {it.status === "reading" ? "読み取り中…" : it.title}
              </span>
              <span className="text-[11px] text-text/40">{it.addedLabel}</span>
              {it.projectId && <Tag tone="neutral">{projectName(it.projectId)}</Tag>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function ItemCard({
  item,
  projectName,
  onDelete,
}: {
  item: Item;
  projectName?: string;
  onDelete: () => void;
}) {
  if (item.status === "reading") {
    return (
      <article className="card gap-[9px] shadow-[0_0_0_1px_var(--color-accent-700)]">
        <div className="card-meta">
          <Icon name={KIND_ICON[item.kind]} />
          {item.site}
          {item.durationLabel ? ` / ${item.durationLabel}` : ""}
          <span className="ml-auto text-accent">読み取り中</span>
        </div>
        <div className="card-title opacity-70 blur-[3px]">{item.title || "読み取ったページ"}</div>
        <div className="flex flex-col gap-[6px]">
          <div className="skel h-[9px]" />
          <div className="skel h-[9px] w-[88%]" />
          <div className="skel h-[9px] w-[62%]" />
        </div>
        <div className="flex items-center gap-[7px] rounded-md bg-accent/[0.08] px-[9px] py-2 text-[12px] text-accent-300">
          <Icon name="sparkle" size={14} className="pulse text-accent" />
          本文から主要な主張を抜き出しています
        </div>
        <div className="flex gap-[5px]">
          <Tag tone="outline">タグ推定中</Tag>
        </div>
      </article>
    );
  }

  return (
    <article className="card gap-[9px] elev-sm">
      <div className="card-meta">
        <Icon name={KIND_ICON[item.kind]} />
        {item.site}
        {item.durationLabel ? ` · ${item.durationLabel}` : ""}
        <span className="ml-auto">{item.addedLabel}</span>
      </div>
      <NoteLink
        href={`/library/${item.id}`}
        className="card-title text-text no-underline hover:text-accent-300"
      >
        {item.title}
      </NoteLink>

      {item.points.length > 0 ? (
        <div className="flex flex-col gap-[5px] rounded-md bg-accent/[0.08] p-[9px]">
          <div className="text-[10px] uppercase tracking-[0.08em] text-accent">抽出した論点</div>
          <div className="text-[12px] leading-[1.6] opacity-85">
            {item.points.map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: ordered bullet points from server
              <div key={i}>・{p}</div>
            ))}
          </div>
        </div>
      ) : (
        <p className="card-body">{item.summary[0]}</p>
      )}

      {item.quoteCandidates > 0 && (
        <div className="flex items-center gap-[7px] rounded-md bg-white/[0.05] px-[9px] py-2 text-[12px] opacity-80">
          <Icon name="quotes" size={14} className="text-accent" />
          引用候補 {item.quoteCandidates}件
        </div>
      )}
      {item.relatedNoteId && (
        <div className="flex items-center gap-[7px] rounded-md bg-white/[0.05] px-[9px] py-2 text-[12px] opacity-80">
          <Icon name="link-simple" size={14} className="text-accent" />
          関連するノートがあります
        </div>
      )}

      <div className="flex flex-wrap items-center gap-[5px]">
        {item.tags.map((t) => (
          <Tag key={t} tone="neutral">
            {t}
          </Tag>
        ))}
        {projectName && <Tag tone="accent">{projectName}</Tag>}
        <button
          type="button"
          className="btn btn-ghost ml-auto text-[11px] text-text/40"
          onClick={onDelete}
          title="削除"
        >
          <Icon name="trash" />
        </button>
      </div>
    </article>
  );
}
