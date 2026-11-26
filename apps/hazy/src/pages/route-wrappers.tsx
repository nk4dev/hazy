import { useAuth } from "@clerk/clerk-react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { AskThreadView } from "@/components/ask/ask-thread-view";
import { AskView } from "@/components/ask/ask-view";
import { CollectionDetailView } from "@/components/collections/collection-detail-view";
import { CollectionsView } from "@/components/collections/collections-view";
import { ItemDetailView } from "@/components/item/item-detail-view";
import { LibraryView } from "@/components/library/library-view";
import { ReadLaterView } from "@/components/read-later/read-later-view";
import { ConnectedAppsView } from "@/components/settings/connected-apps-view";
import { LanguageSettingsView } from "@/components/settings/language-settings-view";
import { SetupRequired } from "@/components/setup-required";
import { useLocale, useTranslations } from "@/i18n";
import { getMissingCoreServices, isClerkConfigured } from "@/lib/env";
import { AppLoadingScreen } from "./app-shell";

function AuthedRootRedirect() {
  const locale = useLocale();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <AppLoadingScreen />;
  return <Navigate to={isSignedIn ? `/${locale}/library` : `/${locale}/sign-in`} replace />;
}

export function LocaleIndexPage() {
  const t = useTranslations("setup");
  const missing = getMissingCoreServices();

  if (missing.length > 0 || !isClerkConfigured()) {
    return (
      <SetupRequired
        missing={missing}
        title={t("title")}
        description={t("description")}
        restartHint={t("restart")}
      />
    );
  }

  return <AuthedRootRedirect />;
}

export function LibraryPage() {
  const [search] = useSearchParams();
  return <LibraryView initialQuery={search.get("q") ?? ""} />;
}

export function ItemPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <ItemDetailView id={id} />;
}

export function CollectionsPage() {
  return <CollectionsView />;
}

export function CollectionDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <CollectionDetailView id={id} />;
}

export function AskPage() {
  return <AskView />;
}

export function AskThreadPage() {
  const { threadId = "" } = useParams<{ threadId: string }>();
  return <AskThreadView threadId={threadId} />;
}

export function ReadLaterPage() {
  return <ReadLaterView />;
}

export function LanguageSettingsPage() {
  return <LanguageSettingsView />;
}

export function ConnectedAppsPage() {
  return <ConnectedAppsView />;
}
