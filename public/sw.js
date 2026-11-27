/* folio's service worker (spec: docs/specs/web-files.md, "Open with
 * folio on the web"). Registering a worker with a fetch handler makes
 * the site installable as an app; the manifest's file_handlers then
 * let the OS launch the installed app with a .md file ("Open with
 * folio").
 *
 * What may change on the server is network-first, with the cache as
 * the offline fallback: the HTML entry (every deploy changes it) and
 * every .md document (the stats example is regenerated nightly - a
 * cache-first policy froze installed apps at their first-opened
 * snapshot, and the live numbers never reached them). The app shell
 * is content-hashed and immutable, so it stays cache-first; the big
 * runtime payloads (/pyodide/, /repo/) always go to the network.
 * CACHE was bumped to v2 so the v1 generation drops its frozen cache
 * when the new worker installs. */
const CACHE = "folio-shell-v2";
const NETWORK_ONLY = /\/(pyodide|repo)\//;
/* Network-first: the HTML entry and documents. */
const NETWORK_FIRST = (req) =>
  req.mode === "navigate" || /\.md$/i.test(new URL(req.url).pathname);

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
  if (NETWORK_FIRST(req)) {
    // The server's copy wins when the network answers; the cache only
    // serves offline (the installed app keeps working without a
    // connection).
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then(
              (hit) =>
                hit ??
                (req.mode === "navigate"
                  ? caches.match(new URL("index.html", self.registration.scope))
                  : Response.error()),
            ),
        ),
    );
    return;
  }
  // The hashed app shell: immutable, cache-first.
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
          .catch(() => Response.error()),
    ),
  );
});
