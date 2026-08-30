import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { SetupRequired } from "@/components/setup-required";
import { redirect } from "@/i18n/navigation";
import { getMissingCoreServices } from "@/lib/env";

export default async function RootPage({ params }: { params: Promise<{ locale: string }> }) {
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

  // The internal `users` row is created lazily by the API on the first
  // authenticated request (and by the Clerk webhook) — here we only gate on
  // whether there's a Clerk session at all.
  const { userId } = await auth();
  if (userId) {
    redirect({ href: "/library", locale });
  }
  redirect({ href: "/sign-in", locale });
}
