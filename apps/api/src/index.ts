import { createApp } from "@/app";

// Cloudflare Workers entry. `process.env` is populated from wrangler
// vars/secrets (nodejs_compat + compat date 2026-08-14).
export default createApp();
