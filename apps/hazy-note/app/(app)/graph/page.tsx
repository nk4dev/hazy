"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { Loading } from "@/components/loading";
import { Seg } from "@/components/ui";
import { api } from "@/lib/api";
import type { GraphData } from "@/lib/types";

type ViewMode = "note" | "tag" | "source";

export default function GraphPage() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [mode, setMode] = useState<ViewMode>("note");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    api.graph().then((g) => {
      setGraph(g);
      setSelectedEdgeId(g.edges[1]?.id ?? g.edges[0]?.id ?? "");
    });
  }, []);

  async function rebuild() {
    setRebuilding(true);
    try {
      const g = await api.rebuildGraph();
      setGraph(g);
      setDismissed([]);
      setSelectedEdgeId(g.edges[0]?.id ?? "");
    } finally {
      setRebuilding(false);
    }
  }

  const visibleEdges = useMemo(
    () => (graph ? graph.edges.filter((e) => !dismissed.includes(e.id)) : []),
    [graph, dismissed]
  );

  if (!graph) return <Loading label="つながりを組み立てています" />;

  const nodeById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const selected = visibleEdges.find((e) => e.id === selectedEdgeId) ?? null;

  const nodeVisible = (kind: string) => (mode === "note" ? true : mode === kind || kind === "note");

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_300px]">
      <div className="relative bg-[radial-gradient(90%_70%_at_42%_45%,rgba(145,132,217,0.09),transparent_70%)]">
        <svg viewBox="0 0 900 600" className="block h-full w-full" role="img">
          <title>ノートと出典のつながり</title>
          {visibleEdges.map((e) => {
            const a = nodeById[e.from];
            const b = nodeById[e.to];
            if (!a || !b) return null;
            const on = e.id === selectedEdgeId;
            return (
              <line
                key={e.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={
                  e.kind === "citation" ? "var(--color-accent-700)" : "var(--color-neutral-600)"
                }
                strokeWidth={on ? 2.5 : 1}
                strokeDasharray={e.kind === "hypothesis" ? "3 5" : undefined}
                opacity={on ? 1 : 0.55}
                className="cursor-pointer"
                onClick={() => setSelectedEdgeId(e.id)}
              />
            );
          })}
          {graph.nodes.map((n) => {
            const dim = !nodeVisible(n.kind);
            return (
              <g
                key={n.id}
                opacity={dim ? 0.25 : 1}
                className="cursor-pointer"
                onClick={() => {
                  const edge = visibleEdges.find((e) => e.from === n.id || e.to === n.id);
                  if (edge) setSelectedEdgeId(edge.id);
                }}
              >
                {n.focus && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.r + 20}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth={1}
                    opacity={0.18}
                  />
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={n.focus ? "var(--color-accent-900)" : "var(--color-surface)"}
                  stroke={
                    n.focus
                      ? "var(--color-accent)"
                      : n.unreadLabel
                        ? "var(--color-neutral-800)"
                        : "var(--color-neutral-700)"
                  }
                  strokeWidth={n.focus ? 1.5 : 1}
                />
                {!n.unreadLabel && (
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    fill="var(--color-text)"
                    fontFamily="Inter, 'Noto Sans JP', sans-serif"
                    fontSize={n.focus ? 13 : 12}
                    fontWeight={n.focus ? 500 : 400}
                  >
                    {n.label}
                  </text>
                )}
                {n.unreadLabel && (
                  <text
                    x={n.x}
                    y={n.y + n.r + 17}
                    textAnchor="middle"
                    fill="var(--color-neutral-600)"
                    fontFamily="Inter, sans-serif"
                    fontSize={10}
                  >
                    {n.unreadLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div className="absolute left-5 top-5 flex items-center gap-2">
          <Seg
            name="graphview"
            value={mode}
            onChange={setMode}
            options={[
              { value: "note", label: "ノート" },
              { value: "tag", label: "タグ" },
              { value: "source", label: "出典" },
            ]}
          />
          <button className="btn btn-secondary text-[12px]" onClick={rebuild} disabled={rebuilding}>
            <Icon name="arrows-clockwise" />
            {rebuilding ? "つなぎ直し中…" : "つなぎ直す"}
          </button>
        </div>

        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-[13px] leading-[1.8] text-text/50">
            ノートや読み取り済みの出典が増えると、
            <br />
            引用と仮説のつながりがここに描かれます。
          </div>
        )}
        <div className="absolute bottom-5 left-5 flex items-center gap-[14px] text-[11px] text-text/50">
          <span className="flex items-center gap-[6px]">
            <span className="h-px w-4 bg-accent" />
            引用でつながる
          </span>
          <span className="flex items-center gap-[6px]">
            <span className="h-px w-4 bg-[repeating-linear-gradient(90deg,var(--color-neutral-600)_0_3px,transparent_3px_6px)]" />
            AIの仮説
          </span>
        </div>
      </div>

      <aside className="flex flex-col gap-4 bg-neutral-900 p-[20px_18px]">
        <div className="flex flex-col gap-[5px]">
          <div className="text-[10px] uppercase tracking-[0.09em] text-text/40">選択中の線</div>
          <div className="text-[14px] font-medium leading-[1.4]">
            {selected?.title ?? "線を選択してください"}
          </div>
        </div>

        {selected?.reason && (
          <div className="flex flex-col gap-2 rounded-[9px] bg-accent/[0.07] p-3 shadow-[0_0_0_1px_var(--color-accent-800)]">
            <div className="text-[10px] uppercase tracking-[0.09em] text-accent">なぜ結んだか</div>
            <p className="m-0 text-[12.5px] leading-[1.7] opacity-85">{selected.reason}</p>
          </div>
        )}

        {selected && (
          <div className="flex flex-col gap-[7px]">
            <button className="btn btn-primary text-[13px]">
              <Icon name="arrows-merge" /> ノートを統合する
            </button>
            <button className="btn btn-secondary text-[13px]">線を残して別々にする</button>
            {selected.kind === "hypothesis" && (
              <button
                className="btn btn-ghost text-[13px] text-text/50"
                onClick={() => {
                  setDismissed((d) => [...d, selected.id]);
                  setSelectedEdgeId("");
                }}
              >
                この仮説を消す
              </button>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-[7px]">
          <div className="text-[10px] uppercase tracking-[0.09em] text-text/40">
            孤立しているノート {graph.isolated.length}件
          </div>
          <div className="text-[12px] leading-[1.7] opacity-70">
            {graph.isolated.map((t) => (
              <div key={t}>{t}</div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
