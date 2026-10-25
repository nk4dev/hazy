import { UserButton } from "@clerk/nextjs";
import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { HazyMark } from "@/components/hazy-mark";
import { NavLinks } from "@/components/layout/nav-links";
import { SaveUrlDialog } from "@/components/save/save-url-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function Header() {
  const t = await getTranslations("common");

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
            <UserButton
              appearance={{
                variables: { colorPrimary: "#9184d9" },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
