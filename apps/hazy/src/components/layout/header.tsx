import { HazyMark } from "@repo/ui/components/hazy-mark";
import { ProfileSwitcher } from "@/components/layout/profile-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { CircleUser, LogOut, Settings } from "lucide-react";
import { NavLinks } from "@/components/layout/nav-links";
import { useAuthSession } from "@/components/providers/auth-provider";
import { SaveUrlDialog } from "@/components/save/save-url-dialog";
import { useLocale, useTranslations } from "@/i18n";
import { Link } from "@/i18n/navigation";

function userInitials(name: string | undefined, email: string | undefined): string {
  const source = (name || email || "H").trim();
  return source.slice(0, 1).toUpperCase();
}

export function Header() {
  const t = useTranslations("common");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const { user, signOut } = useAuthSession();

  return (
    <header className="sticky top-0 z-20 hidden border-b sm:block border-border/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[110rem] items-center gap-3 px-4 sm:gap-8 sm:px-6">
        <Link
          href="/library"
          className="hz-interactive -mx-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1"
        >
          <HazyMark size={20} />
          <span className="text-[17px] font-medium tracking-tight">Hazy</span>
        </Link>
        <div className="hidden h-full sm:block">
          <NavLinks />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-10 text-muted-foreground hover:text-foreground sm:size-9"
            aria-label={t("settings")}
          >
            <Link href="/settings/language">
              <Settings className="size-[18px]" />
            </Link>
          </Button>
          <SaveUrlDialog triggerLabel={t("saveLink")} />
          <div className="ml-1 flex size-9 items-center justify-center">
            <ProfileSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={tNav("account")}
                  className="size-8 rounded-full"
                >
                  <Avatar className="size-7">
                    {user?.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                    <AvatarFallback className="bg-primary/20 text-xs text-primary">
                      {user ? userInitials(user.name, user.email) : <CircleUser className="size-4" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user && (
                  <>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-0.5">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/settings/profiles">Profiles</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/blogs">Blog Integrations</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => void signOut(locale)}
                >
                  <LogOut className="size-4" />
                  <span>{t("signOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
