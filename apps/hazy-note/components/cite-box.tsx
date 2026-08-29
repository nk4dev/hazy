"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Item } from "@/lib/types";
import { Icon } from "./icon";

/**
 * The "つづきを書く" box. Auto-grows, submits on Enter, and — when you type `@` —
 * pops a predictive list of your saved URLs. Picking one inserts `[n]` and calls
 * `onCite`, which registers the URL as a source of the note and returns its
 * citation number.
 */
export function CiteBox({
  value,
  onChange,
  onSubmit,
  onCite,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCite: (label: string, url: string) => number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState<string | null>(null); // null = closed
  const [sel, setSel] = useState(0);

  useEffect(() => {
    api
      .items()
      .then((its) => setItems(its.filter((it) => it.kind !== "note")))
      .catch(() => {});
  }, []);

  // grow to fit
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const results = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return items
      .filter((it) => !q || `${it.title} ${it.site} ${it.url}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [items, query]);

  /** Look for an `@token` immediately before the caret. */
  function scan() {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const m = value.slice(0, caret).match(/(?:^|\s)@([^\s@[\]]*)$/);
    if (m) {
      setQuery(m[1]);
      setSel(0);
    } else {
      setQuery(null);
    }
  }

  function pick(it: Item) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const n = onCite(`${it.title} — ${it.site}`, it.url);
    const token = `[${n}] `;
    const next = before.slice(0, at) + token + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = at + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const open = query !== null && results.length > 0;

  return (
    <div className="relative">
      <textarea
        ref={ref}
        rows={1}
        className="m-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[15px] leading-[1.85] text-text/[0.55] caret-accent outline-none placeholder:text-text/[0.32] focus:text-text/90"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // let state settle, then read caret
          requestAnimationFrame(scan);
        }}
        onClick={scan}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) scan();
        }}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => (s + 1) % results.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => (s - 1 + results.length) % results.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(results[sel]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setQuery(null);
              return;
            }
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        onBlur={() => window.setTimeout(() => setQuery(null), 120)}
      />

      {open && (
        <ul className="absolute left-0 top-[calc(100%+6px)] z-20 max-h-[240px] w-[min(440px,90vw)] overflow-auto rounded-lg bg-neutral-900 py-1 shadow-[0_0_0_1px_var(--color-neutral-800),0_14px_36px_rgba(0,0,0,0.5)]">
          {results.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(it);
                }}
                className={`flex w-full items-start gap-[9px] px-[11px] py-[8px] text-left ${
                  i === sel ? "bg-accent/[0.16]" : "hover:bg-white/[0.05]"
                }`}
              >
                <Icon
                  name={
                    it.kind === "video"
                      ? "play-circle"
                      : it.kind === "pdf"
                        ? "file-pdf"
                        : it.kind === "thread"
                          ? "chats"
                          : "globe"
                  }
                  size={14}
                  className="mt-[2px] text-accent"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-text">{it.title}</span>
                  <span className="block truncate text-[11px] text-text/50">{it.site}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
