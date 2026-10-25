// Task-shaped wrappers over lib/llm. Each function asks the model for strict
// JSON and, if the key is missing or the call fails, returns a deterministic
// stand-in built from the same input so the app never hard-fails on AI.

import { chat, chatJSON, LLMError, llmConfigured } from "./llm";
import type {
  ExportDraft,
  ExportFormat,
  InsightProfile,
  InsightStats,
  InsightTheme,
} from "./types";

/** Coerce a model's field to a clean string[] no matter what it actually sent. */
function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[。．.!?！？])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

// ── Source / memo summary ────────────────────────────────────
export type SourceDigest = {
  title?: string;
  summary: string[];
  points: string[];
  suggestedTags: string[];
};

function fallbackDigest(text: string): SourceDigest {
  const s = sentences(text);
  return {
    summary: s.slice(0, 3),
    points: s.slice(0, 2),
    suggestedTags: [],
  };
}

export async function summariseSource(input: {
  title?: string;
  text: string;
  kind: string;
}): Promise<SourceDigest> {
  const body = input.text.trim();
  if (!llmConfigured() || body.length < 40) return fallbackDigest(body);
  try {
    const out = await chatJSON<SourceDigest>([
      {
        role: "system",
        content:
          "あなたは読書メモの補助。与えられた本文を日本語で要約する。返答は JSON のみ: " +
          '{"title": string, "summary": string[3], "points": string[1..3], "suggestedTags": string[2..5]}. ' +
          "summary は各40字以内の要点。points は本文の主張。suggestedTags は短い名詞句。",
      },
      {
        role: "user",
        content: `種別: ${input.kind}\nタイトル: ${input.title ?? "(不明)"}\n\n本文:\n${body.slice(0, 8000)}`,
      },
    ]);
    return {
      title: typeof out.title === "string" ? out.title : input.title,
      summary: arr(out.summary).slice(0, 3),
      points: arr(out.points).slice(0, 3),
      suggestedTags: arr(out.suggestedTags).slice(0, 5),
    };
  } catch (e) {
    if (!(e instanceof LLMError)) throw e;
    return { ...fallbackDigest(body), title: input.title };
  }
}

export async function summariseMemo(text: string): Promise<SourceDigest> {
  const body = text.trim();
  if (!llmConfigured() || body.length < 30) {
    const s = sentences(body);
    return {
      summary: s.length ? s.slice(0, 3) : ["（本文なし）"],
      points: s.slice(0, 2),
      suggestedTags: [],
    };
  }
  try {
    const out = await chatJSON<SourceDigest>([
      {
        role: "system",
        content:
          "ユーザーが書き殴ったメモを整える。返答は JSON のみ: " +
          '{"summary": string[1..3], "points": string[1..2], "suggestedTags": string[1..4]}. ' +
          "元の意図を変えず、要点を短く言い直す。",
      },
      { role: "user", content: body.slice(0, 4000) },
    ]);
    return {
      summary: arr(out.summary).slice(0, 3),
      points: arr(out.points).slice(0, 2),
      suggestedTags: arr(out.suggestedTags).slice(0, 4),
    };
  } catch (e) {
    if (!(e instanceof LLMError)) throw e;
    const s = sentences(body);
    return { summary: s.slice(0, 3), points: s.slice(0, 2), suggestedTags: [] };
  }
}

// ── Tendency analysis (/analyze) ─────────────────────────────

export type TendencyRead = Pick<
  InsightProfile,
  "profile" | "themes" | "leanings" | "blindSpots" | "nextSteps"
>;

/** `llm: true` only when the model actually produced this read. */
export type TendencyResult = TendencyRead & { llm: boolean };

export type TendencyInput = {
  stats: InsightStats;
  noteExcerpts: { title: string; text: string }[];
  urlBlurbs: { title: string; domain: string; summary: string }[];
};

const clampWeight = (n: unknown): number => Math.min(5, Math.max(1, Math.round(Number(n) || 1)));

/** Coerce whatever the model sent for `themes` into clean InsightTheme[]. */
function themeArr(v: unknown): InsightTheme[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      return {
        label: String(o.label ?? "").trim(),
        weight: clampWeight(o.weight),
        note: String(o.note ?? "").trim(),
      };
    })
    .filter((t) => t.label);
}

/** Themes/profile straight from the aggregation — used with no key or on failure. */
export function fallbackTendencies(stats: InsightStats): TendencyRead {
  const maxTag = stats.topTags[0]?.count ?? 1;
  const themes: InsightTheme[] = stats.topTags.slice(0, 5).map((t) => ({
    label: t.label,
    weight: clampWeight(1 + Math.round((t.count / maxTag) * 4)),
    note: `タグ「${t.label}」が${t.count}件`,
  }));
  const topDomain = stats.topDomains[0]?.domain;
  const parts = [`ノート${stats.noteCount}本・出典${stats.urlCount}本。`];
  if (topDomain) parts.push(`主に ${topDomain} を読み、`);
  if (stats.topTags[0]) parts.push(`「${stats.topTags[0].label}」への関心が目立ちます。`);
  return {
    profile: parts.join("").replace(/、$/, "。"),
    themes,
    leanings: [],
    blindSpots: [],
    nextSteps: [],
  };
}

/**
 * Read the person's tendencies off their notes + saved URLs. The deterministic
 * `stats` always carry the numbers; the model adds the interpretive layer
 * (themes, leanings, blind spots, next steps). Falls back to `stats` alone.
 */
export async function analyseTendencies(input: TendencyInput): Promise<TendencyResult> {
  const { stats } = input;
  const thin = stats.noteCount + stats.urlCount < 3;
  if (!llmConfigured() || thin) return { ...fallbackTendencies(stats), llm: false };

  try {
    const out = await chatJSON<TendencyRead>([
      {
        role: "system",
        content:
          "読書メモと保存URLから、その人の関心・思考の傾向を推定する。" +
          "断定しすぎず、必ず本人の記録に基づく根拠を添える。憶測で属性を決めつけない。" +
          "返答は JSON のみ: " +
          '{"profile":string(2〜3文の人物像),' +
          '"themes":[{"label":string,"weight":1..5,"note":string(根拠1行)}](3〜6),' +
          '"leanings":string[](2〜4, 繰り返し出る立場・論調),' +
          '"blindSpots":string[](2〜4, 逆に触れていない観点),' +
          '"nextSteps":string[](2〜3, 次に深掘りしそう／補うと良い観点)}. ' +
          "すべて日本語。",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            stats,
            notes: input.noteExcerpts.slice(0, 20).map((n) => ({
              title: n.title,
              text: n.text.slice(0, 600),
            })),
            urls: input.urlBlurbs.slice(0, 30).map((u) => ({
              title: u.title,
              domain: u.domain,
              summary: u.summary.slice(0, 200),
            })),
          },
          null,
          1
        ),
      },
    ]);
    const themes = themeArr(out.themes).slice(0, 6);
    return {
      profile: String(out.profile ?? "").trim() || fallbackTendencies(stats).profile,
      themes: themes.length ? themes : fallbackTendencies(stats).themes,
      leanings: arr(out.leanings).slice(0, 4),
      blindSpots: arr(out.blindSpots).slice(0, 4),
      nextSteps: arr(out.nextSteps).slice(0, 3),
      llm: true,
    };
  } catch (e) {
    if (!(e instanceof LLMError)) throw e;
    return { ...fallbackTendencies(stats), llm: false };
  }
}

// ── Search chat (/search のチャットモード) ───────────────────

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type SearchChatResult = {
  answer: string;
  /** 1-based indexes into `candidates` that the answer actually leaned on. */
  usedIndexes: number[];
  llm: boolean;
};

/**
 * Answer a natural-language question against the user's own notes + sources.
 * `candidates` is the already-retrieved shortlist (keyword-ranked upstream).
 * With no API key, returns a plain "here's what matched" stand-in.
 */
export async function answerSearchChat(input: {
  query: string;
  history?: ChatTurn[];
  candidates: { title: string; text: string }[];
}): Promise<SearchChatResult> {
  const cands = input.candidates.slice(0, 8);

  if (!llmConfigured() || cands.length === 0) {
    const answer = cands.length
      ? `「${input.query}」に関連しそうな記録が${cands.length}件見つかりました。下の候補を確認してください。`
      : `「${input.query}」に一致する記録は見つかりませんでした。`;
    return { answer, usedIndexes: cands.map((_, i) => i + 1), llm: false };
  }

  const context = cands
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.text.slice(0, 700)}`)
    .join("\n\n");

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            "あなたはユーザー自身のノートと保存記事だけを資料に答えるアシスタント。" +
            "資料にない事実は足さない。参照した資料は文末で [1] [2] のように番号で示す。" +
            "日本語で、3〜6文程度で簡潔に。",
        },
        ...(input.history ?? []).slice(-6),
        { role: "user", content: `資料:\n${context}\n\n質問: ${input.query}` },
      ],
      { temperature: 0.3, maxTokens: 700 }
    );
    const used = [...raw.matchAll(/\[(\d{1,2})\]/g)]
      .map((m) => Number(m[1]))
      .filter((n) => n >= 1 && n <= cands.length);
    return {
      answer: raw,
      usedIndexes: [...new Set(used)].sort((a, b) => a - b),
      llm: true,
    };
  } catch (e) {
    if (!(e instanceof LLMError)) throw e;
    return {
      answer: `AIの応答を取得できませんでした。「${input.query}」に関連する候補を下に表示します。`,
      usedIndexes: cands.map((_, i) => i + 1),
      llm: false,
    };
  }
}

// ── Export draft ─────────────────────────────────────────────
export async function rewriteForExport(input: {
  title: string;
  /** The note body, already flattened to Markdown (see lib/note-delta.ts). */
  markdown: string;
  format: ExportFormat;
}): Promise<Pick<ExportDraft, "title" | "blocks" | "provenance" | "warning">> {
  const plain = input.markdown.trim();

  const passthrough = {
    title: input.title,
    blocks: plain
      .split(/\n{2,}/)
      .map((para) => para.replace(/^\s*(#{1,6}|>|[-*]|\d+\.)\s+/, "").trim())
      .filter(Boolean)
      .map((text) => ({ type: "p" as const, text })),
    provenance: [
      { heading: "全体", from: `ノート「${input.title}」から`, tone: "accent" as const },
    ],
    warning: undefined,
  };
  if (!llmConfigured() || !plain) return passthrough;

  const shape =
    input.format === "bullets"
      ? "箇条書き。blocks は {type:'h4'} 見出し1つと {type:'p'} 各項目（先頭に・）。"
      : input.format === "memo"
        ? "社内共有メモ。900字程度。blocks は {type:'p'} と {type:'h4'} の混在。"
        : "ブログ記事。1500〜2000字。blocks は {type:'p'} と {type:'h4'} の混在。";
  try {
    const out = await chatJSON<Pick<ExportDraft, "title" | "blocks" | "provenance" | "warning">>([
      {
        role: "system",
        content:
          `ノートを${input.format}形式に書き直す。${shape} ` +
          '返答は JSON のみ: {"title":string,"blocks":[{"type":"p"|"h4","text":string}],' +
          '"provenance":[{"heading":string,"from":string,"tone":"accent"|"muted"}],"warning":string|null}. ' +
          "事実を足さない。未確定部分は tone:'muted' で警告する。",
      },
      { role: "user", content: `現タイトル: ${input.title}\n\n本文:\n${plain.slice(0, 8000)}` },
    ]);
    const blocks = (Array.isArray(out.blocks) ? out.blocks : []).filter(
      (b) => b && (b.type === "p" || b.type === "h4") && b.text
    );
    return {
      title: out.title || input.title,
      blocks: blocks.length ? blocks : passthrough.blocks,
      provenance: (Array.isArray(out.provenance) ? out.provenance : passthrough.provenance).slice(
        0,
        4
      ),
      warning: out.warning || undefined,
    };
  } catch (e) {
    if (!(e instanceof LLMError)) throw e;
    return passthrough;
  }
}
