"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "@/hooks/use-view-mode";

/** Paired list/grid buttons for switching how a collection of items is laid out. */
export function ViewModeToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  const t = useTranslations("common");

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5">
      <Button
        type="button"
        variant={view === "list" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={t("viewList")}
        aria-pressed={view === "list"}
        onClick={() => onChange("list")}
      >
        <List className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant={view === "grid" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={t("viewGrid")}
        aria-pressed={view === "grid"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="size-3.5" />
      </Button>
    </div>
  );
}
