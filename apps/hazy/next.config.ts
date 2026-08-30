import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// Monorepo root (hazy-repo/) — two levels up from apps/hazy/.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default withNextIntl(nextConfig);

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
