import { useLocation } from "@tanstack/react-router";
import { useMemo } from "react";
import { LibraryView } from "@/components/library/library-view";

export function LibraryPage() {
  const location = useLocation();
  const q = useMemo(() => new URLSearchParams(location.searchStr).get("q") ?? "", [location.searchStr]);
  return <LibraryView initialQuery={q} />;
}
