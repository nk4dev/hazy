import { useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Button, Seg } from "@/components/ui";
import {
  useAddNoteItemMutation,
  useFinishReadingNoteItemMutation,
  useNoteImportableItemsQuery,
  useNoteItemQuery,
  useNoteProjectsQuery,
  useUpdateNoteItemMutation,
} from "@/lib/hooks";
import { NoteLink, useNoteNavigate } from "@/lib/navigation";
import type { Item } from "@/lib/types";

type Step = "empty" | "reading" | "propose" | "saved";

export function CapturePage() {
  const router = useNoteNavigate();
  const searchStr = useLocation().searchStr;
  const { id, from } = useMemo(() => {
    const sp = new URLSearchParams(searchStr);
    return {
      id: sp.get("id"),
      from: sp.get("from"),
    };
  }, [searchStr]);

  const [step, setStep] = useState<Step>(id ? "reading" : "empty");
  const [item, setItem] = useState<Item | null>(null);
  const [source, setSource] = useState<"url" | "hazy">(from === "hazy" ? "hazy" : "url");
  const [url, setUrl] = useState("");
  const [chosenTags, setChosenTags] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [readError, setReadError] = useState<string | null>(null);

  const { data: projects = [] } = useNoteProjectsQuery();
  const { data: fetchedItem } = useNoteItemQuery(id ?? "");
  const { data: importableData, isPending: importablePending } = useNoteImportableItemsQuery(
    source === "hazy"
  );
  const addItem = useAddNoteItemMutation();
  const finishReading = useFinishReadingNoteItemMutation();
  const updateItem = useUpdateNoteItemMutation();
  const finishMutateRef = useRef(finishReading.mutateAsync);
  finishMutateRef.current = finishReading.mutateAsync;

  const target = projects.find((p) => p.id === projectId)?.name ?? "未整理のまま";

  useEffect(() => {
    if (from === "hazy") {
      setSource("hazy");
    }
  }, [from]);

  // Default destination project to the accent one, else the first once loaded.
  useEffect(() => {
    if (projects.length === 0) return;
    setProjectId((cur) => cur || (projects.find((p) => p.tone === "accent") ?? projects[0])?.id || "");
  }, [projects]);

  useEffect(() => {
    if (fetchedItem && id && fetchedItem.id === id) {
      setItem((cur) => cur ?? fetchedItem);
    }
  }, [fetchedItem, id]);

  // Step 1 → 2: run "読み取り" (fetch + extract + AI) when `?id=` changes.
  useEffect(() => {
    if (!id) {
      setStep("empty");
      setItem(null);
      setChosenTags([]);
      setReadError(null);
      return;
    }
    let alive = true;
    setStep("reading");
    setReadError(null);
    void finishMutateRef
      .current(id)
      .then((done) => {
        if (!alive) return;
        setItem(done);
        setChosenTags(done.suggestedTags.slice(0, 2));
        setStep("propose");
      })
      .catch(() => {
        if (!alive) return;
        setReadError("本文の読み取りに失敗しました。受信箱から再度お試しください。");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  async function start() {
    if (source === "hazy") return; // picking a row navigates directly
    if (!url.trim() || addItem.isPending) return;
    const it = await addItem.mutateAsync(url.trim());
    router.push(`/capture?id=${it.id}`);
  }

  function pickFromHazy(itemId: string) {
    router.push(`/capture?id=${itemId}`);
  }

  async function retryReading() {
    if (!item || finishReading.isPending) return;
    setStep("reading");
    setReadError(null);
    try {
      const done = await finishReading.mutateAsync(item.id);
      setItem(done);
      setChosenTags(done.suggestedTags.slice(0, 2));
      setStep("propose");
    } catch {
      setStep("propose");
    }
  }

  async function save() {
    if (!item || updateItem.isPending) return;
    const updated = await updateItem.mutateAsync({
      id: item.id,
      patch: {
        projectId: projectId || null,
        tags: chosenTags,
      },
    });
    setItem(updated);
    setStep("saved");
  }

  function toggleTag(t: string) {
    setChosenTags((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]));
  }

  const importable = importablePending ? null : (importableData ?? []);

  return (
    <main className="flex flex-col items-center gap-6 px-4 py-8 sm:p-[40px_30px]">
      <header className="w-full max-w-[440px]">
        <div className="mb-[5px] text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">
          取り込み
        </div>
        <h3 className="tracking-[-0.02em]">貼った直後の3コマ</h3>
        <Stepper step={step} />
      </header>

      <div className="w-full max-w-[440px] overflow-hidden rounded-[10px] bg-bg elev-md">
        {step === "empty" && (
          <div className="flex min-h-[300px] flex-col gap-4 p-6">
            <Seg
              name="capture-source"
              value={source}
              onChange={setSource}
              options={[
                { value: "url", label: "URL" },
                { value: "hazy", label: "Hazyから追加" },
              ]}
            />
            {source === "url" ? (
              <>
                <div className="flex items-center gap-[9px] text-[12px] text-text/55">
                  <Icon name="link" /> 取り込むURL
                </div>
                <input
                  className="input"
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void start()}
                />
                <Button
                  variant="primary"
                  className="mt-auto"
                  onClick={() => void start()}
                  disabled={addItem.isPending}
                >
                  <Icon name="arrow-right" /> 読み取って整理
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-[9px] text-[12px] text-text/55">
                  <Icon name="tray" /> Hazyに保存したURL
                </div>
                <HazyPicker items={importable} onPick={pickFromHazy} />
              </>
            )}
          </div>
        )}

        {step === "reading" && (
          <div className="flex min-h-[330px] flex-col gap-4 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(145,132,217,0.1),transparent_60%)] p-[22px]">
            <div className="flex items-center gap-[9px] text-[12px] text-text/55">
              <Icon name={item?.kind === "note" ? "note-pencil" : "link"} />{" "}
              {item?.kind === "note" ? "貼り付けたメモ" : (item?.url ?? "…")}
            </div>
            <div className="flex flex-col items-center gap-[14px] py-[26px]">
              <span className="pulse h-[52px] w-[52px] rounded-[17px] bg-[radial-gradient(circle_at_32%_26%,var(--color-accent-400),var(--color-accent-700))] shadow-[0_0_34px_rgba(145,132,217,0.55)]" />
              <div className="text-[14px] font-medium">
                {readError ? "読み取りに失敗しました" : "霧を晴らしています"}
              </div>
              <div className="text-[12px] text-text/50">
                {readError
                  ? readError
                  : item?.kind === "note"
                    ? "メモを読み解いています"
                    : "本文を読み込んで要約しています"}
              </div>
            </div>
            {!readError && (
              <div className="flex flex-col gap-[7px]">
                <div className="skel h-[9px]" />
                <div className="skel h-[9px] w-[82%]" />
                <div className="skel h-[9px] w-[57%]" />
              </div>
            )}
            <NoteLink href="/library" className="btn btn-ghost mt-auto self-center text-[12px]">
              あとで読む（要約だけ待つ）
            </NoteLink>
          </div>
        )}

        {step === "propose" && item && (
          <div className="flex min-h-[330px] flex-col gap-[13px] p-5">
            <div className="flex items-center gap-[9px] text-[12px] text-text/55">
              <Icon name={item.kind === "note" ? "note-pencil" : "globe"} /> {item.site}
              <span className="ml-auto text-accent">
                {item.kind === "note" ? "1.2秒" : "4.1秒"}
              </span>
            </div>
            <div className="text-[17px] font-medium leading-[1.35] tracking-[-0.01em]">
              {item.title}
            </div>
            <p className="m-0 text-[13px] leading-[1.7] opacity-80">{item.summary.join(" / ")}</p>
            <div className="flex flex-col gap-[6px] rounded-lg bg-accent/[0.08] p-[10px] shadow-[0_0_0_1px_var(--color-accent-800)]">
              <div className="text-[10px] uppercase tracking-[0.09em] text-accent">タグの提案</div>
              <div className="flex flex-wrap gap-[5px]">
                {item.suggestedTags.map((t) => {
                  const on = chosenTags.includes(t);
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`tag ${on ? "tag-accent" : "tag-outline"}`}
                    >
                      {t}
                      <Icon name={on ? "check" : "plus"} size={11} className="ml-[5px]" />
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-lg bg-surface px-[10px] py-[9px] text-[12.5px] shadow-[0_0_0_1px_var(--color-neutral-900)]">
              <Icon name="folder-open" size={15} className="text-accent" />
              置き場所
              <select
                className="input ml-auto w-auto py-[4px] text-[12px]"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">未整理のまま</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-auto flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => void save()}
                disabled={updateItem.isPending}
              >
                <Icon name="check" /> これで保存
              </Button>
              <Button onClick={() => void retryReading()} disabled={finishReading.isPending}>
                <Icon name="arrow-clockwise" />
              </Button>
            </div>
          </div>
        )}

        {step === "saved" && item && (
          <div className="flex min-h-[330px] flex-col gap-[13px] p-5">
            <div className="flex items-center gap-2 text-[13px] text-accent">
              <Icon name="check-circle" size={16} />
              {projectId ? `「${target}」に保存しました` : "受信箱に保存しました"}
            </div>
            <div className="text-[15px] font-medium leading-[1.4]">{item.title}</div>
            {item.summary.length > 0 ? (
              <div className="flex flex-col gap-[6px] rounded-lg bg-surface px-[11px] py-[10px] text-[12.5px] leading-[1.6] opacity-80 shadow-[0_0_0_1px_var(--color-neutral-900)]">
                {item.summary.map((s) => (
                  <div key={s}>・{s}</div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-surface px-[11px] py-[10px] text-[12.5px] leading-[1.6] opacity-60 shadow-[0_0_0_1px_var(--color-neutral-900)]">
                本文を読み取れませんでした。あとで開いて手で整理できます。
              </div>
            )}
            <div className="mt-auto flex flex-col gap-[7px]">
              <NoteLink href="/library" className="btn btn-primary btn-block">
                <Icon name="tray" /> 受信箱で見る
              </NoteLink>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => {
                  setStep("empty");
                  setUrl("");
                  setItem(null);
                  router.push("/capture");
                }}
              >
                <Icon name="plus" /> もう1件取り込む
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function HazyPicker({ items, onPick }: { items: Item[] | null; onPick: (id: string) => void }) {
  if (items === null) {
    return (
      <div className="flex flex-col gap-[7px] py-2">
        <div className="skel h-[38px]" />
        <div className="skel h-[38px]" />
        <div className="skel h-[38px]" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg bg-surface p-4 text-center text-[12px] leading-[1.7] text-text/55 shadow-[0_0_0_1px_var(--color-neutral-900)]">
        <Icon name="tray" size={18} className="text-text/40" />
        Hazyに保存したURLがありません。
      </div>
    );
  }
  return (
    <div className="-mx-1 flex max-h-[260px] flex-col gap-[6px] overflow-y-auto px-1">
      {items.map((it) => {
        const done = it.summary.length > 0 || it.projectId !== null;
        return (
          <button
            type="button"
            key={it.id}
            onClick={() => onPick(it.id)}
            className="group flex items-start gap-[10px] rounded-lg bg-surface px-[11px] py-[9px] text-left shadow-[0_0_0_1px_var(--color-neutral-900)] transition hover:shadow-[0_0_0_1px_var(--color-accent-800)]"
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
              size={15}
              className="mt-[2px] text-accent"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-[1.4]">
                {it.title}
              </span>
              <span className="block truncate text-[11px] text-text/50">
                {it.site} · {it.addedLabel}
                {done && <span className="ml-[6px] text-text/35">· 取込済み</span>}
              </span>
            </span>
            <Icon
              name="arrow-right"
              size={13}
              className="mt-[3px] text-text/30 transition group-hover:text-accent"
            />
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["reading", "propose", "saved"];
  const idx = order.indexOf(step === "empty" ? "reading" : step);
  const labels = ["読み取り", "要約とタグ", "置き場所"];
  return (
    <div className="mt-3 flex gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 flex-col gap-[6px]">
          <div className={`h-[3px] rounded-full ${i <= idx ? "bg-accent" : "bg-neutral-700"}`} />
          <div className={`text-[10px] ${i <= idx ? "text-text/70" : "text-text/35"}`}>{l}</div>
        </div>
      ))}
    </div>
  );
}
