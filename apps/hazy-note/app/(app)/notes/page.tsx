"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { SkeletonCards } from "@/components/loading";
import { Tag } from "@/components/ui";
import { api } from "@/lib/api";
import { deltaExcerpt, paragraphCount } from "@/lib/note-delta";
import type { Note } from "@/lib/types";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .notes()
      .then(setNotes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex flex-col gap-5 p-4 pb-10 sm:p-[26px_30px_40px]">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <div className="mb-[5px] text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">
            ノート
          </div>
          <h3 className="tracking-[-0.02em]">概念単位で書きためる</h3>
        </div>
        <Link href="/notes/new" className="btn btn-primary ml-auto text-[13px]">
          <Icon name="plus" /> 新しいノート
        </Link>
      </header>

      {loading && <SkeletonCards count={6} />}

      {!loading && notes.length === 0 && (
        <div className="rounded-[10px] bg-surface px-6 py-10 text-center text-[13px] leading-[1.8] text-text/55 shadow-[0_0_0_1px_var(--color-neutral-900)]">
          まだノートがありません。「新しいノート」から書き始めるか、
          <br />
          比較ボードのまとめをノートに落とせます。
        </div>
      )}

      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-3">
        {notes.map((n) => (
          <Link key={n.id} href={`/notes/${n.id}`} className="card gap-[9px] elev-sm no-underline">
            <div className="card-meta">
              <Icon
                name={n.status === "done" ? "check-circle" : "circle-dashed"}
                className={n.status === "done" ? "text-accent" : "text-text/40"}
              />
              {n.updatedLabel}
              <span className="ml-auto">
                {paragraphCount(n.body)}段落 · {n.sources.length}出典
              </span>
            </div>
            <div className="card-title text-text">{n.title}</div>
            <p className="card-body">{deltaExcerpt(n.body, 140)}</p>
            <div className="flex flex-wrap gap-[5px]">
              {n.tags.map((t) => (
                <Tag key={t.label} tone={t.tone === "outline" ? "outline" : t.tone}>
                  {t.label}
                </Tag>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
