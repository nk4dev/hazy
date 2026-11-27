import type { BlogProvider } from "@repo/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { apiClient, ApiClientError } from "@/lib/clients";

export function BlogsSettingsView() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["p", "default", "blog-connections"],
    queryFn: ({ signal }) => apiClient.blogs.connections.list(signal),
  });

  const [provider, setProvider] = useState<BlogProvider>("zenn");
  const [label, setLabel] = useState("");
  const [serviceDomain, setServiceDomain] = useState("");
  const [endpoint, setEndpoint] = useState("blogs");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => {
      const config =
        provider === "microcms"
          ? { serviceDomain: serviceDomain.trim(), endpoint: endpoint.trim() }
          : provider === "zenn"
            ? { owner: owner.trim(), repo: repo.trim(), branch: "main", articlesDir: "articles" }
            : {};
      const credentials =
        provider === "microcms"
          ? { apiKey: apiKey.trim(), ...(webhookSecret ? { webhookSecret: webhookSecret.trim() } : {}) }
          : provider === "zenn"
            ? { githubToken: githubToken.trim(), ...(webhookSecret ? { webhookSecret: webhookSecret.trim() } : {}) }
            : { accessToken: accessToken.trim() };

      return apiClient.blogs.connections.create({
        provider,
        label: label.trim() || provider,
        config,
        credentials,
      });
    },
    onSuccess: () => {
      setLabel("");
      setApiKey("");
      setAccessToken("");
      setGithubToken("");
      setWebhookSecret("");
      setStatusMsg("Blog connection added.");
      void qc.invalidateQueries({ queryKey: ["p"] });
    },
    onError: (err) => {
      setStatusMsg(err instanceof ApiClientError ? err.message : "Failed to add connection");
    },
  });

  const testMut = useMutation({
    mutationFn: (id: string) => apiClient.blogs.connections.test(id),
    onSuccess: (res) => {
      setStatusMsg(res.ok ? "Connection test succeeded!" : `Test failed: ${res.detail ?? "unknown"}`);
    },
  });

  const syncMut = useMutation({
    mutationFn: (id: string) => apiClient.blogs.connections.sync(id),
    onSuccess: (res) => {
      setStatusMsg(`Synced ${res.upserted} posts (${res.deleted} archived).`);
      void qc.invalidateQueries({ queryKey: ["p"] });
    },
    onError: (err) => {
      setStatusMsg(err instanceof ApiClientError ? err.message : "Sync failed");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.blogs.connections.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["p"] });
    },
  });

  const connections = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Blog Integrations</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Connect microCMS, Qiita, or Zenn (GitHub) to publish from hazy-note and sync published posts into Hazy Search & Ask.
        </p>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs text-text-primary">
          {statusMsg}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMut.mutate();
        }}
        className="space-y-4 rounded-xl border border-border-subtle bg-surface p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="blog-provider-select" className="block text-xs font-medium text-text-secondary mb-1">
              Provider
            </label>
            <select
              id="blog-provider-select"
              value={provider}
              onChange={(e) => setProvider(e.target.value as BlogProvider)}
              className="w-full rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
            >
              <option value="zenn">Zenn (GitHub)</option>
              <option value="microcms">microCMS</option>
              <option value="qiita">Qiita</option>
            </select>
          </div>
          <div>
            <label htmlFor="blog-label-input" className="block text-xs font-medium text-text-secondary mb-1">
              Label
            </label>
            <input
              id="blog-label-input"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Tech Blog"
              className="w-full rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
            />
          </div>
        </div>

        {provider === "microcms" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={serviceDomain}
              onChange={(e) => setServiceDomain(e.target.value)}
              placeholder="Service Domain (e.g. my-blog)"
              className="rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
            />
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="Endpoint (e.g. blogs)"
              className="rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
            />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="X-MICROCMS-API-KEY"
              className="rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
            />
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Webhook Secret (optional)"
              className="rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
            />
          </div>
        )}

        {provider === "qiita" && (
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Qiita Personal Access Token"
            className="w-full rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
          />
        )}

        {provider === "zenn" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="GitHub Owner"
              className="rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
            />
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="GitHub Repo (e.g. zenn-content)"
              className="rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
            />
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="GitHub PAT (contents:write)"
              className="rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
            />
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="GitHub Webhook Secret (optional)"
              className="rounded-lg border border-border-subtle bg-bg px-3 py-1.5 text-sm text-text-primary"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={createMut.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Connect Blog
        </button>
      </form>

      <div className="space-y-3">
        {isPending ? (
          <div className="text-sm text-text-muted">Loading connections...</div>
        ) : (
          connections.map((conn) => (
            <div
              key={conn.id}
              className="space-y-2 rounded-xl border border-border-subtle bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{conn.label}</span>
                  <span className="rounded bg-bg px-2 py-0.5 text-xs uppercase text-text-muted">
                    {conn.provider}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => testMut.mutate(conn.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => syncMut.mutate(conn.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate(conn.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {conn.webhookUrl && (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="truncate font-mono">Webhook: {conn.webhookUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(conn.webhookUrl ?? "");
                      setCopiedId(conn.id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
                  >
                    {copiedId === conn.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}

              {conn.lastSyncedAt && (
                <div className="text-xs text-text-muted">
                  Last synced: {new Date(conn.lastSyncedAt).toLocaleString()}
                </div>
              )}
              {conn.lastSyncError && (
                <div className="text-xs text-red-400">Error: {conn.lastSyncError}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
