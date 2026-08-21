import type OpenAI from "openai";
import {
  type DateRange,
  getRecentUserItems,
  type SearchHit,
  searchUserItems,
} from "@/lib/search/keyword-search";

// Kept low on purpose — each result costs prompt tokens (title + excerpt),
// and results accumulate across up to MAX_TOOL_ROUNDS calls in one turn.
const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 6;

export const SEARCH_SAVED_LINKS_TOOL_NAME = "search_saved_links";

export const SEARCH_SAVED_LINKS_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: SEARCH_SAVED_LINKS_TOOL_NAME,
    description:
      "Search the user's saved reading library (their bookmarked links) by keyword, optionally narrowed to a date range of when the link was saved. Returns matching saved pages with a title, domain, and excerpt. Call this whenever answering the question needs information from what the user has saved — you may call it more than once with different queries to look for different things.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords to search for among the user's saved links.",
        },
        limit: {
          type: "integer",
          description: `Max results to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).`,
        },
        dateFrom: {
          type: "string",
          description: "Only include links saved on or after this date (YYYY-MM-DD, inclusive).",
        },
        dateTo: {
          type: "string",
          description: "Only include links saved on or before this date (YYYY-MM-DD, inclusive).",
        },
      },
      required: ["query"],
    },
  },
};

/** Parses a "YYYY-MM-DD" string into a Date, or undefined if invalid/absent. */
function parseDateArg(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseArgs(argumentsJson: string): { query: string; limit: number; dateRange: DateRange } {
  let raw: { query?: unknown; limit?: unknown; dateFrom?: unknown; dateTo?: unknown } = {};
  try {
    raw = JSON.parse(argumentsJson);
  } catch {
    // Malformed tool-call JSON from the model — fall through to defaults.
  }
  const query = typeof raw.query === "string" ? raw.query : "";
  const limitNum = typeof raw.limit === "number" ? raw.limit : NaN;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limitNum) || DEFAULT_LIMIT));
  const dateRange: DateRange = {
    from: parseDateArg(raw.dateFrom),
    to: parseDateArg(raw.dateTo),
  };
  return { query, limit, dateRange };
}

/**
 * Executes one search_saved_links tool call. Falls back to the user's most
 * recent saved items when the keyword query matches nothing, so a vague
 * query still gives the model something to work with instead of a dead end.
 */
export async function runSearchSavedLinksTool(
  userId: string,
  argumentsJson: string
): Promise<SearchHit[]> {
  const { query, limit, dateRange } = parseArgs(argumentsJson);
  const hits = query ? await searchUserItems(userId, query, { limit, dateRange }) : [];
  return hits.length > 0 ? hits : getRecentUserItems(userId, limit, dateRange);
}
