import * as cheerio from "cheerio";

export type FetchedMetadata = {
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  contentLanguage: string | null;
  extractedText: string | null;
  estimatedReadMinutes: number | null;
};

export type FetchMetadataResult =
  | { status: "success"; metadata: FetchedMetadata }
  | { status: "error"; error: string };

const FETCH_TIMEOUT_MS = 8000;
const EXTRACTED_TEXT_CAP = 4000;
const WORDS_PER_MINUTE = 200;

function absoluteUrl(base: string, maybeRelative: string | undefined): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function detectLanguage(html: cheerio.CheerioAPI, text: string): string | null {
  const htmlLang = html("html").attr("lang");
  if (htmlLang) return htmlLang.split("-")[0].toLowerCase();
  // Cheap heuristic fallback: a meaningful share of CJK codepoints implies Japanese.
  const sample = text.slice(0, 400);
  const cjkMatches = sample.match(/[぀-ヿ㐀-䶿一-鿿]/g);
  if (cjkMatches && cjkMatches.length / Math.max(sample.length, 1) > 0.15) return "ja";
  return "en";
}

export async function fetchUrlMetadata(url: string): Promise<FetchMetadataResult> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "HazyBot/1.0 (+https://hazy.app; link preview fetcher)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return { status: "error", error: `Fetch failed with status ${response.status}` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
      return { status: "error", error: `Unsupported content type: ${contentType || "unknown"}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const finalUrl = response.url || url;

    const ogTitle = $('meta[property="og:title"]').attr("content");
    const titleTag = $("title").first().text();
    const title = (ogTitle || titleTag || "").trim() || null;

    const ogDescription = $('meta[property="og:description"]').attr("content");
    const metaDescription = $('meta[name="description"]').attr("content");
    const description = (ogDescription || metaDescription || "").trim() || null;

    const ogImage = $('meta[property="og:image"]').attr("content");
    const ogImageUrl = absoluteUrl(finalUrl, ogImage);

    const iconHref =
      $('link[rel="icon"]').attr("href") ??
      $('link[rel="shortcut icon"]').attr("href") ??
      $('link[rel="apple-touch-icon"]').attr("href");
    const faviconUrl = absoluteUrl(finalUrl, iconHref) ?? absoluteUrl(finalUrl, "/favicon.ico");

    $("script, style, noscript, nav, footer").remove();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const extractedText = bodyText ? bodyText.slice(0, EXTRACTED_TEXT_CAP) : null;

    const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
    const estimatedReadMinutes = wordCount
      ? Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE))
      : null;

    const contentLanguage = detectLanguage($, bodyText);

    return {
      status: "success",
      metadata: {
        title,
        description,
        faviconUrl,
        ogImageUrl,
        contentLanguage,
        extractedText,
        estimatedReadMinutes,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "TimeoutError" || error.name === "AbortError"
          ? "Timed out fetching the page."
          : error.message
        : "Unknown fetch error";
    return { status: "error", error: message };
  }
}
