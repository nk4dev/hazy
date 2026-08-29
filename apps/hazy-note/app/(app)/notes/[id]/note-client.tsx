"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CiteBox } from "@/components/cite-box";
import { Icon } from "@/components/icon";
import { Loading, Spinner } from "@/components/loading";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import type { Note, NoteBlock } from "@/lib/types";

const BLANK: Note = {
  id: "",
  title: "無題のノート",
  projectId: "",
  tags: [],
  status: "draft",
  updatedLabel: "まだ保存していません",
  blocks: [],
  sources: [],
  links: [],
  flags: [],
};

/** `id` is undefined for the `/notes/new` draft — nothing is written to the
 *  DB until the first real edit. */
export function NoteClient({ id }: { id?: string }) {
  const router = useRouter();
  const [noteId, setNoteId] = useState<string | undefined>(id);
  const [note, setNote] = useState<Note | null>(id ? null : BLANK);
  const [showInline, setShowInline] = useState(true);
  const [draft, setDraft] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const isDraft = !noteId;

  // The authoritative note / id, updated synchronously so rapid edits chain
  // correctly instead of building off a stale render.
  const noteRef = useRef<Note | null>(note);
  const idRef = useRef<string | undefined>(noteId);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const adopt = (n: Note) => {
    noteRef.current = n;
    setNote(n);
  };

  const load = useCallback(() => {
    if (!noteId) return;
    api.note(noteId).then(adopt).catch(() => setNotFound(true));
  }, [noteId]);
  useEffect(() => {
    load();
  }, [load]);

  /** Append a write to the queue — never runs two at once, and a failure
   * doesn't stall the queue. */
  function enqueue(job: () => Promise<void>) {
    chain.current = chain.current
      .then(async () => {
        setSaving(true);
        try {
          await job();
        } finally {
          setSaving(false);
        }
      })
      .catch((e) => {
        console.error("note write failed", e);
        setSaving(false);
      });
  }

  /**
   * Apply an edit. The local state changes immediately; the write is queued so
   * overlapping edits never race (each write replaces the whole note). On a
   * `/notes/new` draft the first edit is what creates the row — after that it's
   * a PATCH and the URL is swapped in place (no navigation, no lost focus).
   */
  function mutate(patch: Partial<Note>) {
    const base = noteRef.current;
    if (!base) return;
    const next = { ...base, ...patch };
    adopt(next);
    enqueue(async () => {
      const cur = noteRef.current;
      if (!cur) return;
      const payload = {
        title: cur.title,
        blocks: cur.blocks,
        tags: cur.tags,
        status: cur.status,
        sources: cur.sources,
      };
      if (idRef.current) {
        const saved = await api.updateNote(idRef.current, payload);
        noteRef.current = { ...noteRef.current!, updatedLabel: saved.updatedLabel };
        setNote(noteRef.current);
      } else {
        const created = await api.addNote(payload);
        idRef.current = created.id;
        setNoteId(created.id);
        window.history.replaceState(null, "", `/notes/${created.id}`);
        noteRef.current = { ...noteRef.current!, id: created.id, updatedLabel: created.updatedLabel };
        setNote(noteRef.current);
      }
    });
  }

  function act(i: number, action: "accept" | "dismiss") {
    if (!idRef.current) return; // suggestions only exist on saved notes
    enqueue(async () => {
      adopt(await api.suggestion(idRef.current as string, i, action));
    });
  }

  /** Register a URL as a source of this note; returns its `[n]` number. */
  function cite(label: string, url: string): number {
    const base = noteRef.current;
    if (!base) return 0;
    const existing = base.sources.find((s) => s.label === label || s.label.startsWith(`${label} `));
    if (existing) {
      if (!existing.cited) {
        mutate({ sources: base.sources.map((s) => (s === existing ? { ...s, cited: true } : s)) });
      }
      return existing.n;
    }
    const n = base.sources.reduce((m, s) => Math.max(m, s.n), 0) + 1;
    mutate({ sources: [...base.sources, { n, label, cited: true }] });
    void url;
    return n;
  }

  function editBlockText(i: number, text: string) {
    const b = noteRef.current;
    if (!b) return;
    const current = b.blocks[i];
    if (!current || !("text" in current) || current.text === text) return;
    if (!text.trim()) return deleteBlock(i);
    mutate({ blocks: b.blocks.map((x, j) => (j === i ? { ...x, text } : x)) });
  }

  function deleteBlock(i: number) {
    const b = noteRef.current;
    if (!b) return;
    mutate({ blocks: b.blocks.filter((_, j) => j !== i) });
  }

  function addParagraph() {
    const text = draft.trim();
    const b = noteRef.current;
    if (!text || !b) return;
    setDraft("");
    mutate({ blocks: [...b.blocks, { type: "p", text }] });
  }

  function addTag() {
    const b = noteRef.current;
    if (!b) return;
    const label = window.prompt("タグ")?.trim();
    if (!label || b.tags.some((t) => t.label === label)) return;
    mutate({ tags: [...b.tags, { label, tone: "neutral" }] });
  }

  function removeTag(label: string) {
    const b = noteRef.current;
    if (!b) return;
    mutate({ tags: b.tags.filter((t) => t.label !== label) });
  }

  function toggleStatus() {
    const b = noteRef.current;
    if (!b) return;
    mutate({ status: b.status === "done" ? "draft" : "done" });
  }

  function renameNote() {
    const b = noteRef.current;
    if (!b) return;
    const title = window.prompt("ノートのタイトル", b.title);
    if (title == null || title === b.title) return;
    mutate({ title });
  }

  async function removeNote() {
    if (isDraft) return router.push("/notes");
    if (!window.confirm("このノートを削除しますか？")) return;
    await api.deleteNote(idRef.current as string);
    router.push("/notes");
  }

  if (notFound) return <div className="p-8 text-text/50">ノートが見つかりません。</div>;
  if (!note) return <Loading label="ノートを開いています" />;

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_260px]">
      <main className="flex flex-col gap-4 p-[28px_44px_34px]">
        <div className="flex items-center gap-[10px] text-[12px] text-text/45">
          <Icon name="notebook" />
          ノート
          <Icon name="caret-right" size={11} />
          <span className="text-text">{note.title}</span>
          <div className="ml-auto flex items-center gap-[7px]">
            <span className="flex items-center gap-[5px] text-[11px]">
              {saving && <Spinner className="size-[11px] text-accent" />}
              {saving ? "保存中…" : note.updatedLabel}
            </span>
            <button onClick={renameNote} className="btn btn-ghost px-[9px] py-[5px] text-[12px]">
              <Icon name="pencil-simple" /> 改名
            </button>
            <button
              onClick={removeNote}
              className="btn btn-ghost px-[9px] py-[5px] text-[12px] text-text/45"
            >
              <Icon name="trash" /> {isDraft ? "破棄" : "削除"}
            </button>
            {!isDraft && (
              <Link
                href={`/export?noteId=${note.id}`}
                className="btn btn-secondary px-[9px] py-[5px] text-[12px]"
              >
                <Icon name="export" /> 書き出す
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-[10px]">
          <h2 className="tracking-[-0.025em]">{note.title}</h2>
          <button
            onClick={toggleStatus}
            className={`tag ${note.status === "done" ? "tag-accent" : "tag-outline"}`}
            title="下書き / 完了 を切り替え"
          >
            <Icon name={note.status === "done" ? "check-circle" : "circle-dashed"} size={12} />
            {note.status === "done" ? "完了" : "下書き"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-[6px]">
          {note.tags.map((t) => (
            <button
              key={t.label}
              onClick={() => removeTag(t.label)}
              className={`tag ${t.tone === "accent" ? "tag-accent" : t.tone === "outline" ? "tag-outline" : "tag-neutral"} hover:line-through`}
              title="タグを外す"
            >
              {t.label}
              <Icon name="x" size={10} className="ml-[4px] opacity-60" />
            </button>
          ))}
          <button onClick={addTag} className="tag tag-outline text-text/60">
            <Icon name="plus" size={10} className="mr-[3px]" /> タグ
          </button>
          <label className="ml-auto flex items-center gap-[6px] text-[12px] text-text/55">
            <input
              type="checkbox"
              checked={showInline}
              onChange={(e) => setShowInline(e.target.checked)}
            />
            AIの提案を本文に表示
          </label>
        </div>

        <div className="flex max-w-[66ch] flex-col gap-[15px] text-[15px] leading-[1.85]">
          {note.blocks.map((b, i) => (
            <Block
              key={i}
              block={b}
              show={showInline}
              onAccept={() => act(i, "accept")}
              onDismiss={() => act(i, "dismiss")}
              onEditText={(text) => editBlockText(i, text)}
              onDelete={() => deleteBlock(i)}
            />
          ))}

          <CiteBox
            value={draft}
            onChange={setDraft}
            onSubmit={addParagraph}
            onCite={cite}
            placeholder="つづきを書く…  @ でURLを引用、Enter で段落を追加"
          />
        </div>
      </main>

      <aside className="flex flex-col gap-[18px] bg-neutral-900 p-[18px_16px]">
        <Panel title="このノートの状態">
          {note.flags.length === 0 && (
            <div className="text-[12px] text-text/40">特にありません</div>
          )}
          {note.flags.map((f) => (
            <div key={f.text} className="flex items-center gap-2 text-[12.5px] opacity-90">
              <Icon
                name={f.icon}
                size={15}
                className={
                  f.tone === "accent"
                    ? "text-accent"
                    : f.tone === "accent-400"
                      ? "text-accent-400"
                      : "text-neutral-600"
                }
              />
              {f.text}
            </div>
          ))}
        </Panel>

        <Panel title="このノートの出典">
          {note.sources.length === 0 && (
            <div className="text-[12px] text-text/40">まだありません</div>
          )}
          {note.sources.map((s) => (
            <div
              key={s.n}
              className={`flex gap-[7px] text-[12px] leading-[1.45] ${
                s.cited ? "opacity-75" : "opacity-50"
              }`}
            >
              <span className={s.cited ? "text-accent" : ""}>{s.n}</span>
              {s.label}
            </div>
          ))}
        </Panel>

        {note.links.length > 0 && (
          <Panel title="つながるノート">
            {note.links.map((l) => (
              <Link
                key={l.noteId}
                href={`/notes/${l.noteId}`}
                className="flex flex-col gap-[3px] rounded-lg bg-surface p-[10px] no-underline shadow-[0_0_0_1px_var(--color-neutral-900)]"
              >
                <span className="text-[12.5px] font-medium text-text">{l.title}</span>
                <span className="text-[11px] opacity-60">{l.reason}</span>
              </Link>
            ))}
          </Panel>
        )}

        <div className="mt-auto flex flex-col gap-2 rounded-[9px] bg-accent/[0.07] p-3 shadow-[0_0_0_1px_var(--color-accent-800)]">
          <div className="text-[12px] leading-[1.6]">
            {isDraft
              ? "書き始めると保存されます"
              : `${note.blocks.filter((b) => b.type === "p").length}段落 · ${note.sources.length}出典`}
          </div>
          {!isDraft && (
            <Link
              href={`/export?noteId=${note.id}`}
              className="btn btn-primary self-start px-[9px] py-[5px] text-[12px]"
            >
              <Icon name="article" /> 下書きを起こす
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] uppercase tracking-[0.09em] text-text/40">{title}</div>
      {children}
    </div>
  );
}

function DeleteHandle({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      title="このブロックを削除"
      className="absolute right-1 top-1 hidden rounded-md bg-neutral-900/90 p-[5px] text-text/45 shadow-[0_0_0_1px_var(--color-neutral-800)] hover:text-text group-hover:block"
    >
      <Icon name="trash" size={13} />
    </button>
  );
}

function Block({
  block,
  show,
  onAccept,
  onDismiss,
  onEditText,
  onDelete,
}: {
  block: NoteBlock;
  show: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  onEditText: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = () => {
    setValue(block.type === "p" ? block.text : "");
    setEditing(true);
  };

  // Grow the textarea to fit its content so it reads as inline text, not a box.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    if (editing) taRef.current?.focus();
  }, [editing]);

  if (block.type === "p") {
    if (editing) {
      return (
        <textarea
          ref={taRef}
          rows={1}
          className="m-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[15px] leading-[1.85] text-text opacity-90 caret-accent outline-none focus:outline-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onEditText(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      );
    }
    return (
      // biome-ignore lint/a11y/useSemanticElements: click-to-edit text region; a real <button> can't wrap the <sup>/delete-handle button
      <div
        className="group relative m-0 cursor-text rounded opacity-90 outline-none hover:bg-white/[0.02] focus-visible:bg-white/[0.04]"
        role="button"
        tabIndex={0}
        title="クリックで編集"
        onClick={startEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEdit();
          }
        }}
      >
        <DeleteHandle onDelete={onDelete} />
        {block.text}
        {block.refs && <sup className="ml-[2px] text-[11px] text-accent">{block.refs}</sup>}
      </div>
    );
  }

  if (block.type === "quote")
    return (
      <figure className="group relative m-0 flex flex-col gap-[7px] rounded-lg bg-surface px-4 py-[14px] shadow-[0_0_0_1px_var(--color-neutral-900)]">
        <DeleteHandle onDelete={onDelete} />
        <blockquote className="m-0 text-[14.5px] leading-[1.7] opacity-90">{block.text}</blockquote>
        <figcaption className="m-0 flex items-center gap-[7px] text-[12px]">
          <Icon name="quotes" size={13} className="text-accent" />
          {block.cite}
          {block.note && <span className="opacity-55">{block.note}</span>}
        </figcaption>
      </figure>
    );

  if (block.type === "highlight")
    return (
      <p className="group relative m-0">
        <DeleteHandle onDelete={onDelete} />
        <span className="opacity-90">{block.before}</span>
        <span className="bg-accent/[0.16] px-[2px] py-px shadow-[0_1px_0_var(--color-accent)]">
          {block.mark}
        </span>
        <span className="opacity-90">{block.after}</span>
      </p>
    );

  // suggestion
  if (!show) return null;
  return (
    <div className="flex flex-col gap-[10px] rounded-lg bg-accent/[0.07] px-4 py-[15px] shadow-[0_0_0_1px_var(--color-accent-800)]">
      <div className="flex items-center gap-[7px] text-[10px] uppercase tracking-[0.09em] text-accent">
        <Icon name="sparkle" size={13} />
        {block.kind}
      </div>
      <p className="m-0 text-[14.5px] leading-[1.8] opacity-70">
        {block.text}
        {block.ref && <sup className="ml-[2px] text-[11px]">{block.ref}</sup>}
      </p>
      <div className="flex items-center gap-[7px]">
        <Button variant="primary" className="text-[13px]" onClick={onAccept}>
          <Icon name="arrow-down-left" /> 本文に採る
        </Button>
        <button className="btn btn-ghost ml-auto text-[13px] text-text/45" onClick={onDismiss}>
          消す
        </button>
      </div>
    </div>
  );
}
