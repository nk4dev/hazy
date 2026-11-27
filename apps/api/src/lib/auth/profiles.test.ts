import { describe, expect, it } from "vitest";
import { RESERVED_PROFILE_SLUGS, validateProfileSlug } from "./profiles";

describe("validateProfileSlug", () => {
  it("accepts valid lowercase slugs with hyphens", () => {
    expect(validateProfileSlug("personal")).toBe("personal");
    expect(validateProfileSlug("  Work-2026 ")).toBe("work-2026");
    expect(validateProfileSlug("ab")).toBe("ab");
  });

  it("rejects too short, too long, or invalid characters", () => {
    expect(() => validateProfileSlug("a")).toThrow();
    expect(() => validateProfileSlug("-work")).toThrow();
    expect(() => validateProfileSlug("work-")).toThrow();
    expect(() => validateProfileSlug("work_space")).toThrow();
    expect(() => validateProfileSlug("a".repeat(33))).toThrow();
  });

  it("rejects reserved slugs", () => {
    for (const reserved of RESERVED_PROFILE_SLUGS) {
      expect(() => validateProfileSlug(reserved)).toThrow();
    }
  });
});
