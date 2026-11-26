import { useLocation } from "@tanstack/react-router";
import { useState } from "react";
import {
  useCreateNoteProjectMutation,
  useNoteProjectsQuery,
  useNoteTagsQuery,
} from "@/lib/hooks";
import { NoteLink, useNoteNavigate } from "@/lib/navigation";
import { AccountMenu } from "@/src/components/account-menu";
import { DensityToggle } from "./density-toggle";
import { Icon } from "./icon";
import { NewProjectDialog } from "./new-project-dialog";
import { Tag } from "./ui";

// ノートが主役。残りは「素材をノートに集める」ための補助メニュー。
const NAV = [
  { href: "/search", icon: "magnifying-glass", label: "検索" },
  { href: "/library", icon: "tray", label: "受信箱" },
  { href: "/capture", icon: "link", label: "取り込み" },
  { href: "/analyze", icon: "chart-donut", label: "傾向分析" },
  { href: "/export", icon: "export", label: "書き出す" },
];

export function Sidebar({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const pathname = useLocation().pathname;
  const router = useNoteNavigate();
  const { data: projects = [] } = useNoteProjectsQuery();
  const { data: tags = [] } = useNoteTagsQuery();
  const createProjectMutation = useCreateNoteProjectMutation();
  const [newOpen, setNewOpen] = useState(false);

  async function createProject(name: string, description: string) {
    const created = await createProjectMutation.mutateAsync({
      name,
      ...(description ? { description } : {}),
    });
    setNewOpen(false);
    router.push(`/projects/${created.id}`);
  }

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] max-w-[82vw] flex-col gap-5 overflow-y-auto border-r border-white/[0.06] bg-neutral-900 p-[18px_13px] transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[220px] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-[9px] px-[7px]">
          <NoteLink
            href="/notes"
            onClick={onNavigate}
            className="flex flex-1 items-center gap-[9px] no-underline"
          >
            <span className="h-[22px] w-[22px] rounded-[7px] bg-[radial-gradient(circle_at_30%_25%,var(--color-accent-400),var(--color-accent-700))] shadow-[0_0_14px_rgba(145,132,217,0.45)]" />
            <span className="text-[15px] font-medium tracking-[-0.01em] text-text">hazy note</span>
          </NoteLink>
          <AccountMenu />
        </div>

        <nav className="flex flex-col gap-[2px]">
          {/* ノート = 主要機能。常時プライマリーカラーで最上部に固定 */}
          <div className="mb-[6px] flex items-stretch gap-1">
            <NoteLink
              href="/notes"
              onClick={onNavigate}
              className={`flex flex-1 items-center gap-[10px] rounded-lg px-[11px] py-[9px] text-[13.5px] font-medium no-underline text-accent-100 shadow-[0_0_18px_rgba(145,132,217,0.4)] transition ${
                pathname === "/notes" || pathname.startsWith("/notes/")
                  ? "bg-accent"
                  : "bg-accent/90 hover:bg-accent"
              }`}
            >
              <Icon name="notebook" size={17} />
              ノート
            </NoteLink>
            <NoteLink
              href="/notes/new"
              title="新しいノート"
              onClick={onNavigate}
              className="flex items-center rounded-lg bg-accent/90 px-[10px] text-accent-100 no-underline shadow-[0_0_18px_rgba(145,132,217,0.4)] transition hover:bg-accent"
            >
              <Icon name="plus" size={14} />
            </NoteLink>
          </div>
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <NoteLink
                key={n.href}
                href={n.href}
                onClick={onNavigate}
                className={`flex items-center gap-[10px] rounded-lg px-[10px] py-[7px] text-[13px] no-underline ${
                  active ? "bg-accent/[0.12] text-accent" : "text-text hover:bg-white/[0.04]"
                }`}
              >
                <Icon name={n.icon} size={16} />
                {n.label}
              </NoteLink>
            );
          })}
        </nav>

        <div className="flex flex-col gap-[7px]">
          <div className="px-[10px] text-[10px] uppercase tracking-[0.1em] text-text/[0.38]">
            プロジェクト
          </div>
          <div className="flex flex-col gap-px">
            {projects.map((p) => (
              <NoteLink
                key={p.id}
                href={`/projects/${p.id}`}
                onClick={onNavigate}
                className="flex items-center gap-[9px] rounded-[7px] px-[10px] py-[6px] text-[13px] text-text no-underline hover:bg-white/[0.04]"
              >
                <span
                  className={`h-[6px] w-[6px] rounded-full ${
                    p.tone === "accent" ? "bg-accent" : "bg-neutral-600"
                  }`}
                />
                {p.name}
                <span className="ml-auto text-[11px] opacity-40">{p.count}</span>
              </NoteLink>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="mt-[3px] flex items-center justify-center gap-[6px] rounded-lg border border-accent/45 bg-accent/[0.08] px-[10px] py-[8px] text-[12.5px] font-medium text-accent-100 shadow-[0_0_14px_rgba(145,132,217,0.25)] transition hover:border-accent hover:bg-accent/[0.16]"
          >
            <Icon name="plus" size={13} />
            {projects.length === 0 ? "最初のプロジェクトを作る" : "プロジェクトを作成"}
          </button>
        </div>

        <div className="mt-auto flex flex-col gap-[7px]">
          <div className="px-[10px] text-[10px] uppercase tracking-[0.1em] text-text/[0.38]">
            表示
          </div>
          <div className="px-[10px]">
            <DensityToggle />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <NoteLink
            href="/tags"
            onClick={onNavigate}
            className="px-[10px] text-[10px] uppercase tracking-[0.1em] text-text/[0.38] no-underline hover:text-text/60"
          >
            タグ
          </NoteLink>
          <div className="flex flex-wrap gap-[5px] px-[10px]">
            {tags.slice(0, 4).map((t) => (
              <NoteLink
                key={t.id}
                href={`/library?tag=${encodeURIComponent(t.label)}`}
                onClick={onNavigate}
              >
                <Tag tone={t.tone === "accent" ? "accent" : "neutral"}>{t.label}</Tag>
              </NoteLink>
            ))}
            {tags.length > 4 && (
              <NoteLink href="/tags" onClick={onNavigate}>
                <Tag tone="outline">+{tags.length - 4}</Tag>
              </NoteLink>
            )}
          </div>
        </div>
      </aside>
      <NewProjectDialog open={newOpen} onClose={() => setNewOpen(false)} onCreate={createProject} />
    </>
  );
}
