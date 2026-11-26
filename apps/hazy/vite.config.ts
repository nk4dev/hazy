import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, "..", "..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: repoRoot,
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-tanstack": ["@tanstack/react-router", "@tanstack/react-query"],
          "vendor-i18n": ["i18next", "react-i18next"],
          "vendor-radix": ["radix-ui", "lucide-react"],
        },
      },
    },
  },
  server: {
    port: 3100,
    allowedHosts: ["pctunnel.nknighta.me"],
  },
  preview: {
    port: 3100,
  },
});
