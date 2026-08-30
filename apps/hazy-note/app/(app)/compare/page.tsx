"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Loading } from "@/components/loading";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import type { CompareAxis, CompareBoard, Project } from "@/lib/types";

export default function ComparePage() {
  const router = useRouter();
  const [projectParam, setProjectParam] = useState<string | null>(null);
  const [board, setBoard] = useState<CompareBoard | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [extraAxes, setExtraAxes] = useState<CompareAxis[]>([]);
  const [showConfidence, setShowConfidence] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const scopedTo = useRef<string | null>(null);

  useEffect(() => {
    setProjectParam(new URLSearchParams(window.location.search).get("project"));
    api
      .compare()
      .then(setBoard)
      .catch(() => setBoard(null));
    api
      .projects()
      .then(setProjects)
      .catch(() => {});
  }, []);

  // ?project=<id> — rebuild the board scoped to that project once.
  useEffect(() => {
    if (!board || !projectParam || scopedTo.current === projectParam) return;
    if (board.projectId === projectParam) {
      scopedTo.current = projectParam;
      return;
    }
    scopedTo.current = projectParam;
    setRebuilding(true);
    api
      .rebuildCompare(projectParam)
      .then((b) => {
        setBoard(b);
        setExtraAxes([]);
      })
      .catch(() => {})
      .finally(() => setRebuilding(false));
  }, [board, projectParam]);

  if (!board) return <Loading label="比較ボードを読み込んでいます" />;

  const projectName = projects.find((p) => p.id === board.projectId)?.name ?? "すべての出典";
  const axes = [...board.axes, ...extraAxes];
  const empty = board.sources.length === 0;

  function addAxis(name: string) {
    setExtraAxes((a) => [...a, { name, values: board!.sources.map(() => null), accentCols: [] }]);
  }

  async function rebuild() {
    setRebuilding(true);
    try {
      const next = await api.rebuildCompare(board!.projectId || undefined);
      setBoard(next);
      setExtraAxes([]);
    } finally {
      setRebuilding(false);
    }
  }

  async function toNote() {
    const note = await api.addNote({
      title: `${projectName}の比較メモ`,
      text: board!.summary,
    });
    router.push(`/notes/${note.id}`);
  }

  return (
    <main className="flex min-h-[640px] flex-col gap-5 p-[28px_32px_32px]">
      <header className="flex items-end gap-4">
        <div>
          <div className="mb-[5px] text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">
            比較ボード · {projectName}
          </div>
          <h3 className="tracking-[-0.02em]">
            出典{board.sources.length}本 × 軸{axes.length}つ
          </h3>
        </div>
        <div className="ml-auto flex gap-2">
          {!empty && (
            <Button onClick={() => addAxis(`新しい軸 ${extraAxes.length + 1}`)}>
              <Icon name="plus" /> 軸を追加
            </Button>
          )}
          <Button variant="primary" onClick={rebuild} disabled={rebuilding}>
            <Icon name="sparkle" />
            {rebuilding ? "まとめています…" : empty ? "比較を作る" : "作り直す"}
          </Button>
        </div>
      </header>

      {empty ? (
        <div className="rounded-[10px] bg-surface px-6 py-10 text-center text-[13px] leading-[1.8] text-text/55 shadow-[0_0_0_1px_var(--color-neutral-900)]">
          読み取り済みの出典が2本以上あると、ここで論点ごとに突き合わせられます。
          <br />
          受信箱でいくつか取り込んでから「比較を作る」を押してください。
        </div>
      ) : (
        <table className="table text-[13px]">
          <thead>
            <tr>
              <th className="w-[160px]">軸</th>
              {board.sources.map((s, i) => (
                <th key={i}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {axes.map((axis) => (
              <tr key={axis.name}>
                <td className="font-medium">{axis.name}</td>
                {axis.values.map((v, ci) => (
                  <td
                    key={ci}
                    className={
                      v === null
                        ? "opacity-35"
                        : axis.accentCols.includes(ci)
                          ? "text-accent-300"
                          : ""
                    }
                  >
                    {v ?? "記述なし"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!empty && (
        <>
          <label className="flex items-center gap-[6px] text-[11px] text-text/55">
            <input
              type="checkbox"
              checked={showConfidence}
              onChange={(e) => setShowConfidence(e.target.checked)}
            />
            確信度を表示
          </label>
          {showConfidence && (
            <div className="flex items-center gap-4 text-[11px] text-text/50">
              <Legend swatch="bg-accent" label="出典どうしが食い違う点" />
              <Legend swatch="shadow-[inset_0_0_0_1px_var(--color-neutral-600)]" label="記述なし" />
            </div>
          )}

          <div className="mt-[2px] grid grid-cols-1 gap-[14px] lg:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-[9px] rounded-[10px] bg-accent/[0.07] px-[18px] py-4 shadow-[0_0_0_1px_var(--color-accent-800)]">
              <div className="flex items-center gap-[7px] text-[10px] uppercase tracking-[0.09em] text-accent">
                <Icon name="sparkle" size={13} /> 差分のまとめ
              </div>
              <p className="m-0 text-[14.5px] leading-[1.8] opacity-90">
                {board.summary || "まだまとめがありません。「作り直す」を押してください。"}
              </p>
              {board.summary && (
                <div className="mt-[2px] flex gap-[7px]">
                  <button onClick={toNote} className="btn btn-primary text-[13px]">
                    <Icon name="arrow-down-left" /> ノートにする
                  </button>
                </div>
              )}
            </div>
            {board.candidateAxes.length > 0 && (
              <div className="flex flex-col gap-[10px] rounded-[10px] bg-surface px-[18px] py-4 shadow-[0_0_0_1px_var(--color-neutral-900)]">
                <div className="text-[10px] uppercase tracking-[0.09em] text-text/[0.42]">
                  追加できそうな軸
                </div>
                <div className="flex flex-col gap-[7px]">
                  {board.candidateAxes.map((c) => (
                    <button
                      key={c}
                      onClick={() => addAxis(c)}
                      className="btn btn-secondary justify-start text-[13px]"
                    >
                      <Icon name="plus" /> {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-[6px]">
      <span className={`h-[7px] w-[7px] rounded-full ${swatch}`} />
      {label}
    </span>
  );
}
