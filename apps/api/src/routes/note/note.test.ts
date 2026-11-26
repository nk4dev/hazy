import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "@/app";
import { __setOpenRouterHooksForTest, resetOpenRouterState } from "@/lib/ai/openrouter";
import { answerSearchChat, rewriteForExport, summariseSource } from "@/lib/note/ai";

describe("/v1/note routes & AI fallbacks", () => {
  beforeEach(() => {
    resetOpenRouterState();
  });

  afterEach(() => {
    resetOpenRouterState();
  });

  test("unauthenticated /v1/note/* endpoints return 401 unauthorized envelope", async () => {
    const app = createApp();
    for (const path of [
      "/v1/note/items",
      "/v1/note/notes",
      "/v1/note/projects",
      "/v1/note/tags",
    ]) {
      const res = await app.request(path);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("unauthorized");
    }
  });

  test("note AI wrappers fall back gracefully when OpenRouter fails", async () => {
    __setOpenRouterHooksForTest({
      sleep: async () => {},
      executor: async () => {
        const err = new Error("Rate limit") as Error & { status?: number };
        err.status = 429;
        throw err;
      },
    });

    const digest = await summariseSource({
      title: "Sample",
      kind: "article",
      text: "First sentence of the article. Second sentence of the article. Third sentence for testing fallback output.",
    });
    expect(digest.summary.length).toBeGreaterThan(0);

    const chatRes = await answerSearchChat({
      query: "architecture",
      candidates: [{ title: "Doc 1", text: "Some text about architecture." }],
    });
    expect(chatRes.llm).toBe(false);
    expect(chatRes.usedIndexes).toEqual([1]);

    const exportRes = await rewriteForExport({
      title: "Draft Note",
      markdown: "Paragraph one.\n\nParagraph two.",
      format: "blog",
    });
    expect(exportRes.title).toBe("Draft Note");
    expect(exportRes.blocks.length).toBe(2);
  });
});
