import { describe, expect, it } from "vitest";
import { verifyHmacSha256Hex } from "./crypto";
import { buildZennMarkdown, parseZennMarkdown } from "./providers/zenn";

describe("blog crypto & zenn markdown", () => {
  it("verifies HMAC-SHA256 hex signatures", async () => {
    const secret = "test-secret";
    const payload = '{"event":"publish"}';
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");

    expect(await verifyHmacSha256Hex(secret, payload, hex)).toBe(true);
    expect(await verifyHmacSha256Hex(secret, payload, "0".repeat(64))).toBe(false);
  });

  it("builds and parses Zenn frontmatter", () => {
    const md = buildZennMarkdown({
      title: "Hello Zenn",
      markdown: "## Intro\n\nBody text.",
      status: "published",
      tags: ["typescript", "hono"],
      emoji: "🚀",
      zennType: "tech",
    });
    const parsed = parseZennMarkdown(md);
    expect(parsed.title).toBe("Hello Zenn");
    expect(parsed.published).toBe(true);
    expect(parsed.tags).toEqual(["typescript", "hono"]);
    expect(parsed.body).toContain("## Intro");
  });
});
