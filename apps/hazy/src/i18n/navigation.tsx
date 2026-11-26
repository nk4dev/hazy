import { useCallback, useMemo } from "react";
import { type LinkProps, Link as RouterLink, useLocation, useNavigate } from "react-router";
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
}: Omit<LinkProps, "to"> & {
  href: string;
}) {
  const locale = useLocale();
  return <RouterLink to={prefixLocalePath(href, locale)} {...props} />;
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
      void navigate(prefixLocalePath(href, targetLocale));
    },
    [navigate, currentLocale]
  );

  const replace = useCallback(
    (href: string, opts?: { locale?: AppLocale }) => {
      const targetLocale = opts?.locale ?? currentLocale;
      if (opts?.locale) {
        void i18n.changeLanguage(opts.locale);
      }
      void navigate(prefixLocalePath(href, targetLocale), { replace: true });
    },
    [navigate, currentLocale]
  );

  const back = useCallback(() => {
    void navigate(-1);
  }, [navigate]);

  return useMemo(() => ({ push, replace, back }), [push, replace, back]);
}
