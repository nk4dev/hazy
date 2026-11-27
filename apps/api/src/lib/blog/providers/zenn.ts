import { verifyHmacSha256Hex } from "@/lib/blog/crypto";
import type {
  BlogProviderAdapter,
  PublishBlogPostInput,
  PublishBlogPostResult,
  RemoteBlogPost,
  WebhookParseResult,
} from "./types";

type ZennConfig = {
  owner: string;
  repo: string;
  branch?: string;
  articlesDir?: string;
  zennUsername?: string;
};

type ZennCreds = {
  githubToken: string;
  webhookSecret?: string;
};

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function buildZennMarkdown(input: PublishBlogPostInput): string {
  const emoji = input.emoji || "📝";
  const type = input.zennType || "tech";
  const topics = input.tags.slice(0, 5).map((t) => `"${t.replace(/"/g, "")}"`);
  const published = input.status === "published";
  const safeTitle = input.title.replace(/"/g, '\\"');
  return [
    "---",
    `title: "${safeTitle}"`,
    `emoji: "${emoji}"`,
    `type: "${type}"`,
    `topics: [${topics.join(", ")}]`,
    `published: ${published}`,
    "---",
    "",
    input.markdown.trim(),
    "",
  ].join("\n");
}

export function parseZennMarkdown(raw: string): {
  title: string;
  published: boolean;
  tags: string[];
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { title: "Untitled", published: false, tags: [], body: raw };
  }
  const [, fm, body] = match;
  const titleMatch = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const pubMatch = fm.match(/^published:\s*(true|false)\s*$/m);
  const topicsMatch = fm.match(/^topics:\s*\[([^\]]*)\]/m);
  const tags = topicsMatch
    ? topicsMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    : [];
  return {
    title: titleMatch?.[1] ?? "Untitled",
    published: pubMatch?.[1] === "true",
    tags,
    body: body.trim(),
  };
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Hazy-Blog-Integration",
  };
}

export const zennAdapter: BlogProviderAdapter = {
  provider: "zenn",

  async testConnection(rawCfg, rawCreds) {
    const cfg = rawCfg as ZennConfig;
    const creds = rawCreds as ZennCreds;
    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, {
      headers: ghHeaders(creds.githubToken),
    });
    if (!res.ok) return { ok: false, detail: `GitHub returned ${res.status}` };
    return { ok: true };
  },

  async publish(input: PublishBlogPostInput, rawCfg, rawCreds): Promise<PublishBlogPostResult> {
    const cfg = rawCfg as ZennConfig;
    const creds = rawCreds as ZennCreds;
    const branch = cfg.branch || "main";
    const dir = (cfg.articlesDir || "articles").replace(/^\/+|\/+$/g, "");
    const slug = (input.externalId || input.slug || `hazy-${Date.now()}`)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .slice(0, 50);
    const path = `${dir}/${slug}.md`;
    const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;

    let existingSha: string | undefined;
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: ghHeaders(creds.githubToken),
    });
    if (getRes.ok) {
      const existing = (await getRes.json()) as { sha?: string };
      existingSha = existing.sha;
    }

    const content = utf8ToBase64(buildZennMarkdown(input));
    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...ghHeaders(creds.githubToken), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `${existingSha ? "Update" : "Create"} article: ${input.title}`,
        content,
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });
    if (!putRes.ok) {
      const text = await putRes.text();
      throw new Error(`GitHub publish failed (${putRes.status}): ${text}`);
    }

    const username = cfg.zennUsername || cfg.owner;
    return {
      externalId: slug,
      externalSlug: slug,
      externalUrl: `https://zenn.dev/${username}/articles/${slug}`,
      status: input.status,
      publishedAt: input.status === "published" ? new Date() : null,
    };
  },

  async listPublished(rawCfg, rawCreds): Promise<RemoteBlogPost[]> {
    const cfg = rawCfg as ZennConfig;
    const creds = rawCreds as ZennCreds;
    const branch = cfg.branch || "main";
    const dir = (cfg.articlesDir || "articles").replace(/^\/+|\/+$/g, "");
    const res = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${dir}?ref=${encodeURIComponent(branch)}`,
      { headers: ghHeaders(creds.githubToken) }
    );
    if (!res.ok) throw new Error(`GitHub list failed (${res.status})`);
    const entries = (await res.json()) as { name: string; url: string; type: string }[];
    const mdFiles = entries.filter((e) => e.type === "file" && e.name.endsWith(".md"));

    const posts: RemoteBlogPost[] = [];
    const username = cfg.zennUsername || cfg.owner;
    for (const file of mdFiles) {
      const fRes = await fetch(file.url, { headers: ghHeaders(creds.githubToken) });
      if (!fRes.ok) continue;
      const fData = (await fRes.json()) as { content?: string };
      if (!fData.content) continue;
      const parsed = parseZennMarkdown(base64ToUtf8(fData.content));
      if (!parsed.published) continue;
      const slug = file.name.replace(/\.md$/, "");
      posts.push({
        externalId: slug,
        externalSlug: slug,
        externalUrl: `https://zenn.dev/${username}/articles/${slug}`,
        title: parsed.title,
        bodyMarkdown: parsed.body,
        status: "published",
        tags: parsed.tags,
        publishedAt: null,
      });
    }
    return posts;
  },

  async parseWebhook(headers, rawBody, rawCfg, rawCreds): Promise<WebhookParseResult> {
    const cfg = rawCfg as ZennConfig;
    const creds = rawCreds as ZennCreds;
    const sig = headers.get("x-hub-signature-256") ?? "";
    if (creds.webhookSecret) {
      const hex = sig.startsWith("sha256=") ? sig.slice(7) : sig;
      const valid = await verifyHmacSha256Hex(creds.webhookSecret, rawBody, hex);
      if (!valid) throw new Error("Invalid GitHub webhook signature");
    }

    const dir = `${(cfg.articlesDir || "articles").replace(/^\/+|\/+$/g, "")}/`;
    const payload = JSON.parse(rawBody) as {
      commits?: { added?: string[]; modified?: string[]; removed?: string[] }[];
    };
    const changed = new Set<string>();
    const removed = new Set<string>();
    for (const c of payload.commits ?? []) {
      for (const p of [...(c.added ?? []), ...(c.modified ?? [])]) {
        if (p.startsWith(dir) && p.endsWith(".md")) changed.add(p);
      }
      for (const p of c.removed ?? []) {
        if (p.startsWith(dir) && p.endsWith(".md")) removed.add(p.slice(dir.length, -3));
      }
    }

    if (changed.size === 0) {
      return { upsertPosts: [], deletedExternalIds: [...removed] };
    }

    const all = await zennAdapter.listPublished(rawCfg, rawCreds);
    const changedSlugs = new Set([...changed].map((p) => p.slice(dir.length, -3)));
    return {
      upsertPosts: all.filter((p) => changedSlugs.has(p.externalId)),
      deletedExternalIds: [...removed],
    };
  },
};
