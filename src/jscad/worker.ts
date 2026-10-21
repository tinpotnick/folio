/**
 * The JSCAD sandbox (ADR-0020). A document's JSCAD script is
 * arbitrary JavaScript and runs on OPEN (it is a figure, not a Run
 * button), so it never runs in the page: it runs here, in a worker
 * with no DOM, no access to the app or the desktop bridge, and - once
 * the doors below are shut - no network and no further scripts. The
 * page sends `{ id, source }` and gets back faces or an error message;
 * a script that runs too long is terminated by the page.
 */
import * as modeling from "@jscad/modeling";
import { evaluateJscad } from "./evaluate.js";

// Shut every door BEFORE any document code runs: documents render
// offline (non-negotiable #3), and a document must not reach out.
const scope = self as unknown as Record<string, unknown>;
for (const name of [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
  "indexedDB",
  "caches",
  "BroadcastChannel",
  "Worker",
  "SharedWorker",
]) {
  try {
    Object.defineProperty(scope, name, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  } catch {
    scope[name] = undefined;
  }
}

self.addEventListener(
  "message",
  (
    ev: MessageEvent<{
      id: number;
      source: string;
      params?: Record<string, unknown>;
    }>,
  ) => {
    const { id, source, params } = ev.data;
    try {
      const polygons = evaluateJscad(source, modeling, params ?? {});
      self.postMessage({ id, polygons });
    } catch (e) {
      self.postMessage({
        id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
);
