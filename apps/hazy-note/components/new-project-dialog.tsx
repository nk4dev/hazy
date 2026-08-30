"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { Button } from "./ui";

/** Modal for creating a project — replaces the old `window.prompt`. */
export function NewProjectDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDesc("");
    setBusy(false);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate(name.trim(), desc.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="新しいプロジェクト"
        className="relative w-full max-w-[420px] rounded-[14px] bg-bg p-5 shadow-[0_0_0_1px_var(--color-neutral-800),0_24px_60px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-1 flex items-center gap-2 text-[13px] font-medium text-accent">
          <Icon name="folder-plus" size={16} />
          新しいプロジェクト
        </div>
        <p className="mb-4 text-[12px] leading-[1.6] text-text/50">
          アイデアを練る場です。名前はあとで変更できます。
        </p>

        <span className="mb-1 block text-[11px] text-text/50">名前</span>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="例: 生成AIと著作権"
          className="input mb-3 w-full text-[14px]"
        />

        <span className="mb-1 block text-[11px] text-text/50">アイデア（任意）</span>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          placeholder="この企画で言いたいこと・仮説…"
          className="mb-4 w-full resize-none rounded-lg bg-surface px-[11px] py-[9px] text-[13px] leading-[1.7] text-text/90 caret-accent outline-none shadow-[0_0_0_1px_var(--color-neutral-900)] placeholder:text-text/30 focus:shadow-[0_0_0_1px_var(--color-accent-800)]"
        />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost text-[13px]">
            キャンセル
          </button>
          <Button variant="primary" onClick={submit} disabled={!name.trim() || busy}>
            {busy ? "作成中…" : "作成"}
          </Button>
        </div>
      </div>
    </div>
  );
}
