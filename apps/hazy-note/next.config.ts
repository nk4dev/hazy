import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Monorepo root (hazy-repo/) — two levels up. Pin it so Next's output file
// tracing for the Cloudflare Workers bundle walks the hoisted workspace
// node_modules, not just apps/hazy-note/.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export default function config(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    outputFileTracingRoot: repoRoot,

    // Keep the dev build indicator out of the sidebar's bottom-left corner.
    devIndicators: { position: "bottom-right" },

    // Externalize the DB stack from the server bundle **for the Worker build
    // only** — see apps/hazy for the full story. Turbopack's dev server can't
    // resolve a package externalized through a workspace package (`@repo/db`).
    serverExternalPackages: isDev ? [] : ["drizzle-orm", "@neondatabase/serverless"],

    // esbuild resolves the externalized `drizzle-orm/postgres-js` / `neon-http`,
    // which statically import `postgres` and `@neondatabase/serverless`. Next
    // only traces each package's Node entry, not `postgres/cf/*` (the `workerd`
    // export condition esbuild follows), so force the whole packages in. Globs
    // are project-relative; bun's hoisted linker keeps these at the monorepo root.
    outputFileTracingIncludes: {
      "/**": [
        "../../node_modules/postgres/**/*",
        "../../node_modules/@neondatabase/serverless/**/*",
      ],
    },
  };
}

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
