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
  icons: {
    icon: "/hazy.ico",
    shortcut: "/hazy.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      {/* `dark` keeps shadcn/ui components on their dark palette (Nocturne is
          always dark). */}
      <html
        lang="ja"
        className={`dark ${inter.variable} ${notoJP.variable}`}
        suppressHydrationWarning
      >
        <body>
          {/* Apply the saved display density before paint (see DensityToggle). */}
          <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: tiny pre-paint theme script
            dangerouslySetInnerHTML={{
              __html: `try{if(localStorage.getItem('hazy-note:density')==='compact')document.documentElement.classList.add('density-compact')}catch(e){}`,
            }}
          />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
