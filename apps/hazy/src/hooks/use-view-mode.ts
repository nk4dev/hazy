"use client";

import { useEffect, useState } from "react";

export type ViewMode = "list" | "grid";

/**
 * Remembers a list/grid preference in localStorage, keyed per surface
 * (library, collections, …). Starts as "list" to match server-rendered
 * HTML — there's no localStorage there — then syncs from the stored
 * preference once mounted on the client. That's reading a browser-only
 * external store on mount, not a state loop, so setState-in-effect is
 * the right call here.
 */
export function useViewMode(storageKey: string) {
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "grid" || stored === "list") setView(stored);
  }, [storageKey]);

  function updateView(next: ViewMode) {
    setView(next);
    window.localStorage.setItem(storageKey, next);
  }

  return [view, updateView] as const;
}
