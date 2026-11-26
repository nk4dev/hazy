import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { type AnchorHTMLAttributes, useCallback, useMemo } from "react";
import { splitPathAndSearch } from "./clients";

export function NoteLink({
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  preload?: false | "intent" | "viewport" | "render";
}) {
  const target = splitPathAndSearch(href);
  return (
    <RouterLink
      to={target.to as never}
      {...(target.search ? { search: target.search as never } : {})}
      preload="intent"
      {...(props as Record<string, unknown>)}
    />
  );
}

export function useNoteNavigate() {
  const navigate = useNavigate();

  const push = useCallback(
    (href: string) => {
      const target = splitPathAndSearch(href);
      void navigate({
        to: target.to as never,
        ...(target.search ? { search: target.search as never } : {}),
      });
    },
    [navigate]
  );

  const replace = useCallback(
    (href: string) => {
      const target = splitPathAndSearch(href);
      void navigate({
        to: target.to as never,
        ...(target.search ? { search: target.search as never } : {}),
        replace: true,
      });
    },
    [navigate]
  );

  return useMemo(() => ({ push, replace }), [push, replace]);
}
