import { ValidationError } from "@/lib/api/errors";

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set(["fbclid", "gclid", "msclkid", "mc_cid", "mc_eid", "igshid"]);

export function parseAndNormalizeUrl(raw: string): { url: string; normalizedUrl: string; domain: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new ValidationError("That doesn't look like a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("Only http:// and https:// links can be saved.");
  }

  const normalized = new URL(parsed.toString());
  normalized.hostname = normalized.hostname.toLowerCase();
  normalized.hash = "";

  const paramsToDelete: string[] = [];
  normalized.searchParams.forEach((_value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      TRACKING_PARAMS.has(lowerKey) ||
      TRACKING_PARAM_PREFIXES.some((prefix) => lowerKey.startsWith(prefix))
    ) {
      paramsToDelete.push(key);
    }
  });
  paramsToDelete.forEach((key) => normalized.searchParams.delete(key));

  // Trailing slash on a bare path is cosmetic — treat `example.com` and
  // `example.com/` as the same save.
  let normalizedString = normalized.toString();
  if (normalized.pathname === "/" && normalizedString.endsWith("/")) {
    normalizedString = normalizedString.slice(0, -1);
  }

  return {
    url: parsed.toString(),
    normalizedUrl: normalizedString,
    domain: normalized.hostname.replace(/^www\./, ""),
  };
}
