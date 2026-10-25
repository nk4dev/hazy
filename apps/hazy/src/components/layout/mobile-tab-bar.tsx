"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import {
  ChevronRight,
  CircleUser,
  Layers,
  Library,
  ListChecks,
  LogOut,
  Menu,
  Plug,
  Plus,
  Settings,
  Sparkle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SaveUrlDialog } from "@/components/save/save-url-dialog";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const MENU_LINKS = [
  { href: "/collections", key: "collections", icon: Layers },
  { href: "/settings/language", key: "settings", icon: Settings },
  { href: "/settings/connections", key: "connections", icon: Plug },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const tabClass =
  "group flex flex-1 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors";

function TabIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-8 w-14 items-center justify-center rounded-full transition-[background-color,transform] duration-150 group-active:scale-90",
        active && "bg-primary/15 text-primary"
      )}
    >
      {children}
    </span>
  );
}

function Tab({
  pathname,
  href,
  label,
  icon: Icon,
}: {
  pathname: string;
  href: string;
  label: string;
  icon: typeof Sparkle;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(tabClass, active && "text-foreground")}
    >
      <TabIcon active={active}>
        <Icon className="size-[22px]" />
      </TabIcon>
      {label}
    </Link>
  );
}

/** Phone navigation: the header is hidden below `sm`, so every entry point lives here. */
export function MobileTabBar() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const locale = useLocale();
  const menuActive = isActive(pathname, "/collections") || isActive(pathname, "/settings");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch border-t border-border/70 bg-background/90 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      <Tab pathname={pathname} href="/library" label={t("library")} icon={Library} />
      <Tab pathname={pathname} href="/ask" label={t("ask")} icon={Sparkle} />

      <div className="flex flex-1 items-center justify-center">
        <SaveUrlDialog
          triggerLabel={tCommon("saveLink")}
          trigger={
            <button
              type="button"
              aria-label={tCommon("saveLink")}
              className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform duration-150 active:scale-90"
            >
              <Plus className="size-6" />
            </button>
          }
        />
      </div>

      <Tab pathname={pathname} href="/read-later" label={t("readLater")} icon={ListChecks} />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <button type="button" className={cn(tabClass, menuActive && "text-foreground")}>
            <TabIcon active={menuActive}>
              <Menu className="size-[22px]" />
            </TabIcon>
            {t("menu")}
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-2xl px-3 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
          <ul className="flex flex-col">
            {MENU_LINKS.map(({ href, key, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "hz-interactive flex min-h-14 items-center gap-4 rounded-xl px-3 text-[16px]",
                    isActive(pathname, href) && "text-primary"
                  )}
                >
                  <Icon className="size-5 text-muted-foreground" />
                  <span className="flex-1">{t(key)}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col border-t border-border/70 pt-2">
            <button
              type="button"
              onClick={() => {
                // Clerk's modal renders outside the sheet, so close the sheet first.
                setMenuOpen(false);
                openUserProfile();
              }}
              className="hz-interactive flex min-h-14 items-center gap-4 rounded-xl px-3 text-left text-[16px]"
            >
              {user?.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: Clerk-hosted avatar, tiny
                <img src={user.imageUrl} alt="" className="size-6 rounded-full" />
              ) : (
                <CircleUser className="size-5 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? t("account")}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: `/${locale}/sign-in` })}
              className="hz-interactive flex min-h-14 items-center gap-4 rounded-xl px-3 text-left text-[16px] text-destructive"
            >
              <LogOut className="size-5" />
              {tCommon("signOut")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
