import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { noteApiClient } from "@/lib/clients";

export function BlogPublishPanel({
  noteId,
  title,
  markdown,
  onPublished,
}: {
  noteId: string;
  title: string;
  markdown: string;
  onPublished: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const { data: connData } = useQuery({
    queryKey: ["p", "default", "blog-connections"],
    queryFn: ({ signal }) => noteApiClient.blogs.connections.list(signal),
  });
  const { data: pubData } = useQuery({
    queryKey: ["p", "default", "blog-publications", noteId],
    queryFn: ({ signal }) => noteApiClient.blogs.publications.list(noteId, signal),
    enabled: Boolean(noteId),
  });

  const connections = connData?.items ?? [];
  const publications = pubData?.items ?? [];

  const [connectionId, setConnectionId] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [tagsRaw, setTagsRaw] = useState("");
  const [slug, setSlug] = useState("");
  const [emoji, setEmoji] = useState("📝");

  useEffect(() => {
    if (!connectionId && connections.length > 0) {
      setConnectionId(connections[0]?.id ?? "");
    }
  }, [connections, connectionId]);

  const selectedConn = connections.find((c) => c.id === connectionId);
  const existingPub = publications.find((p) => p.connectionId === connectionId);

  const publishMut = useMutation({
    mutationFn: () =>
      noteApiClient.blogs.publish({
        connectionId,
        noteId: noteId || undefined,
        publicationId: existingPub?.id,
        title,
        markdown,
        status,
        tags: tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        ...(selectedConn?.provider === "zenn" ? { emoji } : {}),
      }),
    onSuccess: (pub) => {
      void qc.invalidateQueries({ queryKey: ["p", "default", "blog-publications"] });
      onPublished(
        pub.externalUrl
          ? `ブログに${pub.status === "published" ? "公開" : "下書き保存"}しました: ${pub.externalUrl}`
          : `ブログに${pub.status === "published" ? "公開" : "下書き保存"}しました`
      );
    },
    onError: (err) => {
      onPublished(err instanceof Error ? err.message : "ブログ投稿に失敗しました");
    },
  });

  if (connections.length === 0) {
    return (
      <div className="rounded-lg bg-surface p-3 text-[11.5px] leading-[1.6] text-text/50">
        外部ブログ未接続です。Hazy の「設定 → Blog Integrations」から microCMS / Qiita / Zenn を接続できます。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-surface p-3 shadow-[0_0_0_1px_var(--color-neutral-900)]">
      <div className="text-[10px] uppercase tracking-[0.09em] text-text/45">外部ブログへ投稿</div>
      <select
        className="input py-1 text-[12px]"
        value={connectionId}
        onChange={(e) => setConnectionId(e.target.value)}
      >
        {connections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label} ({c.provider})
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <select
          className="input flex-1 py-1 text-[12px]"
          value={status}
          onChange={(e) => setStatus(e.target.value as "draft" | "published")}
        >
          <option value="draft">下書き (Draft)</option>
          <option value="published">公開 (Publish)</option>
        </select>
        {selectedConn?.provider === "zenn" && (
          <input
            type="text"
            className="input w-14 py-1 text-center text-[12px]"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="📝"
          />
        )}
      </div>

      <input
        type="text"
        className="input py-1 text-[12px]"
        value={tagsRaw}
        onChange={(e) => setTagsRaw(e.target.value)}
        placeholder="タグ (カンマ区切り)"
      />

      {(selectedConn?.provider === "zenn" || selectedConn?.provider === "microcms") && (
        <input
          type="text"
          className="input py-1 text-[12px]"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="スラッグ (任意)"
        />
      )}

      {existingPub?.externalUrl && (
        <a
          href={existingPub.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="truncate text-[11px] text-accent underline"
        >
          公開済み記事を開く ↗
        </a>
      )}

      <Button
        variant="primary"
        className="w-full text-[12px]"
        disabled={!markdown || publishMut.isPending}
        onClick={() => publishMut.mutate()}
      >
        {publishMut.isPending
          ? "送信中…"
          : existingPub
            ? "既存記事を更新"
            : status === "published"
              ? "ブログに公開"
              : "下書きを送信"}
      </Button>
    </div>
  );
}
