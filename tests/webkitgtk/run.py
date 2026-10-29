#!/usr/bin/env python3
"""
WebKitGTK contract tests: run in the REAL engine of the Linux desktop
app (WebKitGTK via PyGObject), which Playwright's Chromium suite never
exercises. Each `*.js` case is an async function body that returns a
string; a case passes when every "| name: value" check it reports is
"true". A case whose first line is `// native-key: shift+ISO_Left_Tab`
(modifiers joined with +) gets that REAL GTK key press after its body
runs (several presses: separate them with spaces, e.g.
`// native-key: o n e Return Tab shift+ISO_Left_Tab`), and its result
is then read from `window.__folioCheck()` -
synthetic DOM events cannot catch how the engine names real keys. Needs: python3-gobject, webkit2gtk-4.1, a display, and the dev
server (`npm run dev`) on http://localhost:5173.

Headless by default: the windows open on a private GTK Broadway display
(`broadwayd`, part of GTK 3), drawn into a web page nobody opens - so
the suite never takes over the screen or the keyboard while you work.
FOLIO_WEBKITGTK_VISIBLE=1 shows them on your own display instead.
Name cases to run only those: `run.py help-panel shift-tab-native`.

Born from a WebKitGTK-only bug: there is no shadowRoot.getSelection()
in WebKit, so folio could not see the caret - the list button acted
on the last CLICKED paragraph and Tab never nested.
"""
import atexit, os, socket, subprocess, sys, glob, time, gi


def start_broadway():
    """A private Broadway display (GTK's own, invisible unless a browser
    opens its port): the first free one from :40. It must be set before
    GTK loads."""
    for n in range(40, 80):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", 8080 + n))
            except OSError:
                continue
        proc = subprocess.Popen(
            ["broadwayd", "--address", "127.0.0.1", f":{n}"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        atexit.register(proc.terminate)
        time.sleep(0.5)
        if proc.poll() is not None:
            continue
        os.environ["GDK_BACKEND"] = "broadway"
        os.environ["BROADWAY_DISPLAY"] = f":{n}"
        return
    sys.exit("no free Broadway display (:40-:79); set FOLIO_WEBKITGTK_VISIBLE=1")


HEADLESS = os.environ.get("FOLIO_WEBKITGTK_VISIBLE") != "1"
if HEADLESS:
    start_broadway()

os.environ.setdefault("WEBKIT_DISABLE_COMPOSITING_MODE", "1")
os.environ.setdefault("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
gi.require_version("Gdk", "3.0")
from gi.repository import Gtk, WebKit2, GLib, Gdk  # noqa: E402

# The guide, named: a bare address opens it only on the FIRST launch
# (the webview keeps localStorage between runs), and the cases expect
# its content.
BASE = os.environ.get("FOLIO_URL", "http://localhost:5173/?doc=demo/welcome.md")
here = os.path.dirname(os.path.abspath(__file__))
cases = sorted(glob.glob(os.path.join(here, "*.js")))
if sys.argv[1:]:
    wanted = {os.path.basename(a).removesuffix(".js") for a in sys.argv[1:]}
    cases = [c for c in cases if os.path.basename(c)[:-3] in wanted]
results = {}


# XKB keycodes (evdev + 8, a US layout) for the keys the cases press.
# Broadway's keymap reports each keyval AS its keycode (Tab is 65289,
# not 23), so the engine could not tell which physical key it was -
# and `code`, which folio reads for Tab (ISO_Left_Tab), came out empty.
XKB_CODES = {
    "Escape": 9, "BackSpace": 22, "Tab": 23, "ISO_Left_Tab": 23,
    "Return": 36, "space": 65, "F1": 67, "Home": 110, "Up": 111,
    "Left": 113, "Right": 114, "End": 115, "Down": 116,
    **{str(d % 10): 9 + d for d in range(1, 11)},
    **{c: i for row, start in (("qwertyuiop", 24), ("asdfghjkl", 38),
                               ("zxcvbnm", 52))
       for i, c in enumerate(row, start)},
}


def send_native(view, spec):
    """Press (and release) a real key, e.g. 'shift+ISO_Left_Tab'."""
    *mods, name = spec.split("+")
    keyval = Gdk.keyval_from_name(name)
    state = Gdk.ModifierType(0)
    for m in mods:
        state |= {"shift": Gdk.ModifierType.SHIFT_MASK,
                  "ctrl": Gdk.ModifierType.CONTROL_MASK}[m]
    keymap = Gdk.Keymap.get_for_display(Gdk.Display.get_default())
    ok, entries = keymap.get_entries_for_keyval(keyval)
    code = entries[0].keycode if ok and entries else None
    if HEADLESS:
        code = XKB_CODES.get(name)
        if code is None:
            sys.exit(f"native-key {name!r}: add its keycode to XKB_CODES")
    for t in (Gdk.EventType.KEY_PRESS, Gdk.EventType.KEY_RELEASE):
        ev = Gdk.Event.new(t)
        ev.key.window = view.get_window()
        ev.key.keyval = keyval
        ev.key.state = state
        if code is not None:
            ev.key.hardware_keycode = code
        ev.set_device(Gdk.Display.get_default().get_default_seat().get_keyboard())
        ev.key.time = Gdk.CURRENT_TIME
        Gtk.main_do_event(ev)


def run_case(path, done):
    # A real (offscreen-incapable) window: native key events need one.
    if HEADLESS:
        # Broadway leaves the screen's resolution unset (-1 dpi), and
        # WebKitGTK scaled the page by it: devicePixelRatio -1/96.
        Gdk.Screen.get_default().set_resolution(96.0)
    win = Gtk.Window()
    view = WebKit2.WebView()
    win.add(view)
    win.set_default_size(1280, 900)
    win.show_all()
    js = open(path).read()
    first = js.splitlines()[0] if js else ""
    native = first.split("native-key:", 1)[1].strip() if "native-key:" in first else None

    def finished(v, res):
        try:
            out = v.call_async_javascript_function_finish(res).to_string()
        except Exception as e:  # noqa: BLE001
            out = f"error: {e}"
        if native and not out.startswith("error"):
            view.grab_focus()
            presses = native.split()

            def press(i=0):
                if i >= len(presses):
                    GLib.timeout_add(600, check)
                    return False
                send_native(view, presses[i])
                GLib.timeout_add(120, press, i + 1)
                return False

            press()
            return
        win.destroy()
        done(out)

    def checked(v, res):
        try:
            out = v.call_async_javascript_function_finish(res).to_string()
        except Exception as e:  # noqa: BLE001
            out = f"error: {e}"
        win.destroy()
        done(out)

    def check():
        view.call_async_javascript_function(
            "return window.__folioCheck()", -1, None, None, None, None, checked)
        return False

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
