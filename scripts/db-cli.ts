import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

export type DbAction =
  | "status"
  | "migrate"
  | "all"
  | "migrate-hazy"
  | "migrate-blog"
  | "test"
  | "studio-hazy"
  | "studio-blog";

export function buildDbCommand(action: DbAction, opEnv?: string): { cmd: string[]; cwd?: string } {
  const opArgs = opEnv ? ["--op-env", opEnv] : [];

  switch (action) {
    case "status":
      return { cmd: ["bun", "scripts/migrate-all.ts", "--dry-run", ...opArgs] };
    case "migrate":
      return { cmd: ["bun", "scripts/migrate-all.ts", ...opArgs] };
    case "all":
      return {
        cmd: ["bun", "scripts/migrate-all.ts", "--with-triggers", "--with-crud-test", ...opArgs],
      };
    case "migrate-hazy":
      return {
        cmd: ["bun", "scripts/migrate-all.ts", "--only", "@repo/db", "--with-triggers", ...opArgs],
      };
    case "migrate-blog":
      return {
        cmd: ["bun", "scripts/migrate-all.ts", "--only", "myblog-editor", ...opArgs],
      };
    case "test":
      return { cmd: ["bun", "scripts/db-crud-test.ts", ...opArgs] };
    case "studio-hazy":
      return {
        cmd: opEnv
          ? ["op", "run", `--env-file=${opEnv}`, "--", "bun", "run", "db:studio"]
          : ["bun", "run", "db:studio"],
        cwd: "packages/db",
      };
    case "studio-blog":
      return {
        cmd: opEnv
          ? ["op", "run", `--env-file=${opEnv}`, "--", "bun", "run", "db:studio"]
          : ["bun", "run", "db:studio"],
        cwd: "myblog-editor-proto-1",
      };
  }
}

export function resolveSubcommand(arg: string | undefined): DbAction | null {
  switch (arg) {
    case "status":
      return "status";
    case "migrate":
      return "migrate";
    case "all":
      return "all";
    case "test":
      return "test";
    default:
      return null;
  }
}

function detectOpEnvFiles(repoRoot: string): string[] {
  const candidates = [".env.op", ".env.prod.op"];
  return candidates.filter((f) => existsSync(join(repoRoot, f)));
}

async function runAction(repoRoot: string, action: DbAction, opEnv?: string): Promise<number> {
  const { cmd, cwd } = buildDbCommand(action, opEnv);
  const proc = Bun.spawn(cmd, {
    cwd: cwd ? join(repoRoot, cwd) : repoRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });
  return proc.exited;
}

async function interactiveMenu(repoRoot: string) {
  const rl = createInterface({ input, output });
  try {
    console.log(`
╔══════════════════════════════════════════════╗
║           Hazy DB 管理 CLI (bun run db)      ║
╚══════════════════════════════════════════════╝
  1) 事前確認 (Dry Run)
  2) 全プロジェクト一括マイグレーション (@repo/db + myblog-editor)
  3) 一括マイグレーション + トリガー + CRUD テスト
  4) @repo/db のみマイグレーション (+ 検索トリガー)
  5) myblog-editor のみマイグレーション
  6) DB CRUD スモークテストのみ実行
  7) Drizzle Studio を起動 (@repo/db)
  8) Drizzle Studio を起動 (myblog-editor)
  0) 終了
`);

    const choice = (await rl.question("番号を選択してください [1]: ")).trim() || "1";
    const actionMap: Record<string, DbAction> = {
      "1": "status",
      "2": "migrate",
      "3": "all",
      "4": "migrate-hazy",
      "5": "migrate-blog",
      "6": "test",
      "7": "studio-hazy",
      "8": "studio-blog",
    };

    if (choice === "0") {
      console.log("終了します。");
      return;
    }

    const action = actionMap[choice];
    if (!action) {
      console.error(`無効な選択です: ${choice}`);
      process.exit(1);
    }

    const envFiles = detectOpEnvFiles(repoRoot);
    let selectedEnv: string | undefined;

    if (envFiles.length > 0) {
      console.log("\n使用する環境変数:");
      envFiles.forEach((f, idx) => {
        console.log(`  ${idx + 1}) 1Password (${f})`);
      });
      console.log(`  ${envFiles.length + 1}) 現在のシェル環境変数そのまま`);
      const envChoice = (await rl.question("番号を選択 [1]: ")).trim() || "1";
      const num = Number(envChoice);
      if (num >= 1 && num <= envFiles.length) {
        selectedEnv = envFiles[num - 1];
      }
    }

    const isProd = selectedEnv?.includes("prod");
    if (isProd && action !== "status") {
      const confirm = (
        await rl.question(`⚠️ 本番環境 (${selectedEnv}) に対して実行します。続行するには "yes" を入力: `)
      ).trim();
      if (confirm !== "yes") {
        console.log("キャンセルしました。");
        return;
      }
    }

    rl.close();
    const code = await runAction(repoRoot, action, selectedEnv);
    process.exit(code);
  } finally {
    rl.close();
  }
}

async function main() {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const sub = process.argv[2];

  if (sub) {
    const action = resolveSubcommand(sub);
    if (!action) {
      console.error(`Unknown subcommand "${sub}". Use: status | migrate | all | test (or no args for menu)`);
      process.exit(1);
    }
    const opEnv = existsSync(join(repoRoot, ".env.op")) ? ".env.op" : undefined;
    process.exit(await runAction(repoRoot, action, opEnv));
  }

  await interactiveMenu(repoRoot);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
