/* folio's service worker (spec: docs/specs/web-files.md, "Open with
 * folio on the web"). Registering a worker with a fetch handler makes
 * the site installable as an app; the manifest's file_handlers then
 * let the OS launch the installed app with a .md file ("Open with
 * folio"). The app shell is cached on first fetch so the installed
 * app works offline; the big runtime payloads (/pyodide/, /repo/)
 * always go to the network. */
const CACHE = "folio-shell-v1";
const NETWORK_ONLY = /\/(pyodide|repo)\//;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || NETWORK_ONLY.test(url.pathname)) {
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() =>
            req.mode === "navigate"
              ? caches.match(new URL("index.html", self.registration.scope))
              : Response.error(),
          ),
    ),
  );
});
