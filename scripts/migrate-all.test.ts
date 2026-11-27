import { describe, expect, it } from "bun:test";
import { isLocalDatabaseUrl } from "./db-crud-test";
import {
  MIGRATION_TARGETS,
  maskDatabaseUrl,
  parseCliArgs,
  selectTargets,
} from "./migrate-all";

describe("migrate-all helpers", () => {
  it("masks database credentials while keeping host and db name", () => {
    expect(maskDatabaseUrl("postgresql://user:secret@127.0.0.1:5433/hazy")).toBe(
      "postgresql://***@127.0.0.1:5433/hazy"
    );
    expect(maskDatabaseUrl("op://Hazy/Neon-DB/DATABASE_URL")).toBe("(1Password op:// ref)");
    expect(maskDatabaseUrl(undefined)).toBe("(not set)");
  });

  it("parses CLI flags", () => {
    const opts = parseCliArgs([
      "--dry-run",
      "--with-triggers",
      "--with-crud-test",
      "--continue-on-error",
      "--only",
      "@repo/db,myblog-editor",
      "--op-env=.env.op",
    ]);
    expect(opts.dryRun).toBe(true);
    expect(opts.withTriggers).toBe(true);
    expect(opts.withCrudTest).toBe(true);
    expect(opts.continueOnError).toBe(true);
    expect(opts.only).toEqual(["@repo/db", "myblog-editor"]);
    expect(opts.opEnv).toBe(".env.op");
    expect(isLocalDatabaseUrl("postgresql://hazy@127.0.0.1:5433/hazy")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://user:pass@ep-cool.neon.tech/neondb")).toBe(false);
  });

  it("filters targets with --only and --skip and rejects unknown names", () => {
    expect(selectTargets(MIGRATION_TARGETS, { only: ["@repo/db"], skip: [] }).map((t) => t.name)).toEqual([
      "@repo/db",
    ]);
    expect(selectTargets(MIGRATION_TARGETS, { only: [], skip: ["myblog-editor"] }).map((t) => t.name)).toEqual([
      "@repo/db",
    ]);
    expect(() => selectTargets(MIGRATION_TARGETS, { only: ["unknown"], skip: [] })).toThrow();
  });
});
