import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Monorepo root (hazy-repo/) — two levels up. Pin it so Next's output file
// tracing for the Cloudflare Workers bundle walks the hoisted workspace
// node_modules, not just apps/hazy-note/.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,

  // Keep the dev build indicator out of the sidebar's bottom-left corner.
  devIndicators: { position: "bottom-right" },

  // Externalize the DB stack from the server bundle so OpenNext/esbuild bundles
  // each package once in the final Worker instead of the ~10× duplication the
  // bundler would otherwise inline per route (see apps/hazy for the full story).
  serverExternalPackages: ["drizzle-orm", "@neondatabase/serverless"],

  // esbuild resolves the externalized `drizzle-orm/postgres-js` / `neon-http`,
  // which statically import `postgres` and `@neondatabase/serverless`. Next only
  // traces each package's Node entry, not `postgres/cf/*` (the `workerd` export
  // condition esbuild follows), so force the whole packages in. Globs are
  // project-relative; bun's hoisted linker keeps these at the monorepo root.
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/postgres/**/*",
      "../../node_modules/@neondatabase/serverless/**/*",
    ],
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
