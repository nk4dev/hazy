import { dirname } from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // A stray package-lock.json above the repo (C:\Users\<user>\package-lock.json)
  // makes Next.js infer the wrong workspace root, which then affects output
  // file tracing for the Cloudflare Workers bundle — pin it explicitly.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  experimental: {
    reactCompiler: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default withNextIntl(nextConfig);

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
