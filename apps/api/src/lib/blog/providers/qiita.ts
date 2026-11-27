import type {
  BlogProviderAdapter,
  PublishBlogPostInput,
  PublishBlogPostResult,
  RemoteBlogPost,
  WebhookParseResult,
} from "./types";

type QiitaConfig = {
  organizationUrlName?: string;
};

type QiitaCreds = {
  accessToken: string;
};

type QiitaItem = {
  id: string;
  title: string;
  body: string;
  url: string;
  private: boolean;
  tags: { name: string }[];
  created_at: string;
};

export const qiitaAdapter: BlogProviderAdapter = {
  provider: "qiita",

  async testConnection(_rawCfg, rawCreds) {
    const creds = rawCreds as QiitaCreds;
    const res = await fetch("https://qiita.com/api/v2/authenticated_user", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    if (!res.ok) return { ok: false, detail: `Qiita returned ${res.status}` };
    return { ok: true };
  },

  async publish(input: PublishBlogPostInput, rawCfg, rawCreds): Promise<PublishBlogPostResult> {
    const cfg = rawCfg as QiitaConfig;
    const creds = rawCreds as QiitaCreds;
    const tags = (input.tags.length > 0 ? input.tags : ["note"]).slice(0, 5).map((name) => ({ name }));
    const payload: Record<string, unknown> = {
      title: input.title,
      body: input.markdown,
      private: input.status === "draft",
      tags,
    };
    if (cfg.organizationUrlName) {
      payload.organization_url_name = cfg.organizationUrlName;
    }

    const url = input.externalId
      ? `https://qiita.com/api/v2/items/${input.externalId}`
      : "https://qiita.com/api/v2/items";
    const method = input.externalId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Qiita publish failed (${res.status}): ${text}`);
    }
    const item = (await res.json()) as QiitaItem;
    return {
      externalId: item.id,
      externalSlug: item.id,
      externalUrl: item.url,
      status: item.private ? "draft" : "published",
      publishedAt: item.private ? null : new Date(item.created_at),
    };
  },

  async listPublished(_rawCfg, rawCreds): Promise<RemoteBlogPost[]> {
    const creds = rawCreds as QiitaCreds;
    const res = await fetch("https://qiita.com/api/v2/authenticated_user/items?per_page=100", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    if (!res.ok) throw new Error(`Qiita list failed (${res.status})`);
    const items = (await res.json()) as QiitaItem[];
    return items
      .filter((i) => !i.private)
      .map((i) => ({
        externalId: i.id,
        externalSlug: i.id,
        externalUrl: i.url,
        title: i.title,
        bodyMarkdown: i.body,
        status: "published",
        tags: i.tags.map((t) => t.name),
        publishedAt: new Date(i.created_at),
      }));
  },

  async parseWebhook(): Promise<WebhookParseResult> {
    return { unsupported: true };
  },
};
