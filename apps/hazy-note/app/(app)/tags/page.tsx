"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { SkeletonLines } from "@/components/loading";
import { api } from "@/lib/api";
import type { Tag } from "@/lib/types";

/** Where a tag's items live — a tag can span both saved URLs and notes. */
function primaryHref(tag: Tag): string {
  return tag.urlCount > 0
    ? `/library?tag=${encodeURIComponent(tag.label)}`
    : `/notes?tag=${encodeURIComponent(tag.label)}`;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[] | null>(null);

  useEffect(() => {
    api
      .tags()
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  const maxCount = tags?.[0]?.count ?? 1;

  return (
    <main className="flex flex-col gap-5 p-4 pb-10 sm:p-[26px_30px_40px]">
      <header>
        <div className="mb-[5px] text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">
          タグ一覧
        </div>
        <h3 className="tracking-[-0.02em]">
          使われているタグ
          {tags && tags.length > 0 && (
            <span className="ml-[8px] text-[13px] font-normal text-text/45">{tags.length}件</span>
          )}
        </h3>
      </header>

      {tags === null && <SkeletonLines lines={8} className="max-w-[420px]" />}

      {tags && tags.length === 0 && (
        <div className="rounded-[10px] bg-surface px-6 py-10 text-center text-[13px] leading-[1.8] text-text/55 shadow-[0_0_0_1px_var(--color-neutral-900)]">
          まだタグがありません。ノートや受信箱の項目にタグが付くと、ここに一覧されます。
        </div>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-col rounded-[10px] bg-surface shadow-[0_0_0_1px_var(--color-neutral-900)]">
          {tags.map((t) => (
            <Link
              key={t.id}
              href={primaryHref(t)}
              className="flex items-center gap-3 border-b border-white/[0.05] px-[16px] py-[11px] no-underline last:border-0 hover:bg-white/[0.03]"
            >
              <Icon name="hash" size={15} className="shrink-0 text-accent/70" />
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">{t.label}</span>
              <span className="hidden shrink-0 text-[11px] text-text/40 sm:inline">
                {t.urlCount > 0 && `出典${t.urlCount}`}
                {t.urlCount > 0 && t.noteCount > 0 && " · "}
                {t.noteCount > 0 && `ノート${t.noteCount}`}
              </span>
              <span className="h-[6px] w-[70px] shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full rounded-full bg-accent/70"
                  style={{ width: `${Math.max(6, (t.count / maxCount) * 100)}%` }}
                />
              </span>
              <span className="w-[26px] shrink-0 text-right text-[12px] text-text/60">
                {t.count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
