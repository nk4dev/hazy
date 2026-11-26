import type { NoteDeltaOp, NoteSuggestionDTO } from "@/types/api";

export type { NoteDeltaOp };

type Attrs = Record<string, unknown>;

export function isDelta(v: unknown): v is NoteDeltaOp[] {
  return (
    Array.isArray(v) &&
    v.every(
      (op) =>
        op != null &&
        typeof op === "object" &&
        ("insert" in op || "retain" in op || "delete" in op)
    )
  );
}

/** Plain text of a Delta — every string insert concatenated, embeds dropped. */
export function deltaToPlainText(ops: NoteDeltaOp[] | undefined | null): string {
  if (!Array.isArray(ops)) return "";
  let out = "";
  for (const op of ops) {
    if (typeof op.insert === "string") out += op.insert;
  }
  return out;
}

function inlineMd(text: string, attrs: Attrs | undefined): string {
  if (!attrs) return text;
  let t = text;
  if (attrs.code) t = `\`${t}\``;
  if (attrs.bold) t = `**${t}**`;
  if (attrs.italic) t = `*${t}*`;
  if (typeof attrs.link === "string") t = `[${t}](${attrs.link})`;
  return t;
}

function linePrefix(attrs: Attrs | undefined, ordinal: number): string {
  if (!attrs) return "";
  if (attrs.header === 2 || attrs.header === "2") return "## ";
  if (attrs.header === 3 || attrs.header === "3") return "### ";
  if (attrs.header === 1 || attrs.header === "1") return "# ";
  if (attrs.blockquote) return "> ";
  if (attrs.list === "ordered") return `${ordinal}. `;
  if (attrs.list === "bullet") return "- ";
  return "";
}

/** Delta → Markdown, limited to the formats the toolbar offers. */
export function deltaToMarkdown(ops: NoteDeltaOp[] | undefined | null): string {
  if (!Array.isArray(ops)) return "";
  const lines: string[] = [];
  let buf = "";
  let ordinal = 1;

  for (const op of ops) {
    if (typeof op.insert !== "string") continue;
    const parts = op.insert.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        const attrs = op.attributes as Attrs | undefined;
        const isOrdered = attrs?.list === "ordered";
        lines.push(linePrefix(attrs, ordinal) + buf);
        ordinal = isOrdered ? ordinal + 1 : 1;
        buf = "";
      }
      if (parts[i]) buf += inlineMd(parts[i], op.attributes as Attrs | undefined);
    }
  }
  if (buf) lines.push(buf);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function textToOps(text: string, extra?: Attrs): NoteDeltaOp[] {
  const ops: NoteDeltaOp[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const i = m.index ?? 0;
    if (i > last) ops.push({ insert: text.slice(last, i), ...(extra && { attributes: extra }) });
    ops.push({ insert: m[1], attributes: { ...extra, link: m[2] } });
    last = i + m[0].length;
  }
  if (last < text.length)
    ops.push({ insert: text.slice(last), ...(extra && { attributes: extra }) });
  return ops;
}

type LegacyBlock =
  | { type: "p"; text: string; refs?: string }
  | { type: "quote"; text: string; cite: string; note?: string }
  | { type: "highlight"; before: string; mark: string; after: string }
  | { type: "suggestion"; kind: string; text: string; ref?: string };

/** One-time conversion of the old hand-rolled block model to a Quill Delta. */
export function legacyBlocksToDelta(blocks: unknown): {
  body: NoteDeltaOp[];
  suggestions: NoteSuggestionDTO[];
} {
  const body: NoteDeltaOp[] = [];
  const suggestions: NoteSuggestionDTO[] = [];
  if (!Array.isArray(blocks)) return { body, suggestions };

  for (const raw of blocks as LegacyBlock[]) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.type === "p") {
      body.push(...textToOps(raw.text ?? ""));
      if (raw.refs) body.push({ insert: ` [${raw.refs}]` });
      body.push({ insert: "\n" });
    } else if (raw.type === "quote") {
      body.push(...textToOps(raw.text ?? ""));
      body.push({ insert: "\n", attributes: { blockquote: true } });
      const caption = [raw.cite, raw.note].filter(Boolean).join(" · ");
      if (caption) body.push({ insert: `— ${caption}` }, { insert: "\n" });
    } else if (raw.type === "highlight") {
      if (raw.before) body.push({ insert: raw.before });
      if (raw.mark) body.push({ insert: raw.mark, attributes: { background: "#423a6a" } });
      if (raw.after) body.push({ insert: raw.after });
      body.push({ insert: "\n" });
    } else if (raw.type === "suggestion") {
      suggestions.push({
        id: crypto.randomUUID(),
        kind: raw.kind ?? "AIの提案",
        text: raw.text ?? "",
        ref: raw.ref,
      });
    }
  }

  return { body, suggestions };
}
