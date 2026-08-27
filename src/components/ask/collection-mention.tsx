"use client";

import { ArrowUpRight, Layers, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useCollectionQuery, useCollectionsQuery } from "@/hooks/use-collections";
import { cn } from "@/lib/utils";
import type { CollectionDTO } from "@/types/api";

// Matches a trailing "@partial" token (start of string or after whitespace)
// in the text before the caret — the trigger for the collection menu.
const MENTION_RE = /(?:^|\s)@([^\s@]*)$/;
const MAX_MENU_ITEMS = 6;
const MAX_PREVIEW_LINKS = 6;

/**
 * A text input with an "@" autocomplete for the user's collections. Picking one
 * strips the "@…" fragment and adds the collection id to `selectedIds` (the Ask
 * pipeline pins that collection's links into the prompt). The menu previews the
 * highlighted collection's links, predictive-input style.
 */
export function CollectionMentionField({
  value,
  onChange,
  selectedIds,
  onAdd,
  disabled,
  placeholder,
  className,
  inputClassName,
  autoFocus,
  menuPlacement = "bottom",
}: {
  value: string;
  onChange: (next: string) => void;
  selectedIds: string[];
  onAdd: (collectionId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  menuPlacement?: "top" | "bottom";
}) {
  const t = useTranslations("ask");
  const { data } = useCollectionsQuery();
  const inputRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const listboxId = useId();

  const collections = data?.items ?? [];
  const match = value.slice(0, caret).match(MENTION_RE);
  const mentionQuery = match ? match[1] : null;

  const candidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return collections
      .filter((c) => !selectedIds.includes(c.id) && c.name.toLowerCase().includes(q))
      .slice(0, MAX_MENU_ITEMS);
  }, [collections, mentionQuery, selectedIds]);

  const open = mentionQuery !== null && !dismissed && candidates.length > 0;

  // Reset the highlighted row whenever the query (and thus the candidate list)
  // changes; clear a prior Escape-dismiss once the "@…" token is gone.
  useEffect(() => {
    setHighlight(0);
    if (mentionQuery === null) setDismissed(false);
  }, [mentionQuery]);

  const previewId = open ? (candidates[highlight]?.id ?? null) : null;
  const preview = useCollectionQuery(previewId ?? "");

  function syncCaret(el: HTMLInputElement) {
    setCaret(el.selectionStart ?? el.value.length);
  }

  function pick(collection: CollectionDTO) {
    if (!match) return;
    const atIndex = (match.index ?? 0) + match[0].indexOf("@");
    const next = value.slice(0, atIndex) + value.slice(caret);
    onChange(next);
    onAdd(collection.id);
    setDismissed(false);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(atIndex, atIndex);
      setCaret(atIndex);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % candidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + candidates.length) % candidates.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const chosen = candidates[highlight];
      if (chosen) pick(chosen);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissed(true);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        // biome-ignore lint/a11y/noAutofocus: opt-in via prop, matches the plain input it replaces
        autoFocus={autoFocus}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        className={cn("w-full bg-transparent outline-none", inputClassName)}
        onChange={(e) => {
          onChange(e.target.value);
          syncCaret(e.target);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => syncCaret(e.currentTarget)}
        onClick={(e) => syncCaret(e.currentTarget)}
        onSelect={(e) => syncCaret(e.currentTarget)}
        onFocus={() => setDismissed(false)}
        onBlur={() => setDismissed(true)}
      />

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            "absolute left-0 right-0 z-50 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md",
            menuPlacement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          )}
        >
          <ul className="max-h-56 overflow-y-auto p-1">
            {candidates.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    i === highlight ? "bg-secondary" : "hover:bg-secondary/60"
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(c);
                  }}
                >
                  <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {t("mentionItemCount", { count: c.itemCount })}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-border/60 bg-secondary/30 px-3 py-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("mentionPreviewTitle")}
            </div>
            {preview.isLoading ? (
              <div className="text-[12px] text-muted-foreground">{t("mentionPreviewLoading")}</div>
            ) : preview.data && preview.data.items.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {preview.data.items.slice(0, MAX_PREVIEW_LINKS).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-1.5 text-[12px] text-foreground/80"
                  >
                    <ArrowUpRight className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.title || item.url}</span>
                    <span className="shrink-0 text-muted-foreground">{item.domain}</span>
                  </li>
                ))}
                {preview.data.items.length > MAX_PREVIEW_LINKS && (
                  <li className="text-[11px] text-muted-foreground">
                    {t("mentionPreviewMore", {
                      count: preview.data.items.length - MAX_PREVIEW_LINKS,
                    })}
                  </li>
                )}
              </ul>
            ) : (
              <div className="text-[12px] text-muted-foreground">{t("mentionPreviewEmpty")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Chips for the collections the user has attached to their question. */
export function AttachedCollections({
  selectedIds,
  onRemove,
  className,
}: {
  selectedIds: string[];
  onRemove: (collectionId: string) => void;
  className?: string;
}) {
  const t = useTranslations("ask");
  const { data } = useCollectionsQuery();
  if (selectedIds.length === 0) return null;
  const byId = new Map((data?.items ?? []).map((c) => [c.id, c]));

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {selectedIds.map((id) => {
        const c = byId.get(id);
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[12px]"
          >
            <Layers className="size-3 text-muted-foreground" />
            <span className="max-w-40 truncate">{c?.name ?? "…"}</span>
            {c && (
              <span className="text-[10px] text-muted-foreground">
                {t("mentionItemCount", { count: c.itemCount })}
              </span>
            )}
            <button
              type="button"
              aria-label={t("mentionRemove")}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onRemove(id)}
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
    </div>
  );
}
