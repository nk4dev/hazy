"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Button, Seg, Tag } from "@/components/ui";
import { api } from "@/lib/api";
import type { Item, Project, SourceKind } from "@/lib/types";

const KIND_ICON: Record<SourceKind, string> = {
  article: "globe",
  pdf: "file-pdf",
  video: "youtube-logo",
  thread: "chat-circle",
  note: "note-pencil",
};

export function LibraryClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const projectFilter = sp.get("project");
  const tagFilter = sp.get("tag");

  const [items, setItems] = useState<Item[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<"card" | "list">("card");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const readingWatched = useRef<Set<string>>(new Set());

  const load = () => {
    api
      .items()
      .then(setItems)
      .catch(() => {});
    api
      .projects()
      .then(setProjects)
      .catch(() => {});
  };
  useEffect(load, []);

  // No real backend timer: auto-finish any "reading" item shortly after it appears.
  useEffect(() => {
    for (const it of items) {
      if (it.status === "reading" && !readingWatched.current.has(it.id)) {
        readingWatched.current.add(it.id);
        setTimeout(() => {
          api
            .finishReading(it.id)
            .then(() => load())
            .catch(() => {});
        }, 2600);
      }
    }
  }, [items, load]);

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

  async function ingest() {
    if (!url.trim() || busy) return;
    setBusy(true);
    try {
      const item = await api.addItem(url.trim());
      setUrl("");
      router.push(`/capture?id=${item.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.deleteItem(id);
    load();
  }

  return (
    <main className="flex flex-col gap-5 p-[26px_30px_40px]">
      <header className="flex items-end gap-4">
        <div>
          <div className="mb-[5px] text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">
            {projectFilter || tagFilter ? "フィルタ中" : "受信箱"}
          </div>
          <h3 className="tracking-[-0.02em]">{heading}</h3>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(projectFilter || tagFilter) && (
            <Link href="/library" className="btn btn-ghost text-[12px]">
              <Icon name="x" /> フィルタ解除
            </Link>
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

      <div className="flex gap-[9px] rounded-xl bg-surface p-[9px] shadow-[0_0_0_1px_var(--color-neutral-800),inset_0_0_44px_rgba(145,132,217,0.07)]">
        <Icon name="link" size={17} className="ml-[7px] self-center text-accent" />
        <input
          className="flex-1 self-center bg-transparent text-[14px] text-text outline-none placeholder:text-text/40"
          placeholder="URLを貼る、またはファイルをドロップ — 記事・PDF・動画・スレッド"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ingest()}
        />
        <Button variant="primary" onClick={ingest} disabled={busy}>
          <Icon name="arrow-right" />
          {busy ? "読み取り中…" : "読み取って整理"}
        </Button>
        <Link
          href="/capture?from=hazy"
          className="btn self-center whitespace-nowrap text-[12px] no-underline"
        >
          <Icon name="tray" />
          Hazyから
        </Link>
      </div>

      {view === "card" ? (
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              projectName={projectName(it.projectId)}
              onDelete={() => remove(it.id)}
            />
          ))}
          <Link
            href="/capture"
            className="card items-start justify-center gap-2 bg-transparent no-underline shadow-[inset_0_0_0_1px_var(--color-neutral-900)]"
          >
            <Icon name="plus" size={20} className="text-accent" />
            <div className="card-title text-[15px] text-text">ここにドロップ</div>
            <p className="card-body text-[12px]">
              拡張機能・共有シート・メール転送からも入ります。
            </p>
          </Link>
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
      <Link
        href={item.relatedNoteId ? `/notes/${item.relatedNoteId}` : "/capture"}
        className="card-title text-text no-underline hover:text-accent-300"
      >
        {item.title}
      </Link>

      {item.points.length > 0 ? (
        <div className="flex flex-col gap-[5px] rounded-md bg-accent/[0.08] p-[9px]">
          <div className="text-[10px] uppercase tracking-[0.08em] text-accent">抽出した論点</div>
          <div className="text-[12px] leading-[1.6] opacity-85">
            {item.points.map((p, i) => (
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
