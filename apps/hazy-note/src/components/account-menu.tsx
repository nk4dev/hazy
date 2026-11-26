import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useAuthSession } from "./auth-provider";

export function AccountMenu() {
  const { user, signOut } = useAuthSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (user?.name || user?.email || "H").trim().slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="アカウントメニュー"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-[12px] font-medium text-accent-200 ring-1 ring-accent/35 transition hover:bg-accent/30"
      >
        {user?.image ? (
          <img src={user.image} alt={user.name} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 rounded-lg bg-neutral-900 p-2 shadow-[0_0_0_1px_var(--color-neutral-800),0_12px_30px_rgba(0,0,0,0.55)]">
          {user && (
            <div className="mb-1.5 border-b border-white/[0.07] px-2 py-1.5">
              <div className="truncate text-[12.5px] font-medium text-text">{user.name}</div>
              <div className="truncate text-[11px] text-text/50">{user.email}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-red-400 transition hover:bg-white/[0.06]"
          >
            <Icon name="sign-out" size={14} />
            サインアウト
          </button>
        </div>
      )}
    </div>
  );
}
