export const APPS = {
  api: { filter: "api", port: 8787, label: "hazy-api (Hono)" },
  hazy: { filter: "hazy", port: 3100, label: "hazy (Web)" },
  "hazy-note": { filter: "hazy-note", port: 3000, label: "hazy-note (Web)" },
  "hazy-dash": { filter: "hazy-dash", port: 3200, label: "hazy-dash (Web)" },
  "myblog-editor": { filter: "myblog-editor", port: 5173, label: "myblog-editor (Vite + :8788)" },
} as const;

export type AppKey = keyof typeof APPS;

export type HazyAction =
  | { type: "menu" }
  | { type: "doctor" }
  | { type: "dev"; target: "all" | AppKey }
  | { type: "db"; subcommand?: string }
  | { type: "check" }
  | { type: "build" }
  | { type: "help" };

export function resolveHazySubcommand(argv: string[]): HazyAction | { type: "unknown"; raw: string } {
  const [sub, arg] = argv;
  if (!sub) return { type: "menu" };
  if (sub === "doctor") return { type: "doctor" };
  if (sub === "check") return { type: "check" };
  if (sub === "build") return { type: "build" };
  if (sub === "help" || sub === "--help" || sub === "-h") return { type: "help" };
  if (sub === "db") return { type: "db", subcommand: arg };
  if (sub === "dev") {
    if (!arg || arg === "all") return { type: "dev", target: "all" };
    if (arg in APPS) return { type: "dev", target: arg as AppKey };
    return { type: "unknown", raw: `dev ${arg}` };
  }
  return { type: "unknown", raw: sub };
}

export function resolveDevCommand(target: "all" | AppKey, opEnv?: string): string[] {
  const base =
    target === "all" ? ["bun", "run", "dev"] : ["bun", "run", "dev", `--filter=${APPS[target].filter}`];
  return opEnv ? ["op", "run", `--env-file=${opEnv}`, "--", ...base] : base;
}
