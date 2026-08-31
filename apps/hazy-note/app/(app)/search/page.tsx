"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/loading";
import { Seg } from "@/components/ui";
import { api } from "@/lib/api";
import {
  buildCorpus,
  docBlob,
  rankBySimilarity,
  type SearchDoc,
  tagCloud,
  tagSearch,
  textSearch,
} from "@/lib/search";
import type { SearchHit, SearchMode } from "@/lib/types";

const KIND_ICON: Record<string, string> = {
  note: "note",
  article: "globe",
  pdf: "file-pdf",
  video: "play-circle",
  thread: "chats",
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  sources?: SearchHit[];
  llm?: boolean;
};

export default function SearchPage() {
  const [mode, setMode] = useState<SearchMode>("text");
  const [q, setQ] = useState("");
  const [corpus, setCorpus] = useState<SearchDoc[]>([]);
  const [loadingCorpus, setLoadingCorpus] = useState(true);

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [chatBusy, setChatBusy] = useState(false);

  // @ternlight/base/web — lazily loaded + wasm-initialised once; corpus
  // embeddings memoised across searches.
  const embedRef = useRef<((t: string) => Float32Array) | null>(null);
  const vecRef = useRef<Map<string, Float32Array>>(new Map());

  useEffect(() => {
    Promise.all([api.notes().catch(() => []), api.items().catch(() => [])])
      .then(([notes, items]) => setCorpus(buildCorpus(notes, items)))
      .finally(() => setLoadingCorpus(false));
  }, []);

  // ── text / tag: instant, client-side ──
  useEffect(() => {
    if (mode === "ai" || mode === "chat") return;
    const term = q.trim();
    if (!term) return setHits([]);
    const id = setTimeout(() => {
      setHits(mode === "tag" ? tagSearch(corpus, term) : textSearch(corpus, term));
    }, 150);
    return () => clearTimeout(id);
  }, [q, mode, corpus]);

  const runAiSearch = useCallback(async () => {
    const term = q.trim();
    if (!term || corpus.length === 0) return;
    setAiBusy(true);
    setAiError(null);
    try {
      let embed = embedRef.current;
      if (!embed) {
        const mod = await import("@ternlight/base/web");
        await mod.default();
        embed = embedRef.current = mod.embed;
      }
      const cache = vecRef.current;
      for (const doc of corpus) {
        if (!cache.has(doc.id)) cache.set(doc.id, embed(docBlob(doc).slice(0, 2000)));
      }
      const qv = embed(term);
      // ternlight vectors are L2-normalised → cosine similarity is the dot product.
      const sims = corpus.map((d) => {
        const dv = cache.get(d.id) as Float32Array;
        let s = 0;
        for (let i = 0; i < qv.length; i++) s += qv[i] * dv[i];
        return s;
      });
      setHits(rankBySimilarity(corpus, sims));
    } catch (e) {
      setAiError(`AI検索エンジンを読み込めませんでした（${(e as Error).message}）`);
      setHits(textSearch(corpus, term));
    } finally {
      setAiBusy(false);
    }
  }, [q, corpus]);

  const runChat = useCallback(async () => {
    const term = q.trim();
    if (!term || chatBusy) return;
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: term }]);
    setQ("");
    setChatBusy(true);
    try {
      const res = await api.searchChat(term, history);
      setTurns((t) => [
        ...t,
        { role: "assistant", content: res.answer, sources: res.sources, llm: res.llm },
      ]);
    } catch {
      setTurns((t) => [
        ...t,
        { role: "assistant", content: "検索に失敗しました。もう一度お試しください。" },
      ]);
    } finally {
      setChatBusy(false);
    }
  }, [q, turns, chatBusy]);

  const tags = useMemo(() => tagCloud(corpus), [corpus]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "ai") runAiSearch();
    else if (mode === "chat") runChat();
  }

  const placeholder =
    mode === "tag"
      ? "タグ名（例: typescript）"
      : mode === "chat"
        ? "自分の記録に質問する…"
        : mode === "ai"
          ? "意味で検索（例: 分散システムの一貫性）"
          : "キーワード検索…";

  return (
    <main className="mx-auto flex min-h-[640px] w-full max-w-[760px] flex-col gap-4 p-4 pb-10 sm:p-[28px_28px_40px]">
      <div>
        <div className="mb-[5px] text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">検索</div>
        <h3 className="tracking-[-0.02em]">ノートと出典をまとめて探す</h3>
      </div>

      <Seg
        name="searchmode"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setHits([]);
          setAiError(null);
        }}
        options={[
          { value: "text", label: "文字列" },
          { value: "tag", label: "タグ" },
          { value: "ai", label: "AI検索" },
          { value: "chat", label: "チャット" },
        ]}
      />

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          className="input flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
        />
        {(mode === "ai" || mode === "chat") && (
          <button
            type="submit"
            className="btn btn-primary text-[13px]"
            disabled={aiBusy || chatBusy || !q.trim()}
          >
            {aiBusy || chatBusy ? <Spinner className="size-4" /> : <Icon name="magnifying-glass" />}
            {mode === "chat" ? "質問" : "検索"}
          </button>
        )}
      </form>

      {loadingCorpus && (
        <div className="flex items-center gap-2 text-[13px] text-text/45">
          <Spinner className="size-3.5 text-accent" /> 読み込み中…
        </div>
      )}

      {mode === "tag" && !q.trim() && tags.length > 0 && (
        <div className="flex flex-wrap gap-[6px]">
          {tags.map((t) => (
            <button
              key={t.tag}
              type="button"
              onClick={() => setQ(t.tag)}
              className="rounded-full bg-accent/[0.1] px-[10px] py-[4px] text-[12px] text-accent-200 hover:bg-accent/[0.18]"
            >
              {t.tag} · {t.count}
            </button>
          ))}
        </div>
      )}

      {aiError && (
        <div className="rounded-lg bg-surface px-[13px] py-[9px] text-[12px] text-text/60 shadow-[0_0_0_1px_var(--color-neutral-900)]">
          {aiError}
        </div>
      )}
      {mode === "ai" && !aiBusy && (
        <p className="text-[11.5px] leading-[1.6] text-text/40">
          端末内の軽量モデル（@ternlight/base）で意味の近い記録を並べます。初回は数MBの読み込みがあります。
        </p>
      )}

      {/* ── text / tag / ai results ── */}
      {mode !== "chat" && hits.length > 0 && (
        <ul className="flex flex-col gap-[8px]">
          {hits.map((h) => (
            <HitRow key={`${h.kind}-${h.id}`} hit={h} />
          ))}
        </ul>
      )}
      {mode !== "chat" && !loadingCorpus && q.trim() && !aiBusy && hits.length === 0 && (
        <p className="text-[13px] text-text/45">一致する記録はありませんでした。</p>
      )}

      {/* ── chat transcript ── */}
      {mode === "chat" && (
        <div className="flex flex-col gap-[14px]">
          {turns.length === 0 && !chatBusy && (
            <p className="text-[13px] leading-[1.8] text-text/45">
              保存したノートと記事だけを資料に、質問へ答えます。
              <br />
              例: 「Turborepo について自分は何をメモした?」
            </p>
          )}
          {turns.map((t, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only transcript
              key={i}
              className={
                t.role === "user"
                  ? "self-end rounded-[12px] bg-accent/[0.14] px-[13px] py-[9px] text-[13.5px] leading-[1.7]"
                  : "flex flex-col gap-[9px] rounded-[12px] bg-surface px-[14px] py-[11px] shadow-[0_0_0_1px_var(--color-neutral-900)]"
              }
            >
              <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-[1.8] opacity-90">
                {t.content}
              </p>
              {t.role === "assistant" && t.sources && t.sources.length > 0 && (
                <div className="flex flex-col gap-[5px] border-t border-white/[0.06] pt-[8px]">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-text/35">
                    参照した記録
                  </div>
                  {t.sources.map((s) => (
                    <HitRow key={`${s.kind}-${s.id}`} hit={s} compact />
                  ))}
                </div>
              )}
              {t.role === "assistant" && t.llm === false && (
                <span className="text-[10.5px] text-text/35">
                  AI 未設定 — キーワード一致の結果です
                </span>
              )}
            </div>
          ))}
          {chatBusy && (
            <div className="flex items-center gap-2 text-[13px] text-text/45">
              <Spinner className="size-3.5 text-accent" /> 調べています…
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function HitRow({ hit, compact = false }: { hit: SearchHit; compact?: boolean }) {
  const inner = (
    <>
      <div className="flex items-center gap-[8px]">
        <Icon
          name={KIND_ICON[hit.kind] ?? "globe"}
          size={compact ? 13 : 15}
          className="shrink-0 text-text/45"
        />
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-text/90">{hit.title}</span>
        {hit.external && <Icon name="arrow-up-right" size={12} className="shrink-0 text-text/35" />}
        {hit.score !== undefined && (
          <span className="shrink-0 text-[10px] text-text/35">{Math.round(hit.score * 100)}%</span>
        )}
      </div>
      {!compact && (
        <p className="m-0 line-clamp-2 text-[12px] leading-[1.6] text-text/50">{hit.snippet}</p>
      )}
    </>
  );
  const cls = `flex flex-col gap-[4px] rounded-lg ${
    compact
      ? "px-0 py-0"
      : "bg-surface px-[13px] py-[10px] shadow-[0_0_0_1px_var(--color-neutral-900)] hover:bg-white/[0.02]"
  }`;
  return hit.external ? (
    <a href={hit.href} target="_blank" rel="noreferrer" className={`${cls} no-underline`}>
      {inner}
    </a>
  ) : (
    <Link href={hit.href} className={`${cls} no-underline`}>
      {inner}
    </Link>
  );
}
