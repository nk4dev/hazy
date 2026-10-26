"use client";

import { Link2 } from "lucide-react";
import { useState } from "react";
import { useDash } from "@/components/dash-provider";
import { HazyMark } from "@/components/hazy-mark";
import { startConnect } from "@/lib/connect";

export function ConnectScreen({ error }: { error?: string }) {
  const { t } = useDash();
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex items-center gap-2">
        <HazyMark size={28} />
        <span className="text-lg font-medium">Hazy Dash</span>
      </div>
      <div className="hz-surface animate-hz-rise flex w-full max-w-sm flex-col gap-5 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-medium tracking-tight">{t.connectTitle}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{t.connectBody}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            startConnect().catch(() => setBusy(false));
          }}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-[opacity,transform] active:scale-[0.98] disabled:opacity-60"
        >
          <Link2 className="size-4" />
          {busy ? t.connecting : t.connect}
        </button>
      </div>
    </main>
  );
}
