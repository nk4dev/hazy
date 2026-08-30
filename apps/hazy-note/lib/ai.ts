// Task-shaped wrappers over lib/llm. Each function asks the model for strict
// JSON and, if the key is missing or the call fails, returns a deterministic
// stand-in built from the same input so the app never hard-fails on AI.

import { chatJSON, LLMError, llmConfigured } from "./llm";
import type { CompareAxis, ExportDraft, ExportFormat, GraphEdge } from "./types";

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

// ── Compare board synthesis ──────────────────────────────────
export type CompareSynthesis = {
  axes: CompareAxis[];
  summary: string;
  candidateAxes: string[];
};

export async function synthesiseCompare(
  sources: { title: string; summary: string[] }[]
): Promise<CompareSynthesis> {
  const names = sources.map((s) => s.title);
  if (!llmConfigured() || sources.length < 2) {
    return {
      axes: [{ name: "主題", values: sources.map((s) => s.summary[0] ?? null), accentCols: [] }],
      summary: llmConfigured()
        ? "比較には2本以上の出典が必要です。"
        : "差分の自動抽出には OPENROUTER_API_KEY が必要です。",
      candidateAxes: [],
    };
  }
  try {
    const out = await chatJSON<CompareSynthesis>([
      {
        role: "system",
        content:
          "複数の出典を表で比較する。返答は JSON のみ: " +
          '{"axes":[{"name":string,"values":(string|null)[],"accentCols":number[]}],' +
          '"summary":string,"candidateAxes":string[]}. ' +
          "values は sources と同じ順・同じ長さ。触れていない出典は null。" +
          "accentCols は出典どうしが食い違う列の index。axes は3〜5個。summary は分岐の理由を1〜2文で。",
      },
      {
        role: "user",
        content: JSON.stringify(
          { sources: sources.map((s, i) => ({ i, title: s.title, summary: s.summary })) },
          null,
          1
        ),
      },
    ]);
    const axes = (Array.isArray(out.axes) ? out.axes : [])
      .filter((a) => a?.name)
      .map((a) => ({
        name: a.name,
        values: names.map((_, i) => a.values?.[i] ?? null),
        accentCols: (Array.isArray(a.accentCols) ? a.accentCols : []).filter(
          (c) => typeof c === "number" && c >= 0 && c < names.length
        ),
      }));
    return {
      axes: axes.length
        ? axes
        : [{ name: "主題", values: sources.map((s) => s.summary[0] ?? null), accentCols: [] }],
      summary: out.summary ?? "",
      candidateAxes: arr(out.candidateAxes).slice(0, 4),
    };
  } catch (e) {
    if (!(e instanceof LLMError)) throw e;
    return {
      axes: [{ name: "主題", values: sources.map((s) => s.summary[0] ?? null), accentCols: [] }],
      summary: "差分のまとめに失敗しました（AI応答なし）。",
      candidateAxes: [],
    };
  }
}

// ── Graph: hypothesis connections ────────────────────────────
export async function suggestConnections(
  nodes: { id: string; label: string; text: string }[]
): Promise<Pick<GraphEdge, "from" | "to" | "reason">[]> {
  if (!llmConfigured() || nodes.length < 2) return [];
  try {
    const out = await chatJSON<{
      edges: { from: string; to: string; reason: string }[];
    }>([
      {
        role: "system",
        content:
          "ノートとソースの一覧から、まだ明示的に結ばれていない関連を推測する。" +
          '返答は JSON のみ: {"edges":[{"from":id,"to":id,"reason":string}]}. ' +
          "id は与えたものだけ。reason は日本語1文。多くても5本。",
      },
      {
        role: "user",
        content: JSON.stringify(
          nodes.map((n) => ({ id: n.id, label: n.label, text: n.text.slice(0, 400) })),
          null,
          1
        ),
      },
    ]);
    const ids = new Set(nodes.map((n) => n.id));
    return (Array.isArray(out.edges) ? out.edges : [])
      .filter((e) => e && ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
      .slice(0, 5);
  } catch (e) {
    if (!(e instanceof LLMError)) throw e;
    return [];
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
