// Dependency-free page extraction. Good enough for a reading queue: fetch the
// HTML, pull the title / description / og-image / favicon, and reduce the body
// to plain text for the summariser. Not a full readability port — it strips
// chrome heuristically and caps length.

export type Extracted = {
  title?: string;
  description?: string;
  ogImage?: string;
  favicon?: string;
  text: string;
  lang?: string;
  readMinutes?: number;
};

const UA = "Mozilla/5.0 (compatible; HazyNoteBot/1.0; +https://github.com/hazy-note)";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function meta(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return undefined;
}

function absolutize(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

export function htmlToText(html: string): string {
  let body = html;
  const article = body.match(/<article[\s>][\s\S]*?<\/article>/i);
  const main = body.match(/<main[\s>][\s\S]*?<\/main>/i);
  if (article) body = article[0];
  else if (main) body = main[0];

  return decodeEntities(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|section|h[1-6]|li|br|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Fetch a URL and extract its readable content. Throws on network/HTTP error. */
export async function fetchAndExtract(url: string): Promise<Extracted> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`fetch ${res.status} for ${url}`);

  const finalUrl = res.url || url;
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("html") && !ctype.includes("xml")) {
    // PDF, video page behind JS, etc. — nothing to read, just record the type.
    return { text: "", title: undefined };
  }

  const html = (await res.text()).slice(0, 2_000_000);

  const title =
    meta(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]) || undefined;

  const description = meta(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  ]);

  const ogImage = absolutize(
    meta(html, [/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i]),
    finalUrl
  );

  const favicon =
    absolutize(
      html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1],
      finalUrl
    ) ?? absolutize("/favicon.ico", finalUrl);

  const lang = html.match(/<html[^>]+lang=["']([a-z]{2})/i)?.[1];

  const text = htmlToText(html).slice(0, 12_000);
  const words = text.split(/\s+/).filter(Boolean).length;
  const readMinutes = words ? Math.max(1, Math.round(words / 450)) : undefined;

  return { title, description, ogImage, favicon, text, lang, readMinutes };
}
