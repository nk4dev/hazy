import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** AI summaries sometimes come back as Markdown ("**要約：**\n- …"). For the
 *  two-line previews in lists, drop label-only lines and Markdown markers and
 *  flatten to one paragraph. Mirrors `plainPreview` in the Flutter app. */
export function plainPreview(text: string): string {
  return text
    .replace(/^\s*(\*\*|__)[^*_\n]+[:：](\*\*|__)\s*$/gm, "")
    .replace(/^\s*(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*)/gm, "")
    .replace(/(\*\*|__|\*|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
