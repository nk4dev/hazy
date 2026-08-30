"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { Button, Seg } from "@/components/ui";
import { api } from "@/lib/api";
import type { Item, Project } from "@/lib/types";

type Step = "empty" | "reading" | "propose" | "saved";

export function CaptureClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id");

  const [step, setStep] = useState<Step>(id ? "reading" : "empty");
  const [item, setItem] = useState<Item | null>(null);
  const [source, setSource] = useState<"url" | "hazy">(sp.get("from") === "hazy" ? "hazy" : "url");
  const [url, setUrl] = useState("");
  const [importable, setImportable] = useState<Item[] | null>(null);
  const [chosenTags, setChosenTags] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const target = projects.find((p) => p.id === projectId)?.name ?? "未整理のまま";

  // Load the destination projects; default to the accent one, else the first.
  useEffect(() => {
    let alive = true;
    api.projects().then((ps) => {
      if (!alive) return;
      setProjects(ps);
      setProjectId((ps.find((p) => p.tone === "accent") ?? ps[0])?.id ?? "");
    });
    return () => {
      alive = false;
    };
  }, []);

  // Step 1 → 2: fetch the item, run the "読み取り" (fetch + extract + AI), advance.
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setStep("reading");
    api.item(id).then((it) => alive && setItem(it));
    (async () => {
      const done = await api.finishReading(id).catch(() => null);
      if (!alive) return;
      if (done) {
        setItem(done);
        setChosenTags(done.suggestedTags.slice(0, 2));
        setStep("propose");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // Load the user's hazy-saved URLs the first time the "Hazyから追加" tab opens.
  useEffect(() => {
    if (source !== "hazy" || importable) return;
    let alive = true;
    api.importable().then((its) => alive && setImportable(its));
    return () => {
      alive = false;
    };
  }, [source, importable]);

  async function start() {
    if (source === "hazy") return; // picking a row navigates directly
    if (!url.trim()) return;
    const it = await api.addItem(url.trim());
    router.push(`/capture?id=${it.id}`);
  }

  function pickFromHazy(itemId: string) {
    router.push(`/capture?id=${itemId}`);
  }

  async function save() {
    if (!item) return;
    const updated = await api.updateItem(item.id, {
      projectId: projectId || null,
      tags: chosenTags,
    });
    setItem(updated);
    setStep("saved");
  }

  function toggleTag(t: string) {
    setChosenTags((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]));
  }

  return (
    <main className="flex flex-col items-center gap-6 p-[40px_30px]">
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
                  onKeyDown={(e) => e.key === "Enter" && start()}
                />
                <Button variant="primary" className="mt-auto" onClick={start}>
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
              <div className="text-[14px] font-medium">霧を晴らしています</div>
              <div className="text-[12px] text-text/50">
                {item?.kind === "note" ? "メモを読み解いています" : "本文 4,200語を読み込みました"}
              </div>
            </div>
            <div className="flex flex-col gap-[7px]">
              <div className="skel h-[9px]" />
              <div className="skel h-[9px] w-[82%]" />
              <div className="skel h-[9px] w-[57%]" />
            </div>
            <Link href="/library" className="btn btn-ghost mt-auto self-center text-[12px]">
              あとで読む（要約だけ待つ）
            </Link>
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
              <Button variant="primary" className="flex-1" onClick={save}>
                <Icon name="check" /> これで保存
              </Button>
              <Button
                onClick={() => {
                  setStep("reading");
                  setTimeout(() => setStep("propose"), 1600);
                }}
              >
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
                {item.summary.map((s, i) => (
                  <div key={i}>・{s}</div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-surface px-[11px] py-[10px] text-[12.5px] leading-[1.6] opacity-60 shadow-[0_0_0_1px_var(--color-neutral-900)]">
                本文を読み取れませんでした。あとで開いて手で整理できます。
              </div>
            )}
            <div className="mt-auto flex flex-col gap-[7px]">
              <Link href="/library" className="btn btn-primary btn-block">
                <Icon name="tray" /> 受信箱で見る
              </Link>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => {
                  setStep("empty");
                  setUrl("");
                  setImportable(null);
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
