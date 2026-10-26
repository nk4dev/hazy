import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Same as `plainPreview` in apps/hazy — AI summaries can be Markdown. */
export function plainPreview(text: string): string {
  return text
    .replace(/^\s*(\*\*|__)[^*_\n]+[:：](\*\*|__)\s*$/gm, "")
    .replace(/^\s*(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*)/gm, "")
    .replace(/(\*\*|__|\*|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first http(s) URL in pasted text. */
export function firstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"、。「」『』（）]+/i);
  return match ? match[0].replace(/[).,;:!?」』）]+$/, "") : null;
}
