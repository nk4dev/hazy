import { getTranslations } from "next-intl/server";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");

  return (
    <div className="hz-page max-w-xl">
      <h1 className="mb-5 text-2xl font-medium tracking-tight">{t("settings")}</h1>
      <SettingsNav />
      {children}
    </div>
  );
}
