"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeQuery, useUpdatePreferencesMutation } from "@/hooks/use-me";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const INTERFACE_LOCALES: { value: "en" | "ja"; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

const ANSWER_MODES = [
  { value: "interface", key: "matchInterface" },
  { value: "source", key: "matchSource" },
] as const;

function OptionRow({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className="hz-interactive flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px]"
    >
      <span className="flex-1">{label}</span>
      <Check
        className={cn(
          "size-4 text-primary transition-[opacity,transform] duration-150",
          active ? "scale-100 opacity-100" : "scale-75 opacity-0"
        )}
      />
    </button>
  );
}

export function LanguageSettingsView() {
  const t = useTranslations("settings.language");
  const { data, isLoading } = useMeQuery();
  const update = useUpdatePreferencesMutation();
  const router = useRouter();

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-hz-rise flex flex-col">
      <h2 className="hz-eyebrow mb-2 px-1">{t("interface")}</h2>
      <div className="hz-surface mb-8 divide-y divide-border/70 overflow-hidden">
        {INTERFACE_LOCALES.map((locale) => (
          <OptionRow
            key={locale.value}
            label={locale.label}
            active={data.preferences.interfaceLocale === locale.value}
            onSelect={() => {
              update.mutate({ interfaceLocale: locale.value });
              router.replace("/settings/language", { locale: locale.value });
            }}
          />
        ))}
      </div>

      <h2 className="hz-eyebrow mb-2 px-1">{t("answers")}</h2>
      <div className="hz-surface mb-4 divide-y divide-border/70 overflow-hidden">
        {ANSWER_MODES.map((mode) => (
          <OptionRow
            key={mode.value}
            label={t(mode.key)}
            active={data.preferences.answerLanguageMode === mode.value}
            onSelect={() => update.mutate({ answerLanguageMode: mode.value })}
          />
        ))}
      </div>
      <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">{t("note")}</p>
    </div>
  );
}
