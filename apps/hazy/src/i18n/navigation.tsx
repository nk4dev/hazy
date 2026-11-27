import { Link as RouterLink, useLocation, useNavigate } from "@tanstack/react-router";
import { type AnchorHTMLAttributes, useCallback, useMemo } from "react";
import { splitPathAndSearch } from "@/lib/clients";
import i18n, { useLocale } from "./index";
import { type AppLocale, isAppLocale } from "./routing";

const ACCOUNT_SCOPED_PREFIXES = ["/settings", "/connector", "/docs", "/sign-in", "/sign-up", "/p/"];

function getActiveProfileSlug(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/(?:en|ja)\/p\/([^/]+)/);
  return match?.[1] ?? null;
}

function prefixLocalePath(href: string, locale: AppLocale): string {
  if (!href.startsWith("/")) return href;
  const firstSegment = href.split("/")[1];
  if (isAppLocale(firstSegment)) return href;
  const profileSlug = getActiveProfileSlug();
  const isAccountScoped = ACCOUNT_SCOPED_PREFIXES.some((p) => href.startsWith(p));
  const withProfile =
    profileSlug && !isAccountScoped && href !== "/" ? `/p/${profileSlug}${href}` : href;
  return withProfile === "/" ? `/${locale}` : `/${locale}${withProfile}`;
}

export function Link({
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  preload?: false | "intent" | "viewport" | "render";
}) {
  const locale = useLocale();
  const target = splitPathAndSearch(prefixLocalePath(href, locale));
  return (
    <RouterLink
      to={target.to as never}
      {...(target.search ? { search: target.search as never } : {})}
      preload="intent"
      {...(props as Record<string, unknown>)}
    />
  );
}

export function usePathname(): string {
  const { pathname } = useLocation();
  const segments = pathname.split("/");
  if (isAppLocale(segments[1])) {
    const rest = `/${segments.slice(2).join("/")}`;
    return rest === "/" ? "/" : rest.replace(/\/+$/, "") || "/";
  }
  return pathname || "/";
}

export function useRouter() {
  const navigate = useNavigate();
  const currentLocale = useLocale();

  const push = useCallback(
    (href: string, opts?: { locale?: AppLocale }) => {
      const targetLocale = opts?.locale ?? currentLocale;
      if (opts?.locale) {
        void i18n.changeLanguage(opts.locale);
      }
      const target = splitPathAndSearch(prefixLocalePath(href, targetLocale));
      void navigate({
        to: target.to as never,
        ...(target.search ? { search: target.search as never } : {}),
      });
    },
    [navigate, currentLocale]
  );

  const replace = useCallback(
    (href: string, opts?: { locale?: AppLocale }) => {
      const targetLocale = opts?.locale ?? currentLocale;
      if (opts?.locale) {
        void i18n.changeLanguage(opts.locale);
      }
      const target = splitPathAndSearch(prefixLocalePath(href, targetLocale));
      void navigate({
        to: target.to as never,
        ...(target.search ? { search: target.search as never } : {}),
        replace: true,
      });
    },
    [navigate, currentLocale]
  );

  const back = useCallback(() => {
    window.history.back();
  }, []);

  return useMemo(() => ({ push, replace, back }), [push, replace, back]);
}
