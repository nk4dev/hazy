/** x.com / twitter.com block metadata + image scraping outright — fxtwitter.com
 *  mirrors the same path/query and actually serves both. Mirrors the client-side
 *  helper in apps/hazy/src/components/save/save-url-dialog.tsx. */
export function toFxTwitterUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "x.com" && host !== "twitter.com") return null;
  parsed.hostname = "fxtwitter.com";
  return parsed.toString();
}
