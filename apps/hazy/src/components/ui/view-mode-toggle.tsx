"use client";

import { type ViewMode, ViewModeToggle as BaseViewModeToggle } from "@repo/ui/components/ui/view-mode-toggle";
import { useTranslations } from "@/i18n";

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
    <BaseViewModeToggle
      view={view}
      onChange={onChange}
      listLabel={t("viewList")}
      gridLabel={t("viewGrid")}
    />
  );
}
