import { describe, expect, it } from "bun:test";
import { resolveDevCommand, resolveHazySubcommand } from "./commands";

describe("hazy-cli commands", () => {
  it("resolves subcommands accurately", () => {
    expect(resolveHazySubcommand([])).toEqual({ type: "menu" });
    expect(resolveHazySubcommand(["doctor"])).toEqual({ type: "doctor" });
    expect(resolveHazySubcommand(["dev"])).toEqual({ type: "dev", target: "all" });
    expect(resolveHazySubcommand(["dev", "api"])).toEqual({ type: "dev", target: "api" });
    expect(resolveHazySubcommand(["db", "status"])).toEqual({ type: "db", subcommand: "status" });
    expect(resolveHazySubcommand(["check"])).toEqual({ type: "check" });
    expect(resolveHazySubcommand(["build"])).toEqual({ type: "build" });
    expect(resolveHazySubcommand(["nope"])).toEqual({ type: "unknown", raw: "nope" });
  });

  it("builds dev commands with and without opEnv", () => {
    expect(resolveDevCommand("all")).toEqual(["bun", "run", "dev"]);
    expect(resolveDevCommand("api", ".env.op")).toEqual([
      "op",
      "run",
      "--env-file=.env.op",
      "--",
      "bun",
      "run",
      "dev",
      "--filter=api",
    ]);
  });
});
