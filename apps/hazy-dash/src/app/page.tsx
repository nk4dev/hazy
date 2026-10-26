"use client";

import { ExternalLink, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { ConnectScreen } from "@/components/connect-screen";
import { DashProvider, useDash } from "@/components/dash-provider";
import { HazyMark } from "@/components/hazy-mark";
import { AskBox, QuickSave, RecentSaves, TodaysThree, WeekStats } from "@/components/hazy-widgets";
import { WeatherCard } from "@/components/weather-card";
import { HAZY_URL } from "@/lib/env";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Dashboard() {
  const { t, locale, connected, disconnect } = useDash();
  const now = useNow();
  if (!connected) return <ConnectScreen />;

  const hour = now.getHours();
  const greeting = hour < 11 ? t.greetingMorning : hour < 18 ? t.greetingDay : t.greetingEvening;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10 sm:px-6">
      <header className="flex items-center gap-3">
        <HazyMark size={22} />
        <div className="flex min-w-0 flex-col">
          <h1 className="text-2xl font-medium tracking-tight">{greeting}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {new Intl.DateTimeFormat(locale, {
              month: "long",
              day: "numeric",
              weekday: "long",
              hour: "2-digit",
              minute: "2-digit",
            }).format(now)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <a
            href={HAZY_URL}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ExternalLink className="size-4" />
            <span className="hidden sm:inline">{t.openInHazy}</span>
          </a>
          <button
            type="button"
            onClick={disconnect}
            title={t.disconnectHint}
            aria-label={t.disconnect}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* min-w-0: the hourly forecast strip must scroll inside its card, not widen the column. */}
        <div className="flex min-w-0 flex-col gap-4">
          <WeatherCard />
          <WeekStats />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <QuickSave />
          <TodaysThree />
          <AskBox />
        </div>
        <div className="flex min-w-0 flex-col gap-4 md:col-span-2 lg:col-span-1">
          <RecentSaves />
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <DashProvider>
      <Dashboard />
    </DashProvider>
  );
}
