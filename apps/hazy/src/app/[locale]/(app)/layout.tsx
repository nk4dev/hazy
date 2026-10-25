import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/layout/header";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { redirect } from "@/i18n/navigation";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { userId } = await auth();
  if (!userId) {
    redirect({ href: "/sign-in", locale });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex flex-1 flex-col pt-[env(safe-area-inset-top)] pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pt-0 sm:pb-0">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
