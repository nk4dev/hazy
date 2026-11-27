import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type MigrationTarget = {
  name: string;
  dir: string;
  migrationsDir: string;
  command: string[];
  triggerCommand?: string[];
  resolveDbUrl: (env: Record<string, string | undefined>) => string | undefined;
};

export const MIGRATION_TARGETS: MigrationTarget[] = [
  {
    name: "@repo/db",
    dir: "packages/db",
    migrationsDir: "packages/db/migrations",
    command: ["bun", "run", "db:migrate"],
    triggerCommand: ["bun", "run", "db:trigger"],
    resolveDbUrl: (env) => env.DATABASE_URL,
  },
  {
    name: "myblog-editor",
    dir: "myblog-editor-proto-1",
    migrationsDir: "myblog-editor-proto-1/drizzle",
    command: ["bun", "run", "db:migrate"],
    resolveDbUrl: (env) =>
      env.USE_NEON === "1"
        ? env.DATABASE_URL
        : env.MYBLOG_DATABASE_URL || env.LOCAL_DATABASE_URL || env.DATABASE_URL,
  },
];

export type CliOptions = {
  dryRun: boolean;
  withTriggers: boolean;
  withCrudTest: boolean;
  allowRemote: boolean;
  continueOnError: boolean;
  only: string[];
  skip: string[];
  opEnv?: string;
  help: boolean;
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    withTriggers: false,
    withCrudTest: false,
    allowRemote: false,
    continueOnError: false,
    only: [],
    skip: [],
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--with-triggers") opts.withTriggers = true;
    else if (arg === "--with-crud-test") opts.withCrudTest = true;
    else if (arg === "--allow-remote") opts.allowRemote = true;
    else if (arg === "--continue-on-error") opts.continueOnError = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--only" && argv[i + 1]) opts.only.push(...splitCsv(argv[++i]!));
    else if (arg.startsWith("--only=")) opts.only.push(...splitCsv(arg.slice(7)));
    else if (arg === "--skip" && argv[i + 1]) opts.skip.push(...splitCsv(argv[++i]!));
    else if (arg.startsWith("--skip=")) opts.skip.push(...splitCsv(arg.slice(7)));
    else if (arg === "--op-env" && argv[i + 1]) opts.opEnv = argv[++i];
    else if (arg.startsWith("--op-env=")) opts.opEnv = arg.slice(9);
  }
  return opts;
}

export function maskDatabaseUrl(raw: string | undefined): string {
  if (!raw || !raw.trim()) return "(not set)";
  const trimmed = raw.trim();
  if (trimmed.startsWith("op://")) return "(1Password op:// ref)";
  try {
    const u = new URL(trimmed);
    const auth = u.username || u.password ? "***@" : "";
    const port = u.port ? `:${u.port}` : "";
    return `${u.protocol}//${auth}${u.hostname}${port}${u.pathname}`;
  } catch {
    return "(invalid URL)";
  }
}

export function selectTargets(
  targets: MigrationTarget[],
  opts: Pick<CliOptions, "only" | "skip">
): MigrationTarget[] {
  const known = new Set(targets.map((t) => t.name));
  for (const name of [...opts.only, ...opts.skip]) {
    if (!known.has(name)) {
      throw new Error(`Unknown migration target "${name}". Known: ${[...known].join(", ")}`);
    }
  }
  const onlySet = opts.only.length > 0 ? new Set(opts.only) : null;
  const skipSet = new Set(opts.skip);
  return targets.filter((t) => (!onlySet || onlySet.has(t.name)) && !skipSet.has(t.name));
}

function countSqlFiles(absDir: string): number {
  if (!existsSync(absDir)) return 0;
  return readdirSync(absDir).filter((f) => f.endsWith(".sql")).length;
}

async function runCommand(cmd: string[], cwd: string, prefix: string): Promise<number> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdin: "inherit",
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const pipe = async (stream: ReadableStream<Uint8Array>, out: NodeJS.WriteStream) => {
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    let rest = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      rest += decoder.decode(value, { stream: true });
      const lines = rest.split(/\r?\n/);
      rest = lines.pop() ?? "";
      for (const line of lines) out.write(`[${prefix}] ${line}\n`);
    }
    if (rest) out.write(`[${prefix}] ${rest}\n`);
  };

  await Promise.all([
    pipe(proc.stdout as ReadableStream<Uint8Array>, process.stdout),
    pipe(proc.stderr as ReadableStream<Uint8Array>, process.stderr),
  ]);
  return proc.exited;
}

function printHelp() {
  console.log(`Usage: bun run db:migrate:all -- [options]

Options:
  --dry-run             Show targets, migration file counts, and masked DB URLs without migrating
  --only <a,b>          Run only the specified targets (@repo/db, myblog-editor)
  --skip <a,b>          Skip the specified targets
  --with-triggers       Also run db:trigger for targets that define it (@repo/db)
  --with-crud-test      Run DB CRUD smoke test (profiles, saved_urls, blog) after migrations
  --allow-remote        Allow --with-crud-test on non-local databases
  --continue-on-error   Continue remaining targets even if one fails
  --op-env <file>       Re-exec under \`op run --env-file=<file>\` (1Password CLI)
  -h, --help            Show this help
`);
}

async function main() {
  const rawArgv = process.argv.slice(2);
  const opts = parseCliArgs(rawArgv);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

  if (opts.opEnv && !process.env.__HAZY_MIGRATE_ALL_OP_WRAPPED) {
    const forwarded = rawArgv.filter((a, idx) => {
      if (a === "--op-env") return false;
      if (idx > 0 && rawArgv[idx - 1] === "--op-env") return false;
      return !a.startsWith("--op-env=");
    });
    const proc = Bun.spawn(
      ["op", "run", `--env-file=${opts.opEnv}`, "--", "bun", "scripts/migrate-all.ts", ...forwarded],
      {
        cwd: repoRoot,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: { ...process.env, __HAZY_MIGRATE_ALL_OP_WRAPPED: "1" },
      }
    );
    process.exit(await proc.exited);
  }

  const selected = selectTargets(MIGRATION_TARGETS, opts);
  if (selected.length === 0) {
    console.log("No migration targets selected.");
    process.exit(0);
  }

  const results: { name: string; status: "ok" | "failed" | "dry-run"; ms: number }[] = [];

  for (const target of selected) {
    const absDir = join(repoRoot, target.dir);
    const sqlCount = countSqlFiles(join(repoRoot, target.migrationsDir));
    const maskedDb = maskDatabaseUrl(target.resolveDbUrl(process.env));

    console.log(`\n==> ${target.name} (${sqlCount} sql files, db: ${maskedDb})`);

    if (opts.dryRun) {
      results.push({ name: target.name, status: "dry-run", ms: 0 });
      continue;
    }

    const start = Date.now();
    const code = await runCommand(target.command, absDir, target.name);
    if (code !== 0) {
      results.push({ name: target.name, status: "failed", ms: Date.now() - start });
      if (!opts.continueOnError) break;
      continue;
    }

    if (opts.withTriggers && target.triggerCommand) {
      const trigCode = await runCommand(target.triggerCommand, absDir, `${target.name}:trigger`);
      if (trigCode !== 0) {
        results.push({ name: target.name, status: "failed", ms: Date.now() - start });
        if (!opts.continueOnError) break;
        continue;
      }
    }

    results.push({ name: target.name, status: "ok", ms: Date.now() - start });
  }

  if (opts.withCrudTest) {
    if (opts.dryRun) {
      results.push({ name: "db-crud-test", status: "dry-run", ms: 0 });
    } else if (!results.some((r) => r.status === "failed")) {
      const start = Date.now();
      const crudArgs = ["bun", "scripts/db-crud-test.ts", ...(opts.allowRemote ? ["--allow-remote"] : [])];
      const crudCode = await runCommand(crudArgs, repoRoot, "db-crud-test");
      results.push({
        name: "db-crud-test",
        status: crudCode === 0 ? "ok" : "failed",
        ms: Date.now() - start,
      });
    }
  }

  console.log("\n── Migration Summary ─────────────────────────────");
  for (const r of results) {
    console.log(`  ${r.name.padEnd(18)} ${r.status.padEnd(10)} ${r.ms}ms`);
  }

  if (results.some((r) => r.status === "failed")) {
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
