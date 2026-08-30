"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Project, Tag as TagT } from "@/lib/types";
import { Icon } from "./icon";
import { Tag } from "./ui";

// ノートが主役。残りは「素材をノートに集める」ための補助メニュー。
const NAV = [
  { href: "/library", icon: "tray", label: "受信箱" },
  { href: "/capture", icon: "link", label: "取り込み" },
  { href: "/compare", icon: "columns", label: "比較ボード" },
  { href: "/export", icon: "export", label: "書き出す" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<TagT[]>([]);

  const load = () => {
    api
      .projects()
      .then(setProjects)
      .catch(() => {});
    api
      .tags()
      .then(setTags)
      .catch(() => {});
  };
  useEffect(load, []);

  async function addProject() {
    const name = window.prompt("プロジェクト名（あとで変更できます）");
    if (!name?.trim()) return;
    const created = await api.addProject(name.trim());
    load();
    router.push(`/projects/${created.id}`);
  }


  return (
    <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-white/[0.06] bg-neutral-900 p-[18px_13px]">
      <div className="flex items-center gap-[9px] px-[7px]">
        <Link
          href="/notes"
          target="_self"
          className="flex flex-1 items-center gap-[9px] no-underline"
        >
          <span className="h-[22px] w-[22px] rounded-[7px] bg-[radial-gradient(circle_at_30%_25%,var(--color-accent-400),var(--color-accent-700))] shadow-[0_0_14px_rgba(145,132,217,0.45)]" />
          <span className="text-[15px] font-medium tracking-[-0.01em] text-text">hazy note</span>
        </Link>
        <UserButton />
      </div>

      <nav className="flex flex-col gap-[2px]">
        {/* ノート = 主要機能。常時プライマリーカラーで最上部に固定 */}
        <div className="mb-[6px] flex items-stretch gap-1">
          <Link
            href="/notes"
            target="_self"
            className={`flex flex-1 items-center gap-[10px] rounded-lg px-[11px] py-[9px] text-[13.5px] font-medium no-underline text-accent-100 shadow-[0_0_18px_rgba(145,132,217,0.4)] transition ${
              pathname === "/notes" || pathname.startsWith("/notes/")
                ? "bg-accent"
                : "bg-accent/90 hover:bg-accent"
            }`}
          >
            <Icon name="notebook" size={17} />
            ノート
          </Link>
          <Link
            href="/notes/new"
            target="_self"
            title="新しいノート"
            className="flex items-center rounded-lg bg-accent/90 px-[10px] text-accent-100 no-underline shadow-[0_0_18px_rgba(145,132,217,0.4)] transition hover:bg-accent"
          >
            <Icon name="plus" size={14} />
          </Link>
        </div>
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
          return (
            <Link
              key={n.href}
              href={n.href}
              target="_self"
              className={`flex items-center gap-[10px] rounded-lg px-[10px] py-[7px] text-[13px] no-underline ${
                active ? "bg-accent/[0.12] text-accent" : "text-text hover:bg-white/[0.04]"
              }`}
            >
              <Icon name={n.icon} size={16} />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-[7px]">
        <div className="flex items-center px-[10px] text-[10px] uppercase tracking-[0.1em] text-text/[0.38]">
          プロジェクト
          <button
            onClick={addProject}
            className="ml-auto text-text/50 hover:text-text"
            title="プロジェクトを追加"
          >
            <Icon name="plus" size={12} />
          </button>
        </div>
        <div className="flex flex-col gap-px">
          {projects.length === 0 && (
            <div className="px-[10px] py-1 text-[11px] text-text/35">まだありません</div>
          )}
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              target="_self"
              className="flex items-center gap-[9px] rounded-[7px] px-[10px] py-[6px] text-[13px] text-text no-underline hover:bg-white/[0.04]"
            >
              <span
                className={`h-[6px] w-[6px] rounded-full ${
                  p.tone === "accent" ? "bg-accent" : "bg-neutral-600"
                }`}
              />
              {p.name}
              <span className="ml-auto text-[11px] opacity-40">{p.count}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <div className="px-[10px] text-[10px] uppercase tracking-[0.1em] text-text/[0.38]">
          タグ
        </div>
        <div className="flex flex-wrap gap-[5px] px-[10px]">
          {tags.slice(0, 4).map((t) => (
            <Link
              key={t.id}
              href={`/library?tag=${encodeURIComponent(t.label)}`}
              target="_self"
            >
              <Tag tone={t.tone === "accent" ? "accent" : "neutral"}>{t.label}</Tag>
            </Link>
          ))}
          {tags.length > 4 && <Tag tone="outline">+{tags.length - 4}</Tag>}
        </div>
      </div>
    </aside>
  );
}
