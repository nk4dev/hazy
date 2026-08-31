"use client";

import "quill/dist/quill.bubble.css";
import type Quill from "quill";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api";
import type { Item } from "@/lib/types";
import type { DeltaOp } from "@/lib/note-delta";
import { Icon } from "./icon";

export type CiteTarget = { title: string; site: string; url: string };
export type NoteEditorHandle = { insertTextAtCursor: (text: string) => void };

/** An `@token` at the caret — after a space or line start, so `foo@bar.com`
 *  and `@decorator` mid-word don't trigger it. */
const TRIGGER = /(?:^|\s)@([^\s@[\]]*)$/;

const TOOLBAR = [
  ["bold", "italic"],
  [{ header: 2 }, { header: 3 }],
  ["blockquote", "link"],
  [{ list: "bullet" }, { list: "ordered" }],
];

type MentionState = {
  /** doc index of the trigger `@`. */
  at: number;
  /** chars to replace (the `@` + query). */
  len: number;
  query: string;
  top: number;
  left: number;
};

function iconFor(kind: Item["kind"]): string {
  return kind === "video"
    ? "play-circle"
    : kind === "pdf"
      ? "file-pdf"
      : kind === "thread"
        ? "chats"
        : "globe";
}

/**
 * The Quill (bubble theme) note body. Round-trips the Delta `ops` array, emits
 * a debounced `onChange`, and pops a saved-URL picker when you type `@` — the
 * pick inserts a link and calls `onCite` so the note records it as a source.
 */
export const NoteEditor = forwardRef<
  NoteEditorHandle,
  {
    value: DeltaOp[];
    onChange: (ops: DeltaOp[]) => void;
    onCite: (target: CiteTarget) => void;
    placeholder?: string;
  }
>(function NoteEditor({ value, onChange, onCite, placeholder }, ref) {
  const holderRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  const onCiteRef = useRef(onCite);
  onChangeRef.current = onChange;
  onCiteRef.current = onCite;

  const [items, setItems] = useState<Item[]>([]);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [sel, setSel] = useState(0);
  const mentionRef = useRef<MentionState | null>(null);
  const selRef = useRef(sel);
  mentionRef.current = mention;
  selRef.current = sel;

  useEffect(() => {
    api
      .items()
      .then((its) => setItems(its.filter((it) => it.kind !== "note")))
      .catch(() => {});
  }, []);

  const results = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return items
      .filter((it) => !q || `${it.title} ${it.site} ${it.url}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, mention]);
  const resultsRef = useRef(results);
  resultsRef.current = results;

  // ── mount Quill (dynamic import — Quill touches `document` at load) ──
  useEffect(() => {
    let quill: Quill | null = null;
    let markdown: { destroy: () => void } | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    (async () => {
      const [{ default: QuillCtor }, { default: QuillMarkdown }] = await Promise.all([
        import("quill"),
        import("quilljs-markdown"),
      ]);
      if (disposed || !holderRef.current) return;

      quill = new QuillCtor(holderRef.current, {
        theme: "bubble",
        placeholder,
        modules: { toolbar: TOOLBAR },
      });
      quillRef.current = quill;

      // Live markdown: `#`/`##`/`###`, `> `, `**bold**`, `*italic*`, `[t](url)`
      // convert as you type. `- ` / `1. ` lists are handled by Quill's own
      // keyboard defaults. Restricted to the formats the toolbar +
      // lib/note-delta.ts round-trip — no h4–h6, strikethrough, or code blocks
      // (they'd export as unstyled text).
      markdown = new QuillMarkdown(quill, {
        ignoreTags: ["h4", "h5", "h6", "strikethrough", "pre", "code"],
      });

      if (value.length) quill.setContents({ ops: value } as never, "silent");

      const scan = () => {
        const range = quill?.getSelection();
        if (!quill || !range || range.length > 0) return setMention(null);
        const before = quill.getText(0, range.index);
        const m = before.match(TRIGGER);
        if (!m) return setMention(null);
        const at = range.index - m[0].length + m[0].indexOf("@");
        const b = quill.getBounds(range.index) ?? { top: 0, left: 0, height: 20 };
        setSel(0);
        setMention({ at, len: range.index - at, query: m[1], top: b.top + b.height + 4, left: b.left });
      };

      quill.on("text-change", (_d, _o, source) => {
        scan();
        if (source !== "user") return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          onChangeRef.current(quill?.getContents().ops ?? []);
        }, 600);
      });
      quill.on("selection-change", scan);

      quill.root.addEventListener("keydown", onKeyDown, true);
    })();

    function onKeyDown(e: KeyboardEvent) {
      const men = mentionRef.current;
      const res = resultsRef.current;
      if (!men || res.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => (s + 1) % res.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => (s - 1 + res.length) % res.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(res[selRef.current] ?? res[0]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
      }
    }

    return () => {
      disposed = true;
      if (debounce) clearTimeout(debounce);
      markdown?.destroy();
      quill?.root.removeEventListener("keydown", onKeyDown, true);
      // flush a pending edit
      const q = quillRef.current;
      if (q) onChangeRef.current(q.getContents().ops ?? []);
      quillRef.current = null;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: mount-once; refs carry live props
  }, []);

  function pick(it: Item | undefined) {
    const q = quillRef.current;
    const men = mentionRef.current;
    if (!q || !it || !men) return;
    q.deleteText(men.at, men.len, "user");
    q.insertText(men.at, it.title, { link: it.url }, "user");
    q.insertText(men.at + it.title.length, " ", {}, "user");
    q.setSelection(men.at + it.title.length + 1, 0, "user");
    onCiteRef.current({ title: it.title, site: it.site, url: it.url });
    setMention(null);
    onChangeRef.current(q.getContents().ops ?? []);
  }

  useImperativeHandle(ref, () => ({
    insertTextAtCursor(text: string) {
      const q = quillRef.current;
      if (!q) return;
      const range = q.getSelection(true);
      const idx = range ? range.index : q.getLength();
      q.insertText(idx, `${text}\n`, "user");
      q.setSelection(idx + text.length + 1, 0, "user");
      onChangeRef.current(q.getContents().ops ?? []);
    },
  }));

  return (
    <div className="note-editor relative">
      <div ref={holderRef} />
      {mention && results.length > 0 && (
        <ul
          className="absolute z-20 max-h-[240px] w-[min(440px,90vw)] overflow-auto rounded-lg bg-neutral-900 py-1 shadow-[0_0_0_1px_var(--color-neutral-800),0_14px_36px_rgba(0,0,0,0.5)]"
          style={{ top: mention.top, left: mention.left }}
        >
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
                <Icon name={iconFor(it.kind)} size={14} className="mt-[2px] text-accent" />
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
});
