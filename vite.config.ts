import { cpSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

/** The host page fetches the demo content (`/demo/...` - the boot
 * document, examples, help, data) at runtime: vite serves it from
 * the repo root in dev, but a build must carry it into dist/ or a
 * packaged desktop app boots with an empty document. */
function copyDemo(): Plugin {
  return {
    name: "copy-demo",
    apply: "build",
    closeBundle() {
      cpSync(path.resolve(__dirname, "demo"), path.resolve(__dirname, "dist/demo"), {
        recursive: true,
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@folio": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html",
      output: {
        format: "es",
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    outDir: path.resolve(__dirname, "dist"),
  },
  plugins: [copyDemo()],
});
