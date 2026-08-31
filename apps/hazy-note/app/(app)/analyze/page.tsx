"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Loading } from "@/components/loading";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import type { InsightProfile, InsightTheme, Project, SourceKind } from "@/lib/types";

const KIND_LABEL: Record<SourceKind, string> = {
  article: "記事",
  pdf: "PDF",
  video: "動画",
  thread: "スレッド",
  note: "メモ",
};

export default function AnalyzePage() {
  const router = useRouter();
  const [projectParam, setProjectParam] = useState<string | null>(null);
  const [profile, setProfile] = useState<InsightProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rebuilding, setRebuilding] = useState(false);
  const scopedTo = useRef<string | null>(null);

  useEffect(() => {
    setProjectParam(new URLSearchParams(window.location.search).get("project"));
    api
      .analyze(new URLSearchParams(window.location.search).get("project") ?? undefined)
      .then(setProfile)
      .catch(() => setProfile(null));
    api
      .projects()
      .then(setProjects)
      .catch(() => {});
  }, []);

  // ?project=<id> — build the read scoped to that project once.
  useEffect(() => {
    if (!profile || !projectParam || scopedTo.current === projectParam) return;
    if (profile.projectId === projectParam) {
      scopedTo.current = projectParam;
      return;
    }
    scopedTo.current = projectParam;
    setRebuilding(true);
    api
      .rebuildAnalyze(projectParam)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setRebuilding(false));
  }, [profile, projectParam]);

  if (!profile) return <Loading label="傾向を読み込んでいます" />;

  const { stats } = profile;
  const scopeName = projects.find((p) => p.id === profile.projectId)?.name ?? "アカウント全体";
  const empty = stats.noteCount === 0 && stats.urlCount === 0;
  const generated = profile.generatedLabel && !empty;

  const rebuild = async () => {
    setRebuilding(true);
    try {
      setProfile(await api.rebuildAnalyze(profile.projectId || undefined));
    } finally {
      setRebuilding(false);
    }
  };

  const toNote = async () => {
    const lines = [
      profile.profile,
      "",
      ...profile.themes.map((t) => `- ${t.label}${t.note ? `（${t.note}）` : ""}`),
    ];
    if (profile.blindSpots.length) {
      lines.push("", "死角:", ...profile.blindSpots.map((b) => `- ${b}`));
    }
    const note = await api.addNote({
      title: `${scopeName}の傾向メモ`,
      text: lines.join("\n"),
    });
    router.push(`/notes/${note.id}`);
  };

  return (
    <main className="flex min-h-[640px] flex-col gap-5 p-4 pb-8 sm:p-[28px_32px_32px]">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <div className="mb-[5px] text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">
            傾向分析 · {scopeName}
          </div>
          <h3 className="tracking-[-0.02em]">
            ノート{stats.noteCount}本 · 出典{stats.urlCount}本
            {generated ? ` · ${profile.generatedLabel}` : ""}
          </h3>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="primary" onClick={rebuild} disabled={rebuilding}>
            <Icon name="sparkle" />
            {rebuilding ? "分析しています…" : empty ? "分析する" : "分析し直す"}
          </Button>
        </div>
      </header>

      {!profile.llm && !empty && (
        <div className="flex items-center gap-2 rounded-lg bg-surface px-[13px] py-[9px] text-[12px] text-text/55 shadow-[0_0_0_1px_var(--color-neutral-900)]">
          <Icon name="info" size={14} />
          AI 未設定のため、集計とタグ由来の傾向のみ表示しています。
        </div>
      )}

      {empty ? (
        <div className="rounded-[10px] bg-surface px-6 py-10 text-center text-[13px] leading-[1.8] text-text/55 shadow-[0_0_0_1px_var(--color-neutral-900)]">
          ノートを書くか、受信箱で URL を取り込むと、
          <br />
          ここで関心テーマ・情報源のクセ・視点の偏りを推定できます。
        </div>
      ) : (
        <>
          {/* プロフィール要約 */}
          <div className="flex flex-col gap-[10px] rounded-[10px] bg-accent/[0.07] px-[18px] py-4 shadow-[0_0_0_1px_var(--color-accent-800)]">
            <div className="flex items-center gap-[7px] text-[10px] uppercase tracking-[0.09em] text-accent">
              <Icon name="user-focus" size={13} /> この人の傾向
            </div>
            <p className="m-0 text-[14.5px] leading-[1.9] opacity-90">
              {profile.profile || "まだ要約がありません。「分析し直す」を押してください。"}
            </p>
            {profile.profile && (
              <div className="mt-[2px] flex gap-[7px]">
                <button type="button" onClick={toNote} className="btn btn-primary text-[13px]">
                  <Icon name="arrow-down-left" /> ノートにする
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
            {/* 関心テーマ */}
            <Panel title="関心テーマ" icon="stack">
              {profile.themes.length === 0 ? (
                <Muted>テーマを抽出できませんでした。</Muted>
              ) : (
                <div className="flex flex-col gap-[10px]">
                  {profile.themes.map((t) => (
                    <ThemeRow key={t.label} theme={t} />
                  ))}
                </div>
              )}
            </Panel>

            {/* 情報源の傾向 */}
            <Panel title="情報源の傾向" icon="link">
              <div className="flex flex-col gap-[14px]">
                <div className="flex items-baseline justify-between text-[12px] text-text/60">
                  <span>既読の出典</span>
                  <span className="text-text/80">
                    {stats.urlReadCount} / {stats.urlCount}
                  </span>
                </div>
                {stats.topDomains.length > 0 && (
                  <div className="flex flex-col gap-[6px]">
                    <SubLabel>よく読むドメイン</SubLabel>
                    {stats.topDomains.map((d) => (
                      <Bar
                        key={d.domain}
                        label={d.domain}
                        value={d.count}
                        max={stats.topDomains[0].count}
                      />
                    ))}
                  </div>
                )}
                {stats.kindMix.length > 0 && (
                  <div className="flex flex-col gap-[6px]">
                    <SubLabel>コンテンツ種別</SubLabel>
                    <div className="flex flex-wrap gap-[6px]">
                      {stats.kindMix.map((k) => (
                        <span
                          key={k.kind}
                          className="rounded-full bg-white/[0.05] px-[9px] py-[3px] text-[12px] text-text/75"
                        >
                          {KIND_LABEL[k.kind] ?? k.kind} {k.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {stats.topTags.length > 0 && (
                  <div className="flex flex-col gap-[6px]">
                    <SubLabel>頻出タグ</SubLabel>
                    <div className="flex flex-wrap gap-[6px]">
                      {stats.topTags.slice(0, 10).map((t) => (
                        <span
                          key={t.label}
                          className="rounded-full bg-accent/[0.1] px-[9px] py-[3px] text-[12px] text-accent-200"
                        >
                          {t.label} · {t.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            {/* 視点の偏り・死角 */}
            <Panel title="視点の偏り・死角" icon="scales">
              {profile.leanings.length === 0 && profile.blindSpots.length === 0 ? (
                <Muted>AI を設定すると、立場の偏りと抜けている観点を推定します。</Muted>
              ) : (
                <div className="flex flex-col gap-[13px]">
                  {profile.leanings.length > 0 && (
                    <div className="flex flex-col gap-[6px]">
                      <SubLabel>繰り返し出る立場</SubLabel>
                      <ul className="m-0 flex flex-col gap-[5px] pl-[16px] text-[13px] leading-[1.7] opacity-85">
                        {profile.leanings.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {profile.blindSpots.length > 0 && (
                    <div className="flex flex-col gap-[6px]">
                      <SubLabel>触れていない観点</SubLabel>
                      <div className="flex flex-col gap-[7px]">
                        {profile.blindSpots.map((b) => (
                          <div
                            key={b}
                            className="flex items-start gap-[8px] rounded-lg bg-white/[0.03] px-[11px] py-[8px] text-[13px] leading-[1.6]"
                          >
                            <Icon
                              name="warning-circle"
                              size={15}
                              className="mt-[2px] shrink-0 text-accent-400"
                            />
                            {b}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>

            {/* 次の一歩 */}
            <Panel title="次の一歩" icon="compass">
              {profile.nextSteps.length === 0 ? (
                <Muted>AI を設定すると、次に深掘りしそうな方向を提案します。</Muted>
              ) : (
                <div className="flex flex-col gap-[7px]">
                  {profile.nextSteps.map((s) => (
                    <div
                      key={s}
                      className="flex items-start gap-[8px] rounded-lg bg-surface px-[12px] py-[9px] text-[13px] leading-[1.6] shadow-[0_0_0_1px_var(--color-neutral-900)]"
                    >
                      <Icon
                        name="arrow-right"
                        size={14}
                        className="mt-[3px] shrink-0 text-accent"
                      />
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="text-[11.5px] leading-[1.7] text-text/45">
            集計はノート本文と保存済み URL から。テーマ・偏り・提案は
            {profile.llm ? "AI がその記録を読んで推定したものです。" : "簡易的な集計です。"}
            断定ではなく、傾向の見取り図として使ってください。
          </div>
        </>
      )}
    </main>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[12px] rounded-[10px] bg-surface px-[18px] py-4 shadow-[0_0_0_1px_var(--color-neutral-900)]">
      <div className="flex items-center gap-[7px] text-[10px] uppercase tracking-[0.09em] text-text/[0.42]">
        <Icon name={icon} size={13} /> {title}
      </div>
      {children}
    </section>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.08em] text-text/35">{children}</div>;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[12.5px] leading-[1.7] text-text/45">{children}</p>;
}

function ThemeRow({ theme }: { theme: InsightTheme }) {
  const w = Math.min(5, Math.max(1, theme.weight));
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex items-center gap-2">
        <span className="text-[13.5px] text-text/90">{theme.label}</span>
        <span className="ml-auto shrink-0 text-[10px] text-text/35">{w}/5</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-accent" style={{ width: `${(w / 5) * 100}%` }} />
      </div>
      {theme.note && <p className="m-0 text-[11.5px] leading-[1.6] text-text/45">{theme.note}</p>}
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-[9px]">
      <span className="w-[38%] shrink-0 truncate text-[12px] text-text/70">{label}</span>
      <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <span
          className="block h-full rounded-full bg-accent/70"
          style={{ width: `${Math.max(6, (value / Math.max(1, max)) * 100)}%` }}
        />
      </span>
      <span className="w-[22px] shrink-0 text-right text-[11px] text-text/50">{value}</span>
    </div>
  );
}
