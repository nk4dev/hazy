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
    <nav className="flex h-full items-stretch gap-6 text-sm">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center text-muted-foreground transition-colors hover:text-foreground",
              "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity",
              active && "text-foreground after:opacity-100"
            )}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
