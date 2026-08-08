"use client";

import { useTranslations } from "next-intl";
import { Sparkle, Library, ListChecks, Layers } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/ask", key: "ask", icon: Sparkle },
  { href: "/library", key: "library", icon: Library },
  { href: "/collections", key: "collections", icon: Layers },
  { href: "/read-later", key: "readLater", icon: ListChecks },
] as const;

export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex items-stretch justify-around border-t border-border bg-background/95 backdrop-blur sm:hidden">
      {TABS.map(({ href, key, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] text-muted-foreground",
              active && "text-primary"
            )}
          >
            <Icon className="size-[19px]" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
