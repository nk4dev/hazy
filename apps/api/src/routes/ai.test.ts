import { describe, expect, it } from "bun:test";
import { ai } from "./ai";

describe("ai route", () => {
  it("rejects invalid request body with 400 or fails gracefully", async () => {
    const res = await ai.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "data" }),
    });

    // Should fail validation since messages is missing
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
