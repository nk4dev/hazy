"use client";

import { Loader2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Click-to-edit text — Enter/blur commits, Escape reverts. Empty commits `null`. */
export function EditableField({
  value,
  placeholder,
  onCommit,
  pending,
  label,
  className,
  inputClassName,
  valueClassName,
  onValueClick,
}: {
  value: string | null;
  placeholder: string;
  onCommit: (next: string | null) => void;
  pending?: boolean;
  label: string;
  className?: string;
  inputClassName?: string;
  valueClassName?: string;
  /** When set, the display text (not the edit button) is clickable — e.g. filter-by-domain. */
  onValueClick?: () => void;
}) {
  const t = useTranslations("item");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const committedRef = useRef(false);

  function start() {
    setDraft(value ?? "");
    committedRef.current = false;
    setEditing(true);
  }

  function commit() {
    if (committedRef.current) return;
    committedRef.current = true;
    setEditing(false);
    const next = draft.trim();
    if (next !== (value ?? "")) onCommit(next || null);
  }

  function revert() {
    committedRef.current = true;
    setEditing(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      revert();
    }
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={placeholder}
        aria-label={label}
        className={cn("h-auto py-0.5", inputClassName)}
      />
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      {onValueClick && value ? (
        <button
          type="button"
          className={cn("min-w-0 truncate hover:underline", valueClassName)}
          onClick={onValueClick}
        >
          {value}
        </button>
      ) : (
        <span className={cn("min-w-0 truncate", valueClassName)}>{value || placeholder}</span>
      )}
      {pending ? (
        <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("editField", { field: label })}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={start}
        >
          <Pencil className="size-3" />
        </Button>
      )}
    </span>
  );
}
