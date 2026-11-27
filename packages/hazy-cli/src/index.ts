#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { maskDatabaseUrl } from "../../../scripts/migrate-all";
import { APPS, type AppKey, resolveDevCommand, resolveHazySubcommand } from "./commands";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function detectOpEnv(): string | undefined {
  if (existsSync(join(repoRoot, ".env.op"))) return ".env.op";
  return undefined;
}

async function runSpawn(cmd: string[], cwd = repoRoot): Promise<number> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });
  return proc.exited;
}

function checkBin(bin: string): boolean {
  try {
    const res = Bun.spawnSync([bin, "--version"], { stdout: "ignore", stderr: "ignore" });
    return res.exitCode === 0;
  } catch {
    return false;
  }
}

function runDoctor() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║           Hazy 環境診断 (doctor)             ║");
  console.log("╚══════════════════════════════════════════════╝");

  const tools = ["bun", "git", "op", "wrangler"];
  console.log("\n[Tools]");
  for (const t of tools) {
    console.log(`  ${checkBin(t) ? "OK  " : "MISS"} ${t}`);
  }

  console.log("\n[Env Files]");
  for (const f of [".env.op", ".env.prod.op", ".env.example"]) {
    console.log(`  ${existsSync(join(repoRoot, f)) ? "OK  " : "NONE"} ${f}`);
  }
  console.log(`  DATABASE_URL: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);

  console.log("\n[Workspace Apps]");
  for (const [key, info] of Object.entries(APPS)) {
    console.log(`  ${key.padEnd(15)} :${info.port}  (${info.label})`);
  }
  console.log("");
}

function printHelp() {
  console.log(`Hazy 管理 CLI (bun run hazy)

使い方:
  bun run hazy                  対話式メニューを開く
  bun run hazy doctor           環境・ツール・ポート一覧を確認
  bun run hazy dev [app]        開発サーバー起動 (all | api | hazy | hazy-note | hazy-dash | myblog-editor)
  bun run hazy db [sub]         DB 管理 (status | migrate | test | all / 引数なしでメニュー)
  bun run hazy check            型チェック + Lint + 全テスト一括実行
  bun run hazy build            全 SPA ビルド
`);
}

async function runCheck(): Promise<number> {
  const steps: [string, string[]][] = [
    ["check-types", ["bun", "run", "check-types"]],
    ["lint", ["bun", "run", "lint"]],
    ["api test", ["bun", "--cwd", "apps/api", "test"]],
    ["hazy-note test", ["bun", "--cwd", "apps/hazy-note", "test"]],
    ["hazy-dash test", ["bun", "--cwd", "apps/hazy-dash", "test"]],
    ["cli/db tests", ["bun", "test", "packages/hazy-cli/src/cli.test.ts", "scripts/db-cli.test.ts", "scripts/migrate-all.test.ts"]],
  ];
  for (const [label, cmd] of steps) {
    console.log(`\n==> ${label}`);
    const code = await runSpawn(cmd);
    if (code !== 0) return code;
  }
  return 0;
}

async function interactiveMenu() {
  const rl = createInterface({ input, output });
  try {
    console.log(`
╔══════════════════════════════════════════════╗
║             Hazy 管理 CLI (hazy)             ║
╚══════════════════════════════════════════════╝
  1) 環境診断 (doctor)
  2) 開発サーバー起動 (dev)
  3) DB 管理メニュー (db)
  4) 品質チェック一括実行 (check-types + lint + test)
  5) 全 SPA ビルド (build)
  0) 終了
`);
    const choice = (await rl.question("番号を選択してください [1]: ")).trim() || "1";
    if (choice === "0") return;

    if (choice === "1") {
      rl.close();
      runDoctor();
      return;
    }

    if (choice === "2") {
      console.log("\n起動対象:");
      console.log("  1) すべて (all)");
      const keys = Object.keys(APPS) as AppKey[];
      keys.forEach((k, i) => console.log(`  ${i + 2}) ${k} (:${APPS[k].port})`));
      const pick = (await rl.question("番号を選択 [1]: ")).trim() || "1";
      const target: "all" | AppKey = pick === "1" ? "all" : (keys[Number(pick) - 2] ?? "all");
      rl.close();
      process.exit(await runSpawn(resolveDevCommand(target, detectOpEnv())));
    }

    rl.close();
    if (choice === "3") process.exit(await runSpawn(["bun", "scripts/db-cli.ts"]));
    if (choice === "4") process.exit(await runCheck());
    if (choice === "5") process.exit(await runSpawn(["bun", "run", "build"]));

    console.error(`無効な選択です: ${choice}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function main() {
  const action = resolveHazySubcommand(process.argv.slice(2));
  switch (action.type) {
    case "menu":
      await interactiveMenu();
      break;
    case "doctor":
      runDoctor();
      break;
    case "help":
      printHelp();
      break;
    case "dev":
      process.exit(await runSpawn(resolveDevCommand(action.target, detectOpEnv())));
      break;
    case "db":
      process.exit(
        await runSpawn(["bun", "scripts/db-cli.ts", ...(action.subcommand ? [action.subcommand] : [])])
      );
      break;
    case "check":
      process.exit(await runCheck());
      break;
    case "build":
      process.exit(await runSpawn(["bun", "run", "build"]));
      break;
    case "unknown":
      console.error(`Unknown command: "${action.raw}". Run "bun run hazy help".`);
      process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
