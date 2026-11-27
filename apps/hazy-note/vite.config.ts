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
      "@": rootDir,
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/react-router"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    // @ternlight/base/web loads a WASM binary via URL relative to its module; keep it out of pre-bundling.
    exclude: ["@ternlight/base"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-tanstack": ["@tanstack/react-router", "@tanstack/react-query"],
          "vendor-quill": ["quill", "quilljs-markdown"],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
});
