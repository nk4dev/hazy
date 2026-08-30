"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { Sidebar } from "./sidebar";

/** App layout: a static sidebar on ≥lg, an off-canvas drawer + top bar below. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation and on Escape.
  // biome-ignore lint/correctness/useExhaustiveDependencies: close on path change
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-neutral-900 px-4 py-[10px] lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="メニューを開く"
          className="text-text/70 hover:text-text"
        >
          <Icon name="list" size={22} />
        </button>
        <Link href="/notes" className="flex items-center gap-2 no-underline">
          <span className="h-[18px] w-[18px] rounded-[6px] bg-[radial-gradient(circle_at_30%_25%,var(--color-accent-400),var(--color-accent-700))]" />
          <span className="text-[14px] font-medium text-text">hazy note</span>
        </Link>
        <div className="ml-auto">
          <UserButton />
        </div>
      </header>

      {open && (
        <button
          type="button"
          aria-label="メニューを閉じる"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      <Sidebar open={open} onNavigate={() => setOpen(false)} />

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
