"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/settings/language", key: "language" },
  { href: "/settings/connections", key: "connections" },
] as const;

export function SettingsNav() {
  const t = useTranslations("settings.nav");
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex gap-1 rounded-xl bg-secondary/60 p-1 text-sm">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-9 flex-1 items-center justify-center rounded-lg px-3 text-muted-foreground transition-[background-color,color] hover:text-foreground",
              active && "bg-card text-foreground shadow-sm ring-1 ring-border"
            )}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
