import { describe, expect, it } from "bun:test";
import { DEFAULT_FREE_MODELS, resolveModels } from "./openrouter";

describe("openrouter fallback routing", () => {
  it("resolves default models starting with primary and free models", () => {
    const models = resolveModels();
    expect(models.length).toBeGreaterThanOrEqual(DEFAULT_FREE_MODELS.length);
    // All default free models should be included
    for (const freeModel of DEFAULT_FREE_MODELS) {
      expect(models).toContain(freeModel);
    }
  });

  it("prioritizes preferredModel as the primary entry without duplication", () => {
    const preferred = DEFAULT_FREE_MODELS[2]; // e.g. "google/gemini-2.0-flash-exp:free"
    const models = resolveModels({ model: preferred });
    expect(models[0]).toBe(preferred);
    // Check no duplicate of preferred
    const occurrences = models.filter((m) => m === preferred);
    expect(occurrences.length).toBe(1);
  });

  it("respects explicit custom models list", () => {
    const custom = ["custom/model-1:free", "custom/model-2:free"];
    const models = resolveModels({ models: custom });
    expect(models).toEqual(custom);
  });
});
