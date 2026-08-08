"use client";

import { useTranslations } from "next-intl";
import { useMeQuery, useUpdatePreferencesMutation } from "@/hooks/use-me";
import { useRouter } from "@/i18n/navigation";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const INTERFACE_LOCALES: { value: "en" | "ja"; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

export function LanguageSettingsView() {
  const t = useTranslations("settings.language");
  const { data, isLoading } = useMeQuery();
  const update = useUpdatePreferencesMutation();
  const router = useRouter();

  if (isLoading || !data) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-6 py-10">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-6 py-10">
      <h1 className="mb-8 text-xl font-medium">{t("title")}</h1>

      <div className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">
        {t("interface")}
      </div>
      <div className="mb-8 flex flex-col gap-2">
        {INTERFACE_LOCALES.map((locale) => {
          const active = data.preferences.interfaceLocale === locale.value;
          return (
            <button
              key={locale.value}
              type="button"
              onClick={() => {
                update.mutate({ interfaceLocale: locale.value });
                router.replace("/settings/language", { locale: locale.value });
              }}
              className="flex items-center gap-3 rounded-lg px-4 py-3.5 text-left text-[15px] transition-colors"
              style={{
                background: active ? "var(--secondary)" : "var(--card)",
                boxShadow: active ? "0 0 0 1px var(--primary)" : "0 0 0 1px var(--border)",
              }}
            >
              <span className="flex-1">{locale.label}</span>
              {active && <span className="text-primary">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">
        {t("answers")}
      </div>
      <RadioGroup
        className="mb-8 flex flex-col gap-3.5"
        value={data.preferences.answerLanguageMode}
        onValueChange={(value) =>
          update.mutate({ answerLanguageMode: value as "interface" | "source" })
        }
      >
        <Label className="flex items-center gap-2.5 text-[14px] font-normal">
          <RadioGroupItem value="interface" />
          {t("matchInterface")}
        </Label>
        <Label className="flex items-center gap-2.5 text-[14px] font-normal">
          <RadioGroupItem value="source" />
          {t("matchSource")}
        </Label>
      </RadioGroup>

      <div className="hz-rule mb-4" />
      <p className="text-[13px] leading-relaxed text-muted-foreground">{t("note")}</p>
    </div>
  );
}
