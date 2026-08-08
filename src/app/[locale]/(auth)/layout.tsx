import { getTranslations } from "next-intl/server";
import { isClerkConfigured } from "@/lib/env";
import { redirect } from "@/i18n/navigation";
import { HazyMark } from "@/components/hazy-mark";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isClerkConfigured()) {
    redirect({ href: "/", locale });
  }
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <div className="flex items-center gap-2">
        <HazyMark size={28} />
        <span className="text-lg font-medium">Hazy</span>
      </div>
      <p className="-mt-6 text-sm text-muted-foreground">{t("tagline")}</p>
      {children}
    </div>
  );
}
