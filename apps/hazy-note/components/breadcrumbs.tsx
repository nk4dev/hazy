"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Icon } from "./icon";

export type Crumb = { label: string };

type BreadcrumbState = { path: string; crumbs: Crumb[] };

const BreadcrumbContext = createContext<{
  state: BreadcrumbState;
  setCrumbs: (path: string, crumbs: Crumb[]) => void;
} | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BreadcrumbState>({ path: "", crumbs: [] });
  // Bail out when nothing actually changed — `setCrumbs` fires from a render
  // effect on every render of the reporting page, and returning a new object
  // unconditionally would re-render the provider, which hands consumers a new
  // context value, which re-fires their effect: an infinite loop.
  const setCrumbs = useCallback((path: string, crumbs: Crumb[]) => {
    setState((prev) =>
      prev.path === path && JSON.stringify(prev.crumbs) === JSON.stringify(crumbs)
        ? prev
        : { path, crumbs }
    );
  }, []);
  const value = useMemo(() => ({ state, setCrumbs }), [state, setCrumbs]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

/** A detail page (note / project / item) reports its own trailing crumb(s)
 *  once its data has loaded. `null` while loading — nothing is shown yet. */
export function useBreadcrumb(crumbs: Crumb[] | null) {
  const ctx = useContext(BreadcrumbContext);
  const pathname = usePathname();
  const key = crumbs ? JSON.stringify(crumbs) : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands in for `crumbs` (array identity changes every render)
  useEffect(() => {
    if (!ctx || !crumbs) return;
    ctx.setCrumbs(pathname, crumbs);
  }, [ctx, pathname, key]);
}

const ROOT: Record<string, { label: string; href?: string }> = {
  notes: { label: "ノート", href: "/notes" },
  library: { label: "受信箱", href: "/library" },
  capture: { label: "取り込み", href: "/capture" },
  analyze: { label: "傾向分析", href: "/analyze" },
  export: { label: "書き出す", href: "/export" },
  search: { label: "検索", href: "/search" },
  projects: { label: "プロジェクト" }, // no list view — only /projects/[id]
  tags: { label: "タグ", href: "/tags" },
};

/** Renders nothing on top-level pages (nav + sidebar already show where you
 *  are) — only kicks in once a detail page adds a trailing crumb. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const ctx = useContext(BreadcrumbContext);
  const root = ROOT[pathname.split("/")[1] ?? ""];
  const extra = ctx && ctx.state.path === pathname ? ctx.state.crumbs : [];

  const items = useMemo(() => {
    if (!root) return [];
    return [
      { label: root.label, href: root.href },
      ...extra.map((c) => ({ ...c, href: undefined })),
    ];
  }, [root, extra]);

  if (items.length < 2) return null;

  return (
    <nav
      aria-label="パンくずリスト"
      className="flex items-center gap-[6px] overflow-x-auto whitespace-nowrap border-b border-white/[0.06] px-4 py-[9px] text-[12px] text-text/50 sm:px-[30px]"
    >
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed trail for this render, never reordered
          <span key={i} className="flex shrink-0 items-center gap-[6px]">
            {i > 0 && <Icon name="caret-right" size={10} className="opacity-40" />}
            {c.href && !last ? (
              <Link href={c.href} className="no-underline hover:text-text/80">
                {c.label}
              </Link>
            ) : (
              <span className={last ? "text-text/80" : ""}>{c.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
