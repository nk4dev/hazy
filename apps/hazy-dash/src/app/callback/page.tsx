"use client";

import { useEffect, useState } from "react";
import { ConnectScreen } from "@/components/connect-screen";
import { DashProvider, useDash } from "@/components/dash-provider";
import { completeConnect } from "@/lib/connect";

function Callback() {
  const { t } = useDash();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Drop the one-shot code from the address bar / history right away.
    window.history.replaceState(null, "", "/callback");
    completeConnect(params).then((result) => {
      if (result.ok) {
        // Full reload so the provider re-reads the stored token.
        window.location.replace("/");
        return;
      }
      setError(
        result.reason === "denied"
          ? t.denied
          : result.reason === "state"
            ? t.stateError
            : t.exchangeError
      );
    });
  }, [t]);

  if (error) return <ConnectScreen error={error} />;
  return (
    <main className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      {t.connecting}
    </main>
  );
}

export default function CallbackPage() {
  return (
    <DashProvider>
      <Callback />
    </DashProvider>
  );
}
