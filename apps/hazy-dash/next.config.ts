import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Monorepo root — two levels up from apps/hazy-dash/.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  reactCompiler: true,
  // Remote debugging through the Cloudflare tunnel (pctunnel-dash.nknighta.me),
  // same setup as apps/hazy.
  allowedDevOrigins: ["pctunnel-dash.nknighta.me"],
  // The edge caches .js/.css with a long browser TTL; a fresh id per dev start
  // plus `no-store` keeps phones from running stale bundles.
  deploymentId: process.env.NODE_ENV === "production" ? undefined : `dev-${Date.now()}`,
  async headers() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/_next/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
