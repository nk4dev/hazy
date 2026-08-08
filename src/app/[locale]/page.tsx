import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getMissingCoreServices } from "@/lib/env";
import { getOptionalUser } from "@/lib/auth/current-user";
import { SetupRequired } from "@/components/setup-required";

export default async function RootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const missing = getMissingCoreServices();

  if (missing.length > 0) {
    const t = await getTranslations("setup");
    return (
      <SetupRequired
        missing={missing}
        title={t("title")}
        description={t("description")}
        restartHint={t("restart")}
      />
    );
  }

  const user = await getOptionalUser();
  if (user) {
    redirect({ href: "/library", locale });
  }
  redirect({ href: "/sign-in", locale });
}
