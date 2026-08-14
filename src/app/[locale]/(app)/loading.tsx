import { getTranslations } from "next-intl/server";
import { HazyMark } from "@/components/hazy-mark";

export default async function AppLoading() {
  const t = await getTranslations("common");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
      <HazyMark size={32} className="animate-hz-breathe" />
      <p className="text-xs text-muted-foreground">{t("loading")}</p>
    </div>
  );
}
