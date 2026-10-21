#!/usr/bin/env python3
"""
WebKitGTK contract tests: run in the REAL engine of the Linux desktop
app (WebKitGTK via PyGObject), which Playwright's Chromium suite never
exercises. Each `*.js` case is an async function body that returns a
string; a case passes when every "| name: value" check it reports is
"true". Needs: python3-gobject, webkit2gtk-4.1, a display, and the dev
server (`npm run dev`) on http://localhost:5173.

Born from a WebKitGTK-only bug: there is no shadowRoot.getSelection()
in WebKit, so folio could not see the caret - the list button acted
on the last CLICKED paragraph and Tab never nested.
"""
import os, sys, glob, gi

os.environ.setdefault("WEBKIT_DISABLE_COMPOSITING_MODE", "1")
os.environ.setdefault("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gtk, WebKit2, GLib  # noqa: E402

BASE = os.environ.get("FOLIO_URL", "http://localhost:5173/")
here = os.path.dirname(os.path.abspath(__file__))
cases = sorted(glob.glob(os.path.join(here, "*.js")))
results = {}


def run_case(path, done):
    win = Gtk.OffscreenWindow()
    view = WebKit2.WebView()
    win.add(view)
    win.set_default_size(1280, 900)
    win.show_all()
    js = open(path).read()

    def finished(v, res):
        try:
            out = v.call_async_javascript_function_finish(res).to_string()
        except Exception as e:  # noqa: BLE001
            out = f"error: {e}"
        win.destroy()
        done(out)

    def go():
        view.call_async_javascript_function(js, -1, None, None, None, None, finished)
        return False

    def loaded(v, ev):
        if ev == WebKit2.LoadEvent.FINISHED:
            GLib.timeout_add(2500, go)

    view.connect("load-changed", loaded)
    view.load_uri(BASE)


def next_case(i=0):
    if i >= len(cases):
        Gtk.main_quit()
        return

    def done(out):
        results[os.path.basename(cases[i])] = out
        next_case(i + 1)

    run_case(cases[i], done)


GLib.timeout_add(120000, lambda: (print("TIMEOUT"), Gtk.main_quit()))
next_case()
Gtk.main()
failed = 0
for name, out in results.items():
    checks = [c.strip() for c in out.split("|") if ":" in c]
    ok = bool(checks) and all(c.endswith("true") for c in checks)
    failed += 0 if ok else 1
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"\n  {out}"))
if len(results) < len(cases):
    print("FAIL: not every case ran")
    failed += 1
sys.exit(1 if failed else 0)
