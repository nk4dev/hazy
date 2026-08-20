import { UserButton } from "@clerk/nextjs";
import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { HazyMark } from "@/components/hazy-mark";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { NavLinks } from "@/components/layout/nav-links";
import { SaveUrlDialog } from "@/components/save/save-url-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function Header() {
  const t = await getTranslations("common");

  return (
    <header className="flex items-center gap-6 border-b border-border px-6 py-3.5">
      <Link href="/library" className="flex items-center gap-2">
        <HazyMark size={20} />
        <span className="text-[17px] font-medium tracking-tight">Hazy</span>
      </Link>
      <div className="hidden overflow-x-auto sm:block">
        <NavLinks />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <Button asChild variant="ghost" size="icon" aria-label={t("settings")}>
          <Link href="/settings/language">
            <Settings className="size-4" />
          </Link>
        </Button>
        <SaveUrlDialog triggerLabel={t("saveLink")} />
        <UserButton
          appearance={{
            variables: { colorPrimary: "#9184d9" },
          }}
        />
      </div>
    </header>
  );
}
