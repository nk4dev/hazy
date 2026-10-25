import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { ConnectApprovalView } from "@/components/connect/connect-approval-view";
import { redirect } from "@/i18n/navigation";

export default async function ConnectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const { userId } = await auth();
  if (!userId) {
    // Come back here with the full query once signed in — the PKCE params are in it.
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (typeof value === "string") query.set(key, value);
    }
    const back = `/${locale}/connector/add${query.size ? `?${query}` : ""}`;
    redirect({ href: { pathname: "/sign-in", query: { redirect_url: back } }, locale });
  }

  return (
    <Suspense>
      <ConnectApprovalView />
    </Suspense>
  );
}
