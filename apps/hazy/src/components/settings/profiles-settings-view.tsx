import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { apiClient, ApiClientError } from "@/lib/clients";

export function ProfilesSettingsView() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["profiles", "list"],
    queryFn: ({ signal }) => apiClient.profiles.list(signal),
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => apiClient.profiles.create({ name: name.trim(), slug: slug.trim() }),
    onSuccess: () => {
      setName("");
      setSlug("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "Failed to create profile");
    },
  });

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => apiClient.profiles.update(id, { isDefault: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.profiles.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete profile");
    },
  });

  const profiles = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Profiles</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Separate your saved URLs, collections, Ask threads, notes, and blog connections by profile.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !slug.trim()) return;
          createMut.mutate();
        }}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border-subtle bg-surface p-4"
      >
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="profile-name-input" className="block text-xs font-medium text-text-secondary mb-1">
            Name
          </label>
          <input
            id="profile-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Work"
            className="w-full rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="profile-slug-input" className="block text-xs font-medium text-text-secondary mb-1">
            Slug
          </label>
          <input
            id="profile-slug-input"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="work"
            className="w-full rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
        <button
          type="submit"
          disabled={createMut.isPending || !name.trim() || !slug.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add Profile
        </button>
      </form>

      <div className="space-y-2">
        {isPending ? (
          <div className="text-sm text-text-muted">Loading profiles...</div>
        ) : (
          profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{p.name}</span>
                  <span className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs text-text-muted">
                    {p.slug}
                  </span>
                  {p.isDefault && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                      Default
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!p.isDefault && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDefaultMut.mutate(p.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Set default
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete profile "${p.name}" and all its data?`)) {
                          deleteMut.mutate(p.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
