export type BlogProvider = "microcms" | "qiita" | "zenn";
export type BlogPostStatus = "draft" | "published" | "archived";

export type RemoteBlogPost = {
  externalId: string;
  externalSlug: string | null;
  externalUrl: string | null;
  title: string;
  bodyMarkdown: string;
  status: BlogPostStatus;
  tags: string[];
  publishedAt: Date | null;
};

export type PublishBlogPostInput = {
  externalId?: string | null;
  title: string;
  markdown: string;
  status: "draft" | "published";
  tags: string[];
  slug?: string;
  emoji?: string;
  zennType?: "tech" | "idea";
};

export type PublishBlogPostResult = {
  externalId: string;
  externalSlug: string | null;
  externalUrl: string | null;
  status: "draft" | "published";
  publishedAt: Date | null;
};

export type WebhookParseResult =
  | { unsupported: true }
  | {
      unsupported?: false;
      upsertPosts: RemoteBlogPost[];
      deletedExternalIds: string[];
    };

export interface BlogProviderAdapter {
  readonly provider: BlogProvider;
  testConnection(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<{ ok: boolean; detail?: string }>;
  publish(
    input: PublishBlogPostInput,
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<PublishBlogPostResult>;
  listPublished(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<RemoteBlogPost[]>;
  parseWebhook(
    headers: Headers,
    rawBody: string,
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<WebhookParseResult>;
}
