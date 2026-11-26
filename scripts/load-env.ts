import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Loads env files into `process.env` in priority order (already-set keys win):
 * 1. Shell environment variables (already in `process.env`)
 * 2. Optional package-local overrides in `localDir` (`.env.local`, `.dev.vars`, `.env`)
 * 3. Monorepo root `.env.local`
 * 4. Monorepo root `.env`
 */
export function loadMonorepoEnv(localDir?: string): void {
  const candidates = [
    ...(localDir
      ? [join(localDir, ".env.local"), join(localDir, ".dev.vars"), join(localDir, ".env")]
      : []),
    join(REPO_ROOT, ".env.local"),
    join(REPO_ROOT, ".env"),
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
    }
  }
}
