import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { routing } from "@/i18n/routing";
import { isClerkConfigured } from "@/lib/env";
import "../globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Hazy — a memory for the URLs you save",
  description: "Save links, ask questions about your own reading, and catch up later.",
  icons: {
    icon: "/hazy.ico",
    shortcut: "/hazy.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f101a",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();
  const clerkEnabled = isClerkConfigured();

  const body = (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <TooltipProvider>
          {children}
          {/* Clear the mobile tab bar (~63px, sm:hidden) on narrow screens. */}
          <Toaster mobileOffset={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }} />
        </TooltipProvider>
      </QueryProvider>
    </NextIntlClientProvider>
  );

  return (
    <html
      lang={locale}
      data-locale={locale}
      className={`${inter.variable} ${notoSansJP.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {clerkEnabled ? <ClerkProvider>{body}</ClerkProvider> : body}
      </body>
    </html>
  );
}
