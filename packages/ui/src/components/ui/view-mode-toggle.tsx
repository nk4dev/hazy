"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "./button";

export type ViewMode = "list" | "grid";

/** Paired list/grid buttons for switching how a collection of items is laid out. */
export function ViewModeToggle({
  view,
  onChange,
  listLabel = "List view",
  gridLabel = "Grid view",
}: {
  view: ViewMode;
  onChange: (next: ViewMode) => void;
  listLabel?: string;
  gridLabel?: string;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5">
      <Button
        type="button"
        variant={view === "list" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={listLabel}
        aria-pressed={view === "list"}
        onClick={() => onChange("list")}
      >
        <List className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant={view === "grid" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={gridLabel}
        aria-pressed={view === "grid"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="size-3.5" />
      </Button>
    </div>
  );
}
