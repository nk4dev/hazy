import { redirect } from "@/i18n/navigation";
import { getOptionalUser } from "@/lib/auth/current-user";
import { Header } from "@/components/layout/header";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getOptionalUser();
  if (!user) {
    redirect({ href: "/sign-in", locale });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col pb-14 sm:pb-0">{children}</main>
      <MobileTabBar />
    </div>
  );
}
