import { Link as RouterLink, useLocation, useNavigate } from "@tanstack/react-router";
import { type AnchorHTMLAttributes, useCallback, useMemo } from "react";
import { splitPathAndSearch } from "@/lib/clients";
import i18n, { useLocale } from "./index";
import { type AppLocale, isAppLocale } from "./routing";

function prefixLocalePath(href: string, locale: AppLocale): string {
  if (!href.startsWith("/")) return href;
  const firstSegment = href.split("/")[1];
  if (isAppLocale(firstSegment)) return href;
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
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
