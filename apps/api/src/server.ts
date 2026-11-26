import "./load-env";
import { serve } from "@hono/node-server";
import { createApp } from "@/app";

// Local dev entry: plain Node (via tsx), so a `127.0.0.1` DATABASE_URL uses the
// postgres.js TCP driver natively. `process.env` is populated from root `.env.local`
// / `.env` (and optional `apps/api/.dev.vars`).
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`hazy-api listening on http://localhost:${info.port}`);
});
