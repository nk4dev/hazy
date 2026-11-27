import { verifyHmacSha256Hex } from "@/lib/blog/crypto";
import type {
  BlogProviderAdapter,
  PublishBlogPostInput,
  PublishBlogPostResult,
  RemoteBlogPost,
  WebhookParseResult,
} from "./types";

type MicroCmsConfig = {
  serviceDomain: string;
  endpoint: string;
  titleField?: string;
  bodyField?: string;
  tagsField?: string;
  slugField?: string;
  publicUrlTemplate?: string;
};

type MicroCmsCreds = {
  apiKey: string;
  webhookSecret?: string;
};

function buildUrl(cfg: MicroCmsConfig, id?: string, slug?: string | null): string | null {
  if (!cfg.publicUrlTemplate) return null;
  return cfg.publicUrlTemplate
    .replace(/\{id\}/g, id ?? "")
    .replace(/\{slug\}/g, slug ?? id ?? "");
}

function mapContent(item: Record<string, unknown>, cfg: MicroCmsConfig): RemoteBlogPost {
  const titleKey = cfg.titleField || "title";
  const bodyKey = cfg.bodyField || "body";
  const tagsKey = cfg.tagsField || "tags";
  const slugKey = cfg.slugField || "slug";
  const id = String(item.id ?? "");
  const slug = item[slugKey] ? String(item[slugKey]) : null;
  const rawTags = item[tagsKey];
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t) => (typeof t === "string" ? t : String((t as Record<string, unknown>)?.name ?? ""))).filter(Boolean)
    : [];
  return {
    externalId: id,
    externalSlug: slug,
    externalUrl: buildUrl(cfg, id, slug),
    title: String(item[titleKey] ?? "Untitled"),
    bodyMarkdown: String(item[bodyKey] ?? ""),
    status: "published",
    tags,
    publishedAt: item.publishedAt ? new Date(String(item.publishedAt)) : null,
  };
}

export const microcmsAdapter: BlogProviderAdapter = {
  provider: "microcms",

  async testConnection(rawCfg, rawCreds) {
    const cfg = rawCfg as MicroCmsConfig;
    const creds = rawCreds as MicroCmsCreds;
    const res = await fetch(
      `https://${cfg.serviceDomain}.microcms.io/api/v1/${cfg.endpoint}?limit=1`,
      { headers: { "X-MICROCMS-API-KEY": creds.apiKey } }
    );
    if (!res.ok) {
      return { ok: false, detail: `microCMS returned ${res.status}` };
    }
    return { ok: true };
  },

  async publish(input: PublishBlogPostInput, rawCfg, rawCreds): Promise<PublishBlogPostResult> {
    const cfg = rawCfg as MicroCmsConfig;
    const creds = rawCreds as MicroCmsCreds;
    const titleKey = cfg.titleField || "title";
    const bodyKey = cfg.bodyField || "body";
    const tagsKey = cfg.tagsField || "tags";
    const slugKey = cfg.slugField || "slug";

    const payload: Record<string, unknown> = {
      [titleKey]: input.title,
      [bodyKey]: input.markdown,
      [tagsKey]: input.tags,
    };
    if (input.slug) payload[slugKey] = input.slug;

    const base = `https://${cfg.serviceDomain}.microcms.io/api/v1/${cfg.endpoint}`;
    const qs = input.status === "draft" ? "?status=draft" : "";
    const url = input.externalId ? `${base}/${input.externalId}${qs}` : `${base}${qs}`;
    const method = input.externalId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-MICROCMS-API-KEY": creds.apiKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`microCMS publish failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as { id?: string };
    const id = data.id ?? input.externalId ?? "";
    const slug = input.slug ?? null;
    return {
      externalId: id,
      externalSlug: slug,
      externalUrl: buildUrl(cfg, id, slug),
      status: input.status,
      publishedAt: input.status === "published" ? new Date() : null,
    };
  },

  async listPublished(rawCfg, rawCreds): Promise<RemoteBlogPost[]> {
    const cfg = rawCfg as MicroCmsConfig;
    const creds = rawCreds as MicroCmsCreds;
    const res = await fetch(
      `https://${cfg.serviceDomain}.microcms.io/api/v1/${cfg.endpoint}?limit=100`,
      { headers: { "X-MICROCMS-API-KEY": creds.apiKey } }
    );
    if (!res.ok) throw new Error(`microCMS list failed (${res.status})`);
    const data = (await res.json()) as { contents?: Record<string, unknown>[] };
    return (data.contents ?? []).map((item) => mapContent(item, cfg));
  },

  async parseWebhook(headers, rawBody, rawCfg, rawCreds): Promise<WebhookParseResult> {
    const cfg = rawCfg as MicroCmsConfig;
    const creds = rawCreds as MicroCmsCreds;
    const sig = headers.get("x-microcms-signature") ?? "";
    if (creds.webhookSecret) {
      const valid = await verifyHmacSha256Hex(creds.webhookSecret, rawBody, sig);
      if (!valid) throw new Error("Invalid microCMS webhook signature");
    }
    const event = JSON.parse(rawBody) as {
      type?: string;
      id?: string;
      contents?: { new?: { publishValue?: Record<string, unknown> | null } };
    };
    const publishValue = event.contents?.new?.publishValue;
    if (event.type === "delete" && event.id) {
      return { upsertPosts: [], deletedExternalIds: [event.id] };
    }
    if (publishValue && typeof publishValue === "object") {
      return { upsertPosts: [mapContent(publishValue, cfg)], deletedExternalIds: [] };
    }
    return { upsertPosts: [], deletedExternalIds: [] };
  },
};
