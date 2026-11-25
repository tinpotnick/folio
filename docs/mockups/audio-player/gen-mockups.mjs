// Mock-up generator for the audio player design exploration
// (docs/mockups/audio-player/README.md). Renders hand-drawn SVG
// scenes of the document view to PNG with the real default-theme
// palettes (src/render/theme.ts DEFAULT_THEME + CHROME) and the
// repo's own bundled faces (Source Serif 4, Inter).
//
// Regenerate (from this directory, repo root has node_modules):
//   npm i --no-save @resvg/resvg-js wawoff2 @fontsource/source-serif-4 @fontsource/inter
//   node gen-mockups.mjs
// The script decodes the @fontsource woff2 files to fonts/*.ttf on
// first run (fonts/ is gitignored - the PNGs are the artifact).
import { Resvg } from "@resvg/resvg-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const F = { serif: "Source Serif 4", ui: "Inter" };
const FONT_MAP = [
  ["ss4-400.ttf", "@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2"],
  ["ss4-400i.ttf", "@fontsource/source-serif-4/files/source-serif-4-latin-400-italic.woff2"],
  ["ss4-600.ttf", "@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff2"],
  ["ss4-700.ttf", "@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff2"],
  ["inter-400.ttf", "@fontsource/inter/files/inter-latin-400-normal.woff2"],
  ["inter-500.ttf", "@fontsource/inter/files/inter-latin-500-normal.woff2"],
  ["inter-600.ttf", "@fontsource/inter/files/inter-latin-600-normal.woff2"],
  ["inter-700.ttf", "@fontsource/inter/files/inter-latin-700-normal.woff2"],
];

async function prepFonts() {
  const dir = join(HERE, "fonts");
  mkdirSync(dir, { recursive: true });
  const missing = FONT_MAP.filter(([ttf]) => !existsSync(join(dir, ttf)));
  if (missing.length > 0) {
    const wawoff2 = require("wawoff2");
    for (const [ttf, woff2] of missing) {
      const src = join(HERE, "../../..", "node_modules", woff2);
      writeFileSync(join(dir, ttf), Buffer.from(await wawoff2.decompress(readFileSync(src))));
    }
  }
  return FONT_MAP.map(([ttf]) => join(dir, ttf));
}

// Default theme (src/render/theme.ts DEFAULT_THEME) + CHROME, plus
// the web app's own desk/surface tones.
const LIGHT = {
  bg: "#f3f4f6", surface: "#ffffff", border: "#e4e6ea", borderStrong: "#d0d7de",
  text: "#1f2328", muted: "#57606a",
  paper: "#ffffff", ink: "#1f2328", inkMuted: "#5c636b", heading: "#14171a",
  accent: "#2f4fb5", hairline: "#e6e8eb", rule: "#1f2328", tint: "#f5f6f8", surface2: "#fafbfc",
  inputBg: "#ffffff", focus: "#1f3fbf", hover: "#f3f4f6",
  pageShadow: "rgba(15,23,42,.10)",
  activeBg: "#1f2328", activeFg: "#ffffff",
};
const DARK = {
  bg: "#111113", surface: "#18181b", border: "#26262a", borderStrong: "#3f3f46",
  text: "#e4e4e7", muted: "#9a9aa2",
  paper: "#1c1c1f", ink: "#e6e4df", inkMuted: "#a19e98", heading: "#f4f2ed",
  accent: "#9db4ff", hairline: "#2e2e32", rule: "#8a8780", tint: "#252529", surface2: "#1f1f23",
  inputBg: "#18181b", focus: "#9db4ff", hover: "#2a2a2f",
  pageShadow: "rgba(0,0,0,.55)",
  activeBg: "#e4e4e7", activeFg: "#18181b",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r = (x, y, w, h, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const rr = (x, y, w, h, fill, rx, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const circ = (cx, cy, rad, fill, extra = "") => `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${fill}" ${extra}/>`;
const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${o.f || F.serif}" font-size="${o.s || 17}" fill="${o.c || "#000"}" text-anchor="${o.a || "start"}"${o.w ? ` font-weight="${o.w}"` : ""}${o.i ? ` font-style="italic"` : ""}${o.ls ? ` letter-spacing="${o.ls}"` : ""}${o.o ? ` opacity="${o.o}"` : ""}>${esc(s)}</text>`;
const line = (x1, y1, x2, y2, stroke, sw = 1, extra = "") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
const path = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
const icon = (name, s, c, x, y) => `<g transform="translate(${x},${y})">${ICONS[name](s, c)}</g>`;

const ICONS = {
  play: (s, c) => path(`M${s * 0.3} ${s * 0.16}v${s * 0.68}l${s * 0.56}-${s * 0.34}z`, c),
  pause: (s, c) => r(s * 0.26, s * 0.18, s * 0.2, s * 0.64, c) + r(s * 0.56, s * 0.18, s * 0.2, s * 0.64, c),
  volume: (s, c) => `<path d="M${s * 0.1} ${s * 0.36}h${s * 0.18}l${s * 0.26}-${s * 0.22}v${s * 0.72}l-${s * 0.26}-${s * 0.22}h-${s * 0.18}z" fill="${c}"/><path d="M${s * 0.6} ${s * 0.34}a${s * 0.34} ${s * 0.34} 0 0 1 0 ${s * 0.32}M${s * 0.72} ${s * 0.22}a${s * 0.54} ${s * 0.54} 0 0 1 0 ${s * 0.56}" stroke="${c}" stroke-width="${s * 0.09}" fill="none" stroke-linecap="round"/>`,
  download: (s, c) => `<g stroke="${c}" stroke-width="${s * 0.11}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M${s * 0.5} ${s * 0.1}v${s * 0.5}M${s * 0.28} ${s * 0.4}l${s * 0.22} ${s * 0.22} ${s * 0.22}-${s * 0.22}"/><path d="M${s * 0.14} ${s * 0.72}v${s * 0.14}a${s * 0.08} ${s * 0.08} 0 0 0 ${s * 0.08} ${s * 0.08}h${s * 0.64}a${s * 0.08} ${s * 0.08} 0 0 0 ${s * 0.08}-${s * 0.08}v-${s * 0.14}"/></g>`,
  mic: (s, c) => `<g stroke="${c}" stroke-width="${s * 0.11}" fill="none" stroke-linecap="round"><rect x="${s * 0.37}" y="${s * 0.06}" width="${s * 0.26}" height="${s * 0.5}" rx="${s * 0.13}" fill="${c}" stroke="none"/><path d="M${s * 0.2} ${s * 0.46}a${s * 0.3} ${s * 0.3} 0 0 0 ${s * 0.6} 0"/><line x1="${s * 0.5}" y1="${s * 0.76}" x2="${s * 0.5}" y2="${s * 0.94}"/></g>`,
  note: (s, c) => `<path d="M${s * 0.62} ${s * 0.12}v${s * 0.56}a${s * 0.16} ${s * 0.12} 0 1 1-${s * 0.32} 0V${s * 0.3}l-${s * 0.3}-${s * 0.08}v${s * 0.44}a${s * 0.16} ${s * 0.12} 0 1 1-${s * 0.32} 0z" fill="${c}"/>`,
  grid: (s, c) => `<g stroke="${c}" stroke-width="${s * 0.09}" fill="none"><rect x="${s * 0.12}" y="${s * 0.12}" width="${s * 0.76}" height="${s * 0.76}" rx="${s * 0.08}"/><line x1="${s * 0.12}" y1="${s * 0.5}" x2="${s * 0.88}" y2="${s * 0.5}"/><line x1="${s * 0.5}" y1="${s * 0.12}" x2="${s * 0.5}" y2="${s * 0.88}"/></g>`,
  chart: (s, c) => `<g fill="${c}"><rect x="${s * 0.14}" y="${s * 0.5}" width="${s * 0.18}" height="${s * 0.36}" rx="${s * 0.04}"/><rect x="${s * 0.42}" y="${s * 0.28}" width="${s * 0.18}" height="${s * 0.58}" rx="${s * 0.04}"/><rect x="${s * 0.7}" y="${s * 0.12}" width="${s * 0.18}" height="${s * 0.74}" rx="${s * 0.04}"/></g>`,
  image: (s, c) => `<g stroke="${c}" stroke-width="${s * 0.09}" fill="none" stroke-linejoin="round" stroke-linecap="round"><rect x="${s * 0.12}" y="${s * 0.16}" width="${s * 0.76}" height="${s * 0.68}" rx="${s * 0.1}"/><circle cx="${s * 0.36}" cy="${s * 0.38}" r="${s * 0.07}" fill="${c}" stroke="none"/><path d="M${s * 0.18} ${s * 0.74}l${s * 0.2}-${s * 0.2} ${s * 0.14} ${s * 0.14} ${s * 0.16}-${s * 0.16} ${s * 0.14} ${s * 0.14}"/></g>`,
  chev: (s, c) => `<path d="M${s * 0.25} ${s * 0.38}l${s * 0.25} ${s * 0.25} ${s * 0.25}-${s * 0.25}" stroke="${c}" stroke-width="${s * 0.13}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  check: (s, c) => `<path d="M${s * 0.16} ${s * 0.54}l${s * 0.24} ${s * 0.24}L${s * 0.86} ${s * 0.2}" stroke="${c}" stroke-width="${s * 0.15}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  scissors: (s, c) => `<g stroke="${c}" stroke-width="${s * 0.1}" fill="none" stroke-linecap="round"><circle cx="${s * 0.26}" cy="${s * 0.3}" r="${s * 0.14}"/><circle cx="${s * 0.26}" cy="${s * 0.72}" r="${s * 0.14}"/><path d="M${s * 0.38} ${s * 0.38}L${s * 0.86} ${s * 0.82}M${s * 0.38} ${s * 0.64}L${s * 0.86} ${s * 0.2}"/></g>`,
  speaker: (s, c) => `<path d="M${s * 0.1} ${s * 0.36}h${s * 0.18}l${s * 0.26}-${s * 0.22}v${s * 0.72}l-${s * 0.26}-${s * 0.22}h-${s * 0.18}z" fill="${c}"/><path d="M${s * 0.6} ${s * 0.34}a${s * 0.34} ${s * 0.34} 0 0 1 0 ${s * 0.32}" stroke="${c}" stroke-width="${s * 0.09}" fill="none" stroke-linecap="round"/>`,
};

function mix(a, b, f) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * f).toString(16).padStart(2, "0")).join("");
}

/* Deterministic organic-looking waveform peaks, 0..1. */
function peak(i) {
  const v = Math.abs(Math.sin(i * 0.9) + 0.55 * Math.sin(i * 2.3 + 1.7) + 0.3 * Math.sin(i * 5.1 + 0.4));
  return Math.min(1, 0.18 + 0.82 * (v / 1.85));
}

function waveform(P, x0, x1, yMid, maxH, progress, opts = {}) {
  let s = "";
  const step = 5, bw = 3;
  const n = Math.floor((x1 - x0) / step);
  const inSel = opts.sel ? (f) => f >= opts.sel[0] && f <= opts.sel[1] : null;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const x = x0 + i * step;
    const h = 3 + maxH * peak(i * 1.7 + (opts.seed || 0));
    let c = mix(P.inkMuted, P.paper, 0.45);
    if (f <= progress) c = P.accent;
    let extra = "";
    if (inSel) {
      if (inSel(f)) c = f <= progress ? P.accent : mix(P.accent, P.paper, 0.45);
      else extra = ` opacity="0.35"`;
    }
    s += rr(x, yMid - h / 2, bw, h, c, 1.5, extra);
  }
  if (progress > 0 && progress < 1) {
    const px = x0 + progress * (x1 - x0);
    s += line(px, yMid - maxH / 2 - 4, px, yMid + maxH / 2 + 4, P.accent, 2);
  }
  if (opts.sel) {
    const [a, b] = opts.sel;
    const sx0 = x0 + a * (x1 - x0), sx1 = x0 + b * (x1 - x0);
    for (const hx of [sx0, sx1]) {
      s += rr(hx - 1.5, yMid - maxH / 2 - 6, 3, maxH + 12, P.accent, 1.5);
      s += circ(hx, yMid, 5, P.paper, `stroke="${P.accent}" stroke-width="2"`);
    }
    s += rr(sx0, yMid - maxH / 2 - 6, sx1 - sx0, maxH + 12, P.accent, 4, `opacity="0.12"`);
  }
  return s;
}

/* --- app chrome ---------------------------------------------------- */

function toolbar(P, opts = {}) {
  const h = 57;
  let s = r(0, 0, 1280, h, P.surface) + line(0, h, 1280, h, P.border);
  s += t(24, 37, "folio", { f: F.serif, s: 21, c: P.text, w: 700 });
  s += t(92, 36, "interview-notes.md", { f: F.ui, s: 13, c: P.muted });
  // view switch
  let x = 400;
  s += rr(x, 10, 148, 36, P.surface, 8, `stroke="${P.border}" stroke-width="1"`);
  s += rr(x + 3, 13, 82, 30, P.activeBg, 6);
  s += t(x + 14, 33, "Document", { f: F.ui, s: 12.5, c: P.activeFg, w: 500 });
  s += icon("chev", 10, P.activeFg, x + 66, 23);
  s += t(x + 94, 33, "Source", { f: F.ui, s: 12.5, c: P.muted });
  x += 156;
  // B I S
  s += rr(x, 10, 110, 36, P.surface, 8, `stroke="${P.border}" stroke-width="1"`);
  s += t(x + 22, 33, "B", { f: F.ui, s: 13.5, c: P.text, w: 700 });
  s += t(x + 56, 33, "I", { f: F.ui, s: 13.5, c: P.text, i: true });
  s += t(x + 84, 33, "S", { f: F.ui, s: 13.5, c: P.text });
  s += line(x + 80, 35, x + 90, 35, P.text, 1.2);
  x += 118;
  // insert button (+ the insert icon group it replaces while open)
  const ix = x;
  if (opts.insertOpen) {
    s += rr(ix, 10, 92, 36, P.hover, 8, `stroke="${P.borderStrong}" stroke-width="1"`);
    s += t(ix + 12, 33, "Insert", { f: F.ui, s: 12.5, c: P.text, w: 600 });
    s += icon("chev", 9, P.text, ix + 56, 24);
  } else {
    s += rr(ix, 10, 92, 36, P.surface, 8, `stroke="${P.border}" stroke-width="1"`);
    s += t(ix + 12, 33, "Insert", { f: F.ui, s: 12.5, c: P.muted });
    s += icon("chev", 9, P.muted, ix + 56, 24);
    x += 100;
    s += rr(x, 10, 4 * 34 + 8, 36, P.surface, 8, `stroke="${P.border}" stroke-width="1"`);
    let bx = x + 4;
    for (const [ic, c] of [["grid", P.muted], ["chart", P.muted], ["note", P.muted], ["mic", P.muted]]) {
      s += icon(ic, 16, c, bx + 9, 20);
      bx += 34;
    }
  }
  return { s, h, insertX: ix };
}

function insertMenu(P, mx) {
  const items = [
    { h: "Data" },
    { label: "Dataset (typed, with formulas)", ic: "grid" },
    { label: "Chart from a dataset", ic: "chart" },
    { label: "Heatmap chart", ic: "chart" },
    { label: "Vega-Lite chart", ic: "chart" },
    { label: "Import data…", ic: "download" },
    { h: "Media" },
    { label: "Image", ic: "image" },
    { label: "Audio clip", ic: "speaker", hover: true },
    { label: "Record audio", ic: "mic" },
    { h: "Technical" },
    { label: "Equation" },
    { label: "Code block" },
    { label: "Mermaid diagram" },
  ];
  let h = 8;
  const rows = [];
  for (const it of items) {
    if (it.h) { rows.push({ ...it, y: h }); h += 26; }
    else { rows.push({ ...it, y: h }); h += 30; }
  }
  h += 8;
  let s = `<filter id="msh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-opacity="0.14"/></filter>`;
  s += rr(mx, 63, 264, h, P.surface, 10, `stroke="${P.border}" stroke-width="1" filter="url(#msh)"`);
  let y = 63 + 8;
  for (const row of rows) {
    if (row.h) {
      s += t(mx + 14, y + 16, row.h.toUpperCase(), { f: F.ui, s: 10.5, c: P.muted, ls: "0.06em", w: 600 });
      y += 26;
    } else {
      if (row.hover) s += rr(mx + 4, y, 256, 30, P.hover, 6);
      if (row.ic) s += icon(row.ic, 15, row.hover ? P.text : P.muted, mx + 14, y + 7.5);
      s += t(mx + 38, y + 20, row.label, { f: F.ui, s: 13, c: row.hover ? P.text : P.ink, w: row.hover ? 500 : 400 });
      y += 30;
    }
  }
  return s;
}

/* --- doc page ------------------------------------------------------ */

function page(P, tb, contentSvg, contentH, extra = "") {
  let s = r(0, 0, 1280, 10000, P.bg);
  s += tb.s;
  const top = tb.h + 34;
  const pw = 720, px = (1280 - pw) / 2;
  const padT = 56, padX = 72, padB = 72;
  const pageH = Math.max(contentH + padT + padB, 620);
  s += `<filter id="psh" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="${P === LIGHT ? "#0f172a" : "#000"}" flood-opacity="${P === LIGHT ? 0.1 : 0.55}"/></filter>`;
  s += rr(px, top, pw, pageH, P.paper, 3, `stroke="${P === LIGHT ? "rgba(15,23,42,.06)" : "rgba(0,0,0,.5)"}" stroke-width="1" filter="url(#psh)"`);
  const cx = px + padX, cw = pw - padX * 2;
  s += `<g transform="translate(${cx},${top + padT})">${contentSvg(cw)}</g>`;
  s += extra;
  return { s, h: top + pageH + 60 };
}

function docIntro(P) {
  return (cw) => {
    let s = t(0, 44, "Founders interview", { s: 37, c: P.heading, w: 700 });
    s += t(0, 88, "The opening answer is on tape; the rest is written up below.", { s: 17, c: P.ink });
    s += t(0, 116, "Take two sounds better, so that is the one embedded here.", { s: 17, c: P.ink });
    return { s, y: 150 };
  };
}

function docOutro(P, y) {
  return t(0, y, "Answers two through five are transcribed in the appendix.", { s: 17, c: P.ink });
}

/* --- the audio figure, variant builders ---------------------------- */

function inspectorBar(P, cw, opts = {}) {
  const h = 56;
  let s = rr(0, 0, cw, h, P.surface2, 8, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += t(10, 16, "ALT TEXT", { f: F.ui, s: 10.5, c: P.inkMuted, ls: "0.05em" });
  s += rr(10, 22, 200, 26, P.inputBg, 6, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += t(18, 39, "the founder, on tape", { f: F.ui, s: 12, c: P.ink });
  s += t(222, 16, "CAPTION", { f: F.ui, s: 10.5, c: P.inkMuted, ls: "0.05em" });
  const capW = cw - 222 - 196;
  s += rr(222, 22, capW, 26, P.inputBg, 6, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += t(230, 39, "Founders interview, take two", { f: F.ui, s: 12, c: P.ink });
  s += rr(cw - 186, 22, 176, 26, P.inputBg, 6, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += icon("download", 12, P.inkMuted, cw - 176, 28);
  s += t(cw - 158, 39, "Replace file…", { f: F.ui, s: 12, c: P.ink });
  if (opts.trimBtn) {
    // proposed: an editing affordance on the same uniform bar
  }
  return { s, h: h + 8 };
}

function labelStrip(P, text) {
  return { s: icon("speaker", 13, P.inkMuted, 0, 1) + t(20, 12, text, { f: F.ui, s: 12, c: P.inkMuted }), h: 22 };
}

/** The speed chip that lives at the right edge of the card. */
function speedChip(P, x, cy, label, open) {
  let s = rr(x, cy - 11, 44, 22, open ? P.hover : P.inputBg, 11, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += t(x + 15, cy + 4, label, { f: F.ui, s: 11.5, c: P.ink, w: 600 });
  s += icon("chev", 8, P.inkMuted, x + 29, cy - 4);
  return s;
}

function speedPopover(P, x, topY, selected) {
  const pw = 96, ph = 5 * 24 + 10, px = x + 22 - pw, py = topY - ph - 8;
  let s = `<filter id="psh3" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.16"/></filter>`;
  s += rr(px, py, pw, ph, P.surface, 8, `stroke="${P.borderStrong}" stroke-width="1" filter="url(#psh3)"`);
  for (const [i, sp] of ["0.75×", "1×", "1.25×", "1.5×", "2×"].entries()) {
    const iy = py + 5 + i * 24;
    if (sp === selected) {
      s += rr(px + 4, iy, pw - 8, 24, mix(P.accent, P.paper, 0.9), 5);
      s += icon("check", 10, P.accent, px + 9, iy + 7);
      s += t(px + 25, iy + 16, sp, { f: F.ui, s: 12, c: P.accent, w: 600 });
    } else {
      s += t(px + 25, iy + 16, sp, { f: F.ui, s: 12, c: P.ink });
    }
  }
  return s;
}

/** Variant A: SoundCloud-style waveform card, with a speed chip. */
function cardWaveform(P, cw, { playing, progress, current, total, speed = "1×", speedOpen = false }) {
  const h = 92;
  let s = rr(0, 0, cw, h, P.tint, 12, `stroke="${P.hairline}" stroke-width="1"`);
  const cy = h / 2;
  s += circ(34, cy, 23, P.accent);
  s += icon(playing ? "pause" : "play", 20, P.paper, 34 - 10 + (playing ? 0 : 1.5), cy - 10);
  s += waveform(P, 74, cw - 152, cy, 40, playing ? progress : 0);
  s += t(cw - 62, cy + 4.5, `${current} / ${total}`, { f: F.ui, s: 13, c: P.inkMuted, a: "end" });
  s += speedChip(P, cw - 52, cy, speed, speedOpen);
  if (speedOpen) s += speedPopover(P, cw - 52, 0, speed);
  return { s, h: h + 12 };
}

/** Variant B: compact themed strip (the native player's shape, themed).
 * compact drops volume for narrow containers. */
function stripCompact(P, cw, { playing, progress, current, total, compact = false }) {
  const h = 46;
  let s = rr(0, 0, cw, h, P.surface, 23, `stroke="${P.hairline}" stroke-width="1"`);
  const cy = h / 2;
  s += circ(27, cy, 15, mix(P.accent, P.paper, 0.88));
  s += icon(playing ? "pause" : "play", 13, P.accent, 27 - 6.5 + (playing ? 0 : 1), cy - 6.5);
  const tx0 = 52, tx1 = cw - (compact ? 116 : 200);
  s += rr(tx0, cy - 2.5, tx1 - tx0, 5, mix(P.inkMuted, P.paper, 0.5), 2.5);
  const pw = (tx1 - tx0) * (playing ? progress : 0);
  if (pw > 0) {
    s += rr(tx0, cy - 2.5, pw, 5, P.accent, 2.5);
    s += circ(tx0 + pw, cy, 5, P.accent);
  }
  s += t(tx1 + 12, cy + 4.5, compact ? current : `${current} / ${total}`, { f: F.ui, s: 12.5, c: P.inkMuted });
  if (!compact) {
    s += line(cw - 128, cy - 12, cw - 128, cy + 12, P.hairline, 1);
    s += icon("volume", 15, P.inkMuted, cw - 114, cy - 7.5);
    s += rr(cw - 94, cy - 2, 42, 4, mix(P.inkMuted, P.paper, 0.5), 2);
    s += rr(cw - 94, cy - 2, 30, 4, P.inkMuted, 2);
  }
  s += rr(cw - 44, cy - 11, 36, 22, P.tint, 11, `stroke="${P.hairline}" stroke-width="1"`);
  s += t(cw - 26, cy + 4, "1×", { f: F.ui, s: 11.5, c: P.ink, a: "middle", w: 500 });
  return { s, h: h + 12 };
}

/** Narrowest tier: a chip (play/pause + duration) for table cells etc. */
function chipPlayer(P, w, { playing, label, accent = false }) {
  const h = 26;
  let s = rr(0, 0, w, h, accent ? mix(P.accent, P.paper, 0.88) : P.tint, 13, `stroke="${accent ? P.accent : P.hairline}" stroke-width="${accent ? 1.2 : 1}"`);
  s += icon(playing ? "pause" : "play", 12, P.accent, 8, 7);
  s += t(26, 17.5, label, { f: F.ui, s: 11.5, c: P.ink, w: 500 });
  return { s, h: h + 10 };
}

/** Variant C: waveform card + a controls row (speed, volume, download). */
function cardControls(P, cw, { playing, progress, current, total }) {
  const h = 136;
  let s = rr(0, 0, cw, h, P.tint, 12, `stroke="${P.hairline}" stroke-width="1"`);
  s += circ(34, 66, 24, P.accent);
  s += icon(playing ? "pause" : "play", 20, P.paper, 34 - 10 + (playing ? 0 : 1.5), 56);
  s += waveform(P, 74, cw - 104, 42, 34, playing ? progress : 0);
  s += t(74, 100, `${current} / ${total}`, { f: F.ui, s: 13, c: P.inkMuted });
  s += icon("download", 16, P.inkMuted, cw - 168, 84);
  s += icon("volume", 15, P.inkMuted, cw - 136, 85);
  s += rr(cw - 116, 90, 40, 4, mix(P.inkMuted, P.paper, 0.5), 2);
  s += rr(cw - 116, 90, 28, 4, P.inkMuted, 2);
  const chipX = cw - 64;
  s += rr(chipX, 80, 46, 24, P.inputBg, 12, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += t(chipX + 16, 96, "1×", { f: F.ui, s: 11.5, c: P.ink, w: 600 });
  s += icon("chev", 9, P.inkMuted, chipX + 30, 88);
  // speed popover, open
  const pw = 104, ph = 5 * 26 + 10, px = chipX + 23 - pw, py = 80 - ph - 8;
  s += `<filter id="psh2" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.16"/></filter>`;
  s += rr(px, py, pw, ph, P.surface, 8, `stroke="${P.borderStrong}" stroke-width="1" filter="url(#psh2)"`);
  const speeds = ["0.75×", "1×", "1.25×", "1.5×", "2×"];
  speeds.forEach((sp, i) => {
    const iy = py + 5 + i * 26;
    if (sp === "1×") {
      s += rr(px + 4, iy, pw - 8, 26, mix(P.accent, P.paper, 0.9), 5);
      s += icon("check", 11, P.accent, px + 10, iy + 7.5);
      s += t(px + 28, iy + 17.5, sp, { f: F.ui, s: 12.5, c: P.accent, w: 600 });
    } else {
      s += t(px + 28, iy + 17.5, sp, { f: F.ui, s: 12.5, c: P.ink });
    }
  });
  return { s, h: h + 12 };
}

/** Trim editing state on the waveform card (phase-2 idea). */
function cardTrim(P, cw, { current, total }) {
  const h = 136;
  let s = rr(0, 0, cw, h, P.tint, 12, `stroke="${P.hairline}" stroke-width="1"`);
  s += circ(34, 62, 23, mix(P.accent, P.paper, 0.88));
  s += icon("play", 18, P.accent, 34 - 9 + 1.5, 53);
  s += waveform(P, 74, cw - 104, 42, 34, 0.44, { sel: [0.08, 0.77], seed: 3 });
  s += icon("scissors", 14, P.inkMuted, 74, 82);
  s += t(94, 100, `0:12 – 1:58 of ${total} selected`, { f: F.ui, s: 12.5, c: P.inkMuted });
  s += rr(cw - 190, 78, 82, 30, P.inputBg, 8, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += t(cw - 149, 98, "Cancel", { f: F.ui, s: 12.5, c: P.ink, a: "middle" });
  s += rr(cw - 100, 78, 92, 30, P.accent, 8);
  s += t(cw - 54, 98, "Apply trim", { f: F.ui, s: 12.5, c: P.paper, a: "middle", w: 600 });
  return { s, h: h + 12 };
}

function figure(P, cw, body, { caption = true, inspector = false } = {}) {
  return (x0) => {
    let s = "", y = 0;
    if (inspector) {
      const bar = inspectorBar(P, cw);
      s += `<g transform="translate(0,${y})">${bar.s}</g>`; y += bar.h;
    }
    const lbl = labelStrip(P, "the founder, on tape");
    s += `<g transform="translate(0,${y})">${lbl.s}</g>`; y += lbl.h;
    s += `<g transform="translate(0,${y})">${body.s}</g>`; y += body.h;
    if (caption) {
      s += t(cw / 2, y + 12, "Founders interview, take two", { s: 13.5, c: P.inkMuted, a: "middle" });
      y += 34;
    }
    return { s, h: y };
  };
}

/* --- scenes -------------------------------------------------------- */

const scenes = {};

function playerScene(name, P, body, opts = {}) {
  scenes[name] = { P, tb: toolbar(P, { insertOpen: false }), body: (cw) => {
    const intro = docIntro(P)(cw);
    const fig = figure(P, cw, body(P, cw), opts)(0);
    let s = intro.s;
    s += `<g transform="translate(0,${intro.y})">${fig.s}</g>`;
    s += docOutro(P, intro.y + fig.h + 34);
    return s;
  } };
}

playerScene("variant-a-waveform", LIGHT, (P, cw) => cardWaveform(P, cw, { playing: true, progress: 0.44, current: "1:07", total: "2:31", speed: "1.5×" }), { inspector: true });
playerScene("variant-a-speed-open", LIGHT, (P, cw) => cardWaveform(P, cw, { playing: true, progress: 0.44, current: "1:07", total: "2:31", speed: "1.5×", speedOpen: true }), { inspector: false });
playerScene("variant-a-waveform-dark", DARK, (P, cw) => cardWaveform(P, cw, { playing: false, progress: 0, current: "0:00", total: "2:31" }), { inspector: false });
playerScene("variant-b-strip", LIGHT, (P, cw) => stripCompact(P, cw, { playing: true, progress: 0.44, current: "1:07", total: "2:31" }), { inspector: false });
playerScene("variant-c-controls", LIGHT, (P, cw) => cardControls(P, cw, { playing: true, progress: 0.44, current: "1:07", total: "2:31" }), { inspector: false });
playerScene("edit-trim", LIGHT, (P, cw) => cardTrim(P, cw, { current: "1:07", total: "2:31" }), { inspector: true });

/* One clip at three container widths: card / strip / chip. */
scenes["sizes-ladder"] = {
  P: LIGHT,
  tb: toolbar(LIGHT, {}),
  body: (cw) => {
    let s = t(0, 44, "One clip, three sizes", { s: 37, c: LIGHT.heading, w: 700 });
    s += t(0, 88, "The player picks its density from the width of its container:", { s: 17, c: LIGHT.ink });
    let y = 126;
    const tiers = [
      ["CARD · FULL MEASURE · 576 PX", cardWaveform(LIGHT, cw, { playing: true, progress: 0.44, current: "1:07", total: "2:31", speed: "1.5×" })],
      ["STRIP · 340 PX", stripCompact(LIGHT, 340, { playing: true, progress: 0.44, current: "1:07", total: "2:31", compact: true })],
      ["CHIP · 176 PX · TABLE CELL", chipPlayer(LIGHT, 176, { playing: false, label: "2:31" })],
    ];
    for (const [label, body] of tiers) {
      s += t(0, y + 10, label, { f: F.ui, s: 11, c: LIGHT.inkMuted, ls: "0.06em", w: 600 });
      s += `<g transform="translate(0,${y + 18})">${body.s}</g>`;
      y += 18 + body.h + 24;
    }
    return s;
  },
};

/* Audio chips inside a dataset table, referencing the figure above. */
scenes["table-audio"] = {
  P: LIGHT,
  tb: toolbar(LIGHT, {}),
  body: (cw) => {
    let s = docIntro(LIGHT)(cw).s;
    let y = 150;
    const fig = figure(LIGHT, cw, cardWaveform(LIGHT, cw, { playing: true, progress: 0.44, current: "1:07", total: "2:31" }), { inspector: false })(0);
    s += `<g transform="translate(0,${y})">${fig.s}</g>`; y += fig.h + 6;
    s += t(0, y + 16, "Each row below points at that one embedded clip:", { s: 17, c: LIGHT.ink });
    y += 48;
    // booktabs table: Take | Note | Clip
    const c1 = 64, c3 = 140, c2 = cw - c1 - c3;
    const headH = 36, rowH = 46;
    const rows = [
      ["1", "Opening answer", { label: "2:31", playing: false }],
      ["2", "Follow-up on pricing", { label: "1:07", playing: true }],
      ["3", "Closing, take three", { label: "0:48", playing: false }],
    ];
    const tblH = headH + rows.length * rowH;
    s += line(0, y, cw, y, LIGHT.rule, 1.5);
    s += line(0, y + headH, cw, y + headH, LIGHT.rule, 1);
    s += t(8, y + 24, "Take", { s: 15, c: LIGHT.ink, w: 600 });
    s += t(c1 + 12, y + 24, "Note", { s: 15, c: LIGHT.ink, w: 600 });
    s += t(c1 + c2 + 12, y + 24, "Clip", { s: 15, c: LIGHT.ink, w: 600 });
    let ry = y + headH;
    rows.forEach(([n, note, clip], i) => {
      ry += rowH;
      s += t(c1 - 8, ry - 18, n, { s: 15, c: LIGHT.ink, a: "end" });
      s += t(c1 + 12, ry - 18, note, { s: 15, c: LIGHT.ink });
      const chip = chipPlayer(LIGHT, 96, { playing: clip.playing, label: clip.label, accent: clip.playing });
      s += `<g transform="translate(${c1 + c2 + (c3 - 96) / 2},${ry - 34})">${chip.s}</g>`;
      if (i === 0) s += t(c1 + c2 + 12, ry - 18, "", { s: 15 });
    });
    s += line(0, ry, cw, ry, LIGHT.rule, 1.5);
    s += t(cw / 2, ry + 26, "Table 1. Interview takes — each Clip cell is an @aud:founders-clip reference", { s: 13.5, c: LIGHT.inkMuted, a: "middle" });
    return s;
  },
};

scenes["insert-menu"] = {
  P: LIGHT,
  tb: toolbar(LIGHT, { insertOpen: true }),
  body: (cw) => {
    const intro = docIntro(LIGHT)(cw);
    const fig = figure(LIGHT, cw, cardWaveform(LIGHT, cw, { playing: false, progress: 0, current: "0:00", total: "2:31" }), { inspector: false })(0);
    let s = intro.s;
    s += `<g transform="translate(0,${intro.y})">${fig.s}</g>`;
    s += docOutro(LIGHT, intro.y + fig.h + 34);
    return s;
  },
  extra: (tb) => insertMenu(LIGHT, tb.insertX),
};

const fontFiles = await prepFonts();
for (const [name, sc] of Object.entries(scenes)) {
  const extra = sc.extra ? sc.extra(sc.tb) : "";
  const { s, h } = page(sc.P, sc.tb, sc.body, 700, extra);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${h}" viewBox="0 0 1280 ${h}">${s}</svg>`;
  writeFileSync(join(HERE, `${name}.svg`), svg);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 2560 },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: F.ui },
    background: sc.P.bg,
  });
  writeFileSync(join(HERE, `${name}.png`), resvg.render().asPng());
  console.log(name, h);
}
