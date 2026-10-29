import { cpSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { createReadStream, statSync } from "node:fs";

/** The host page fetches the demo content (`/demo/...` - the boot
 * document, examples, help, data) at runtime: vite serves it from
 * the repo root in dev, but a build must carry it into dist/ or a
 * packaged desktop app boots with an empty document. */
function copyDemo(): Plugin {
  return {
    name: "copy-demo",
    apply: "build",
    closeBundle() {
      cpSync(
        path.resolve(__dirname, "demo"),
        path.resolve(__dirname, "dist/demo"),
        {
          recursive: true,
        },
      );
    },
  };
}

/** The Python runtime (ADR-0030) is static files served under
 * `/pyodide/` - the page computes that URL from its own base, so
 * the root, a subfolder (GitHub Pages, /folio/) and the desktop
 * app all find it. A build copies the package's dist; dev serves
 * it straight from node_modules. Nothing is fetched at run time
 * from anywhere else (ADR-0005). */
const pyodideDist = path.resolve(__dirname, "node_modules/pyodide");

/** Dev: serve `/pyodide/*` straight from node_modules. Its own plugin,
 * `apply: "serve"` - it shared one with the build copy under
 * `apply: "build"`, so the dev server never served the runtime: every
 * `/pyodide/` request fell through to index.html and Python never
 * started (`npm run dev`, the desktop app's tauri dev, the e2e). */
function servePyodide(): Plugin {
  const MIME: Record<string, string> = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".wasm": "application/wasm",
    ".json": "application/json",
    ".a": "application/octet-stream",
    ".data": "application/octet-stream",
  };
  return {
    name: "serve-pyodide",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/pyodide/")) {
          next();
          return;
        }
        const rel = url.slice("/pyodide/".length).split("?")[0] ?? "";
        const file = path.join(pyodideDist, rel);
        if (
          !file.startsWith(pyodideDist + path.sep) ||
          !statSync(file, { throwIfNoEntry: false })?.isFile()
        ) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader(
          "content-type",
          MIME[path.extname(file)] ?? "application/octet-stream",
        );
        createReadStream(file).pipe(res);
      });
    },
  };
}

/** Build: copy the runtime to dist/pyodide, beside the page. */
function copyPyodide(): Plugin {
  return {
    name: "copy-pyodide",
    apply: "build",
    closeBundle() {
      cpSync(pyodideDist, path.resolve(__dirname, "dist/pyodide"), {
        recursive: true,
      });
    },
  };
}

export default defineConfig({
  // Relative asset URLs: one build serves from "/", a subfolder
  // (GitHub Pages, /folio/) and the desktop app alike.
  base: "./",
  resolve: {
    alias: {
      "@folio": path.resolve(__dirname, "./src"),
    },
  },
  // The compute worker (ADR-0030) lazy-imports pyodide, so its
  // chunk splits: workers must build as ES modules, not IIFE.
  worker: { format: "es" },
  // Pyodide loads its own files at run time; pre-bundling it is what
  // its docs say not to do - and a cold dev server found it late (in
  // the compute worker), re-optimized and RELOADED the page, so the
  // first compute test on a fresh CI runner timed out.
  optimizeDeps: { exclude: ["pyodide"] },
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
  plugins: [copyDemo(), servePyodide(), copyPyodide()],
});
