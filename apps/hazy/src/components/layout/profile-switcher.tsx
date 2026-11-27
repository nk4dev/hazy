import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { apiClient, hazyQueries } from "@/lib/clients";

export function ProfileSwitcher() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["profiles", "list"],
    queryFn: ({ signal }) => apiClient.profiles.list(signal),
    staleTime: 60_000,
  });
  const { data: me } = useQuery(hazyQueries.me());

  const profiles = data?.items ?? [];
  const activeSlug =
    (typeof window !== "undefined"
      ? window.location.pathname.match(/^\/(?:en|ja)\/p\/([^/]+)/)?.[1]
      : null) ??
    me?.activeProfile?.slug ??
    profiles.find((p) => p.isDefault)?.slug ??
    "personal";

  const active = profiles.find((p) => p.slug === activeSlug) ?? profiles[0];

  if (profiles.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
      >
        <span className="max-w-[96px] truncate">{active?.name ?? activeSlug}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close profile menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1.5 w-52 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-lg">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Profiles
            </div>
            {profiles.map((p) => {
              const isSelected = p.slug === activeSlug;
              return (
                <Link
                  key={p.id}
                  href={`/p/${p.slug}/library`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-hover"
                >
                  <span className="truncate font-medium">{p.name}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-accent" />}
                </Link>
              );
            })}
            <div className="my-1 border-t border-border-subtle" />
            <Link
              href="/settings/profiles"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Manage profiles
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
