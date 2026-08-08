"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/ask", key: "ask" },
  { href: "/library", key: "library" },
  { href: "/collections", key: "collections" },
  { href: "/read-later", key: "readLater" },
] as const;

export function NavLinks() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-5 text-sm text-muted-foreground">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn("transition-colors hover:text-foreground", active && "text-primary")}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
