import { describe, expect, it } from "bun:test";
import { buildDbCommand, resolveSubcommand } from "./db-cli";

describe("db-cli helpers", () => {
  it("maps subcommands to actions", () => {
    expect(resolveSubcommand("status")).toBe("status");
    expect(resolveSubcommand("migrate")).toBe("migrate");
    expect(resolveSubcommand("all")).toBe("all");
    expect(resolveSubcommand("test")).toBe("test");
    expect(resolveSubcommand("unknown")).toBeNull();
  });

  it("builds commands with and without 1Password env file", () => {
    expect(buildDbCommand("status")).toEqual({
      cmd: ["bun", "scripts/migrate-all.ts", "--dry-run"],
    });
    expect(buildDbCommand("all", ".env.op")).toEqual({
      cmd: [
        "bun",
        "scripts/migrate-all.ts",
        "--with-triggers",
        "--with-crud-test",
        "--op-env",
        ".env.op",
      ],
    });
    expect(buildDbCommand("studio-hazy", ".env.op")).toEqual({
      cmd: ["op", "run", "--env-file=.env.op", "--", "bun", "run", "db:studio"],
      cwd: "packages/db",
    });
  });
});
