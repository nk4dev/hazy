import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// Monorepo root (hazy-repo/) — two levels up from apps/hazy/. Pin it so Next's
// output file tracing for the Cloudflare Workers bundle walks the hoisted
// workspace `node_modules`, not just apps/hazy/.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  reactCompiler: true,
  // Keep these out of the Turbopack server bundle. Turbopack copies shared
  // modules into every route chunk it feeds them to, and OpenNext then inlines
  // each chunk into the Worker — so zod + drizzle (imported by ~every route via
  // the db schema / env validation) landed in the bundle ~10× over, ~7 MiB of
  // pure duplication that pushed the Worker past Cloudflare's 3 MiB limit.
  // Externalized, esbuild bundles each exactly once in the final Worker.
  serverExternalPackages: ["zod", "drizzle-zod", "drizzle-orm"],
  // With drizzle-orm externalized, esbuild (not Turbopack) resolves
  // `drizzle-orm/postgres-js` / `neon-http`, which statically import `postgres`
  // and `@neondatabase/serverless`. Next only traces each package's Node entry,
  // not `postgres/cf/*` (the `workerd` export condition esbuild follows), so
  // force the whole packages in. Globs are project-relative; bun's hoisted
  // linker keeps these at the monorepo root.
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/postgres/**/*",
      "../../node_modules/@neondatabase/serverless/**/*",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default withNextIntl(nextConfig);

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
