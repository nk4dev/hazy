import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "@phosphor-icons/web/regular";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-jp",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "hazy note",
  description: "URLの霧を、自分の言葉に落とすまで",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="ja" className={`${inter.variable} ${notoJP.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
