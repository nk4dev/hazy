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
  // Remote debugging through the Cloudflare tunnel (pctunnel.nknighta.me).
  allowedDevOrigins: ["pctunnel.nknighta.me"],
  // Dev behind the Cloudflare tunnel: the edge caches .js chunks (and adds a 4h
  // browser TTL), so stale bundles cause hydration mismatches. `no-store` keeps
  // Cloudflare from caching them.
  // A fresh id per dev-server start appends `?dpl=…` to static asset URLs, so a
  // browser holding chunks from an earlier run is forced to refetch them.
  deploymentId: process.env.NODE_ENV === "production" ? undefined : `dev-${Date.now()}`,
  async headers() {
    // The "Connect with Hazy" approval page must never be framed by another
    // site (clickjacking the Connect button would hand out an `hz_…` token).
    const noFraming = {
      source: "/:locale/connector/add",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    };
    if (process.env.NODE_ENV === "production") return [noFraming];
    return [
      noFraming,
      {
        source: "/_next/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
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
