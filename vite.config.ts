import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: "demo",
  publicDir: false,
  resolve: {
    alias: {
      "@folio": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: "demo/index.html",
      output: {
        format: "es",
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    outDir: path.resolve(__dirname, "dist"),
  },
  plugins: [],
});
