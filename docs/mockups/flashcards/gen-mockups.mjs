import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "fs";

const F = {
  serif: "Source Serif 4",
  ui: "Inter",
  arabic: "Noto Naskh Arabic",
};
const FONT_FILES = [
  "fonts/source-serif-4-latin-wght-normal.ttf",
  "fonts/source-serif-4-latin-wght-italic.ttf",
  "fonts/inter-latin-wght-normal.ttf",
  "fonts/noto-naskh-arabic-arabic-400-normal.ttf",
  "fonts/noto-naskh-arabic-arabic-600-normal.ttf",
];

const LIGHT = {
  bg: "#f3f4f6", surface: "#ffffff", border: "#e4e6ea", borderStrong: "#d0d7de",
  text: "#1f2328", muted: "#57606a",
  paper: "#ffffff", ink: "#1f2328", inkMuted: "#5c636b", heading: "#14171a",
  accent: "#2f4fb5", rule: "#e6e8eb", tint: "#f5f6f8", surface2: "#fafbfc",
  inputBg: "#ffffff", focus: "#1f3fbf",
  ok: "#1a7f37", okBg: "#dafbe1", okBorder: "#a6e5b8",
  bad: "#cf222e", badBg: "#ffebe9", badBorder: "#ffb3ad",
  pageShadow: "rgba(15,23,42,.10)",
  activeBg: "#1f2328", activeFg: "#ffffff",
};
const DARK = {
  bg: "#111113", surface: "#18181b", border: "#26262a", borderStrong: "#3a3a40",
  text: "#e4e4e7", muted: "#9a9aa2",
  paper: "#1c1c1f", ink: "#e6e4df", inkMuted: "#a19e98", heading: "#f4f2ed",
  accent: "#9db4ff", rule: "#2e2e32", tint: "#252529", surface2: "#1f1f23",
  inputBg: "#18181b", focus: "#9db4ff",
  ok: "#3fb950", okBg: "#12261e", okBorder: "#1f4d33",
  bad: "#f85149", badBg: "#3a1d1d", badBorder: "#6e2b28",
  pageShadow: "rgba(0,0,0,.55)",
  activeBg: "#e4e4e7", activeFg: "#18181b",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r = (x, y, w, h, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const rr = (x, y, w, h, fill, rx, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${o.f || F.serif}" font-size="${o.s || 17}" fill="${o.c || "#000"}" text-anchor="${o.a || "start"}"${o.w ? ` font-weight="${o.w}"` : ""}${o.i ? ` font-style="italic"` : ""}${o.ls ? ` letter-spacing="${o.ls}"` : ""}${o.o ? ` opacity="${o.o}"` : ""}>${esc(s)}</text>`;
const line = (x1, y1, x2, y2, stroke, sw = 1, extra = "") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
const path = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;

const ICONS = {
  play: (s, c) => path(`M${s * 0.28} ${s * 0.18}v${s * 0.64}l${s * 0.58}-${s * 0.32}z`, c),
  check: (s, c) => `<path d="M${s * 0.15} ${s * 0.55}l${s * 0.25} ${s * 0.25}L${s * 0.85} ${s * 0.2}" stroke="${c}" stroke-width="${s * 0.14}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  x: (s, c) => `<path d="M${s * 0.25} ${s * 0.25}l${s * 0.5} ${s * 0.5}M${s * 0.75} ${s * 0.25}l-${s * 0.5} ${s * 0.5}" stroke="${c}" stroke-width="${s * 0.13}" stroke-linecap="round"/>`,
  plus: (s, c) => `<path d="M${s * 0.5} ${s * 0.2}v${s * 0.6}M${s * 0.2} ${s * 0.5}h${s * 0.6}" stroke="${c}" stroke-width="${s * 0.13}" stroke-linecap="round"/>`,
  mic: (s, c) => `<g stroke="${c}" stroke-width="${s * 0.12}" fill="none" stroke-linecap="round"><rect x="${s * 0.36}" y="${s * 0.08}" width="${s * 0.28}" height="${s * 0.5}" rx="${s * 0.14}" fill="${c}" stroke="none"/><path d="M${s * 0.2} ${s * 0.48}a${s * 0.3} ${s * 0.3} 0 0 0 ${s * 0.6} 0"/><line x1="${s * 0.5}" y1="${s * 0.78}" x2="${s * 0.5}" y2="${s * 0.92}"/></g>`,
  cards: (s, c) => `<g stroke="${c}" stroke-width="${s * 0.09}" fill="none" stroke-linejoin="round"><rect x="${s * 0.1}" y="${s * 0.22}" width="${s * 0.56}" height="${s * 0.68}" rx="${s * 0.09}"/><path d="M${s * 0.34} ${s * 0.14}h${s * 0.5}a${s * 0.06} ${s * 0.06} 0 0 1 ${s * 0.06} ${s * 0.06}V${s * 0.78}"/></g>`,
  speaker: (s, c) => `<path d="M${s * 0.12} ${s * 0.36}h${s * 0.18}l${s * 0.26}-${s * 0.22}v${s * 0.72}l-${s * 0.26}-${s * 0.22}h-${s * 0.18}z" fill="${c}"/><path d="M${s * 0.62} ${s * 0.35}a${s * 0.32} ${s * 0.32} 0 0 1 0 ${s * 0.3}M${s * 0.72} ${s * 0.24}a${s * 0.5} ${s * 0.5} 0 0 1 0 ${s * 0.52}" stroke="${c}" stroke-width="${s * 0.09}" fill="none" stroke-linecap="round"/>`,
  shuffle: (s, c) => `<g stroke="${c}" stroke-width="${s * 0.1}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M${s * 0.1} ${s * 0.3}h${s * 0.2}l${s * 0.4} ${s * 0.4}h${s * 0.1}M${s * 0.1} ${s * 0.7}h${s * 0.2}l${s * 0.4}-${s * 0.4}h${s * 0.1}"/><path d="M${s * 0.72} ${s * 0.18}l${s * 0.18} ${s * 0.12}-${s * 0.18} ${s * 0.12}M${s * 0.72} ${s * 0.82}l${s * 0.18}-${s * 0.12}-${s * 0.18}-${s * 0.12}"/></g>`,
};

function header(P, dark, docTitle) {
  const h = 57;
  let s = r(0, 0, 1280, h, P.surface) + line(0, h, 1280, h, P.border);
  s += `<image x="24" y="19" height="19" href="${dark ? "wordmark-dark.png" : "wordmark-light.png"}"/>`;
  s += t(150, 36, docTitle, { f: F.ui, s: 13.5, c: P.muted });
  // toolbar mock groups
  const groups = [
    [["Document ▾", true], ["Source", false]],
    [["B", false, true], ["I", false, false, true], ["S", false]],
    [["▦ table", false], ["ƒ chart", false], ["♪", false], ["mic", false], ["cards", false]],
  ];
  let x = 420;
  for (const g of groups) {
    s += rr(x, 10, g.length * 34 + 8, 36, P.surface, 8, `stroke="${P.border}" stroke-width="1"`);
    let bx = x + 4;
    for (const [label, on, b, i] of g) {
      if (on) s += rr(bx, 13, 86, 30, P.activeBg, 6);
      s += t(bx + (on ? 10 : 8), 33, label, { f: F.ui, s: 12.5, c: on ? P.activeFg : P.muted, b: b, i: i });
      bx += on ? 94 : 34;
    }
    x += g.length * 34 + 8 + 8;
  }
  return { s, h };
}

function page(P, contentSvg, contentH) {
  // desk
  let s = r(0, 0, 1280, 10000, P.bg);
  const { s: hs, h: hh } = header(P, P === DARK, "arabic-vocab.md");
  s += hs;
  const top = hh + 34;
  const pw = 720, px = (1280 - pw) / 2;
  const padT = 56, padX = 72, padB = 72;
  const pageH = Math.max(contentH + padT + padB, 900 - 150);
  // shadow
  s += rr(px, top + 6, pw, pageH, P.pageShadow, 3, `opacity="0.35" filter=""`);
  s += rr(px, top, pw, pageH, P.paper, 3, `stroke="${P === LIGHT ? "rgba(15,23,42,.05)" : "rgba(0,0,0,.5)"}" stroke-width="1"`);
  const cx = px + padX, cw = pw - padX * 2;
  s += `<g transform="translate(${cx},${top + padT})">` + contentSvg(cw) + `</g>`;
  return { s, h: top + pageH + 60 };
}

function audioFigure(P, cw, label, caption) {
  let s = "";
  const y0 = 0;
  s += t(0, 12, label, { f: F.ui, s: 12, c: P.inkMuted });
  // native audio player mock
  const py = 18, ph = 40;
  s += rr(0, py, cw, ph, P === LIGHT ? "#f1f2f4" : "#232327", 8, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += `<g transform="translate(10,${py + 9})">${ICONS.play(22, P.ink)}</g>`;
  s += t(40, py + 25, "0:02", { f: F.ui, s: 12, c: P.inkMuted });
  const tx = 70, tw = cw - 70 - 60;
  s += rr(tx, py + 17, tw, 6, P.borderStrong, 3);
  s += rr(tx, py + 17, tw * 0.35, 6, P.inkMuted, 3);
  s += `<circle cx="${tx + tw * 0.35}" cy="${py + 20}" r="6" fill="${P.ink}"/>`;
  s += `<g transform="translate(${cw - 34},${py + 11})">${ICONS.speaker(18, P.inkMuted)}</g>`;
  if (caption) s += t(cw / 2, py + ph + 20, caption, { s: 13.5, c: P.inkMuted, a: "middle" });
  return { s, h: py + ph + (caption ? 34 : 10) };
}

function deckLabel(P, cw, title, count, badge, badgeZero) {
  let s = `<g transform="translate(0,0)">${ICONS.cards(14, P.inkMuted)}</g>`;
  s += t(22, 12, title, { f: F.ui, s: 12.5, c: P.ink, w: 600 });
  s += t(22 + title.length * 6.4 + 8, 12, `· ${count} cards`, { f: F.ui, s: 12, c: P.inkMuted });
  if (badge) {
    const bw = badge.length * 6.5 + 18;
    s += rr(cw - bw, -2, bw, 18, badgeZero ? P.tint : P.accent, 9);
    s += t(cw - bw / 2, 10, badge, { f: F.ui, s: 11, c: badgeZero ? P.inkMuted : P.paper, a: "middle", w: 600 });
  }
  return { s, h: 22 };
}

function inspectorBar(P, cw, titleVal) {
  const h = 56;
  let s = rr(0, 0, cw, h, P.surface2, 8, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += `<filter id="ish"><feDropShadow dx="0" dy="3" stdDeviation="6" flood-opacity="0.08"/></filter>`;
  s += rr(0, 0, cw, h, "none", 8, `filter="url(#ish)"`);
  s += t(10, 16, "DECK TITLE", { f: F.ui, s: 10.5, c: P.inkMuted, ls: "0.04em" });
  s += rr(10, 21, 230, 28, P.inputBg, 6, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += t(18, 39, titleVal, { f: F.ui, s: 12, c: P.ink });
  // Study deck button (accent)
  const b1x = cw - 190;
  s += rr(b1x, 14, 84, 28, P.accent, 6);
  s += t(b1x + 42, 32, "Study deck", { f: F.ui, s: 12, c: P.paper, a: "middle", w: 500 });
  s += rr(b1x + 92, 14, 74, 28, P.inputBg, 6, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += `<g transform="translate(${b1x + 102},${22})">${ICONS.shuffle(12, P.inkMuted)}</g>`;
  s += t(b1x + 118, 32, "Shuffle", { f: F.ui, s: 12, c: P.ink });
  return { s, h: h + 8 };
}

function cardRow(P, cw, front, back, hasAudio, selected, record) {
  const h = 44;
  let s = "";
  if (selected) s += r(0, 0, cw, h, mix(P.accent, P.paper, 0.07));
  s += line(0, h, cw, h, P.rule);
  s += rr(10, 8, 218, 28, "none", 6, `stroke="${selected ? P.accent : "transparent"}" stroke-width="1"`);
  s += t(18, 27, front, { f: F.arabic, s: 16, c: P.ink });
  s += t(246, 27, "→", { f: F.ui, s: 13, c: P.borderStrong, a: "middle" });
  s += t(262, 27, back, { f: F.serif, s: 15, c: P.ink });
  const bx = cw - 76;
  if (hasAudio) {
    s += rr(bx, 8, 28, 28, P.paper, 6, `stroke="${P.accent}" stroke-width="1.2"`);
    s += `<g transform="translate(${bx + 8},${16})">${ICONS.play(12, P.accent)}</g>`;
  } else if (record) {
    s += rr(bx, 8, 28, 28, P.paper, 6, `stroke="${P.borderStrong}" stroke-width="1"`);
    s += `<g transform="translate(${bx + 8},${15})">${ICONS.mic(13, P.inkMuted)}</g>`;
  }
  s += rr(bx + 36, 8, 28, 28, P.paper, 6, `stroke="${P.borderStrong}" stroke-width="1"`);
  s += `<g transform="translate(${bx + 44},${16})">${ICONS.x(12, P.inkMuted)}</g>`;
  return { s, h };
}

function mix(a, b, f) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * f).toString(16).padStart(2, "0")).join("");
}

const CARDS = [
  ["كَلْب", "dog", true],
  ["قِطَّة", "cat", true],
  ["بَيْت", "house", true],
  ["كِتَاب", "book", false],
  ["مَاء", "water", true],
];

function editDeck(P) {
  return (cw) => {
    let s = "", y = 0;
    s += t(0, 44, "Arabic vocabulary — week 3", { s: 37, c: P.heading, w: 650 });
    y = 78;
    s += t(0, y, "Words from this week's lesson with Sara's pronunciation recordings. The deck below is", { s: 17, c: P.ink });
    s += t(0, y + 28, "what we drill in class; each card can carry its own recording.", { s: 17, c: P.ink });
    y += 66;
    const a = audioFigure(P, cw, "كَلْب · pronunciation", "Recorded in class, take 2");
    s += `<g transform="translate(0,${y})">${a.s}</g>`; y += a.h + 26;
    const lbl = deckLabel(P, cw, "Food & animals", 5, "7 due", false);
    s += `<g transform="translate(0,${y})">${lbl.s}</g>`; y += lbl.h + 4;
    const bar = inspectorBar(P, cw, "Food & animals");
    s += `<g transform="translate(0,${y})">${bar.s}</g>`; y += bar.h + 8;
    // deck body
    const rowsH = CARDS.length * 44 + 58;
    s += rr(0, y, cw, rowsH, P.paper, 12, `stroke="${P.rule}" stroke-width="1"`);
    let ry = y + 4;
    CARDS.forEach(([f, b, au], i) => {
      const row = cardRow(P, cw - 8, f, b, au, i === 0, !au);
      s += `<g transform="translate(4,${ry})">${row.s}</g>`; ry += row.h;
    });
    // add card
    s += rr(12, ry + 2, cw - 24, 40, "none", 8, `stroke="${P.borderStrong}" stroke-width="1.2" stroke-dasharray="5 4"`);
    s += `<g transform="translate(${cw / 2 - 52},${ry + 16})">${ICONS.plus(12, P.inkMuted)}</g>`;
    s += t(cw / 2 - 38, ry + 28, "Add card", { f: F.ui, s: 13, c: P.inkMuted });
    y += rowsH + 30;
    s += t(0, y, "Next week we add the food words and re-record anything that was unclear.", { s: 17, c: P.ink });
    return s;
  };
}

function studyHead(P, cw, mode, pct, count, shuffleBtn) {
  let s = t(0, 14, mode, { f: F.ui, s: 13, c: P.ink, w: 600 });
  const px = 110, pw = cw - 110 - 130 - (shuffleBtn ? 70 : 0);
  s += rr(px, 8, pw, 6, P.rule, 3);
  s += rr(px, 8, pw * pct, 6, P.accent, 3);
  s += t(px + pw + 12, 14, count, { f: F.ui, s: 13, c: P.inkMuted });
  if (shuffleBtn) {
    const bx = cw - 64;
    s += rr(bx, 2, 64, 24, P.tint, 6, `stroke="${P.borderStrong}" stroke-width="1"`);
    s += `<g transform="translate(${bx + 8},${8})">${ICONS.shuffle(11, P.inkMuted)}</g>`;
    s += t(bx + 24, 18, "Shuffle", { f: F.ui, s: 11, c: P.inkMuted });
  }
  return { s, h: 26 };
}

function footHint(P, cw, y, parts) {
  // parts: array of strings; kbd styling for tokens wrapped in [ ]
  let x = cw / 2 - 150;
  let s = "";
  const full = parts.join(" ");
  s += t(cw / 2, y, full, { f: F.ui, s: 12, c: P.inkMuted, a: "middle" });
  return s;
}

function studyShell(P, cw, head, body, foot) {
  return (cw2) => {
    let s = "", y = 0;
    s += t(0, 44, "Arabic vocabulary — week 3", { s: 37, c: P.heading, w: 650 });
    y = 78;
    const lbl = deckLabel(P, cw2, "Food & animals", 20, "studying", true);
    s += `<g transform="translate(0,${y})">${lbl.s}</g>`; y += lbl.h + 4;
    const pad = 20;
    const headH = head(cw2 - pad * 2).h;
    const bodyH = body(cw2 - pad * 2).h;
    const boxH = pad + headH + 14 + bodyH + 14 + 26 + pad - 8;
    s += rr(0, y, cw2, boxH, P.paper, 12, `stroke="${P.rule}" stroke-width="1"`);
    s += `<g transform="translate(${pad},${y + pad})">${head(cw2 - pad * 2).s}</g>`;
    s += `<g transform="translate(${pad},${y + pad + headH + 14})">${body(cw2 - pad * 2).s}</g>`;
    s += t(cw2 / 2, y + boxH - 16, foot, { f: F.ui, s: 12, c: P.inkMuted, a: "middle" });
    return s;
  };
}

function flipFrontBody(P) {
  return (cw) => {
    const h = 240;
    let s = rr(0, 0, cw, h, P.paper, 12, `stroke="${P.borderStrong}" stroke-width="1"`);
    s += `<filter id="csh"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.07"/></filter>`;
    s += rr(0, 0, cw, h, "none", 12, `filter="url(#csh)"`);
    s += t(cw / 2, 96, "قِطَّة", { f: F.arabic, s: 52, c: P.ink, a: "middle" });
    const pr = 29;
    s += `<circle cx="${cw / 2}" cy="${150}" r="${pr}" fill="${P.accent}"/>`;
    s += `<g transform="translate(${cw / 2 - 10},${150 - 10}) scale(1.7)">${ICONS.play(12, P.paper)}</g>`;
    s += t(cw / 2, 212, "tap the speaker to hear it", { f: F.ui, s: 14, c: P.inkMuted, a: "middle" });
    return { s, h };
  };
}

function flipBackBody(P) {
  return (cw) => {
    const h = 240;
    let s = rr(0, 0, cw, h, P.paper, 12, `stroke="${P.borderStrong}" stroke-width="1"`);
    s += t(cw / 2, 56, "قِطَّة", { f: F.arabic, s: 26, c: P.ink, a: "middle" });
    s += `<g transform="translate(${cw / 2 + 62},${44})">${ICONS.speaker(16, P.accent)}</g>`;
    s += line(cw * 0.2, 80, cw * 0.8, 80, P.rule);
    s += t(cw / 2, 136, "cat", { f: F.serif, s: 40, c: P.ink, a: "middle" });
    s += t(cw / 2, 166, "/qitt/ · noun, feminine", { f: F.ui, s: 14, c: P.inkMuted, a: "middle" });
    // SRS buttons
    const btns = [["Again", "<1m", P.badBg, P.badBorder, P.bad], ["Hard", "10m", P.tint, P.borderStrong, P.ink], ["Good", "1d", P.okBg, P.okBorder, P.ok], ["Easy", "4d", P.tint, P.borderStrong, P.ink]];
    const bw = 84, gap = 10, total = btns.length * bw + (btns.length - 1) * gap;
    let x = cw / 2 - total / 2;
    for (const [label, sub, bg, bd, fg] of btns) {
      s += rr(x, 186, bw, 44, bg, 8, `stroke="${bd}" stroke-width="1"`);
      s += t(x + bw / 2, 204, label, { f: F.ui, s: 13, c: fg, a: "middle", w: 500 });
      s += t(x + bw / 2, 220, sub, { f: F.ui, s: 10.5, c: fg, a: "middle", o: 0.75 });
      x += bw + gap;
    }
    return { s, h: h + 60 };
  };
}

function wave(P, x, y, seed) {
  const hs = [6, 12, 16, 9, 14, 7, 11, 13, 8, 15, 10, 6];
  let s = "";
  for (let i = 0; i < hs.length; i++) {
    const h = hs[(i + seed) % hs.length];
    s += r(x + i * 5, y + (18 - h) / 2, 3, h, "currentColor", `rx="1.5" opacity="0.8"`);
  }
  return `<g transform="translate(0,0)" color="${P.inkMuted}">${s}</g>`;
}

function audioTile(P, w, dur, state, seed) {
  const h = 52;
  const st = state === "ok" ? { bg: P.okBg, bd: P.okBorder, fg: P.ok } : state === "bad" ? { bg: P.badBg, bd: P.badBorder, fg: P.bad } : state === "sel" ? { bg: P.paper, bd: P.accent, fg: P.ink } : { bg: P.tint, bd: P.rule, fg: P.ink };
  let s = rr(0, 0, w, h, st.bg, 12, `stroke="${st.bd}" stroke-width="${state ? 1.6 : 1}"`);
  if (state === "sel") s += rr(-2, -2, w + 4, h + 4, "none", 14, `stroke="${P.accent}" stroke-opacity="0.35" stroke-width="3"`);
  s += `<g transform="translate(14,18)" color="${st.fg}">${ICONS.play(16, st.fg)}</g>`;
  s += `<g transform="translate(38,17)" color="${st.fg}">${wave(P, 0, 0, seed)}</g>`;
  s += t(w - 40, 32, dur, { f: F.ui, s: 12, c: st.fg, o: state === "ok" || state === "bad" ? 0.7 : 1, a: "end" });
  if (state === "ok") s += `<g transform="translate(${w - 24},19)">${ICONS.check(14, st.fg)}</g>`;
  return { s, h };
}

function wordTile(P, w, word, state) {
  const h = 52;
  const st = state === "ok" ? { bg: P.okBg, bd: P.okBorder, fg: P.ok } : state === "bad" ? { bg: P.badBg, bd: P.badBorder, fg: P.bad } : state === "sel" ? { bg: P.paper, bd: P.accent, fg: P.ink } : { bg: P.tint, bd: P.rule, fg: P.ink };
  let s = rr(0, 0, w, h, st.bg, 12, `stroke="${st.bd}" stroke-width="${state ? 1.6 : 1}"`);
  if (state === "sel") s += rr(-2, -2, w + 4, h + 4, "none", 14, `stroke="${P.accent}" stroke-opacity="0.35" stroke-width="3"`);
  s += t(w / 2, 36, word, { f: F.arabic, s: 22, c: st.fg, a: "middle" });
  if (state === "ok") s += `<g transform="translate(${w - 24},19)">${ICONS.check(14, st.fg)}</g>`;
  return { s, h };
}

function matchBody(P) {
  return (cw, states) => {
    const colW = (cw - 18) / 2;
    let s = t(0, 0, "LISTEN", { f: F.ui, s: 11, c: P.inkMuted, ls: "0.05em", w: 600 });
    s += t(colW + 18, 0, "MATCH", { f: F.ui, s: 11, c: P.inkMuted, ls: "0.05em", w: 600 });
    const audio = states.audio, words = states.words;
    let y = 12;
    audio.forEach((st, i) => {
      const tile = audioTile(P, colW, ["0:02", "0:01", "0:02", "0:01", "0:02"][i], st, i);
      s += `<g transform="translate(0,${y})">${tile.s}</g>`; y += tile.h + 10;
    });
    y = 12;
    words.forEach((st, i) => {
      const tile = wordTile(P, colW, CARDS[i][0], st);
      s += `<g transform="translate(${colW + 18},${y})">${tile.s}</g>`; y += tile.h + 10;
    });
    return { s, h: y - 10 };
  };
}

function mcqBody(P) {
  return (cw) => {
    const ph = 110;
    let s = rr(0, 0, cw, ph, P.paper, 12, `stroke="${P.borderStrong}" stroke-width="1"`);
    s += `<circle cx="${cw / 2}" cy="${34}" r="24" fill="${P.accent}"/>`;
    s += `<g transform="translate(${cw / 2 - 8},${24}) scale(1.4)">${ICONS.play(12, P.paper)}</g>`;
    s += t(cw / 2, 84, "What does قِطَّة mean?", { f: F.serif, s: 19, c: P.ink, a: "middle" });
    const opts = [["cat", "ok", "1"], ["dog", "bad", "2"], ["house", null, "3"], ["water", null, "4"]];
    const ow = (cw - 10) / 2, oh = 52;
    opts.forEach(([label, st, key], i) => {
      const x = (i % 2) * (ow + 10), y = ph + 14 + Math.floor(i / 2) * (oh + 10);
      const tile = wordTile(P, ow, "", null);
      const stl = st === "ok" ? { bg: P.okBg, bd: P.okBorder, fg: P.ok } : st === "bad" ? { bg: P.badBg, bd: P.badBorder, fg: P.bad } : { bg: P.tint, bd: P.rule, fg: P.ink };
      let o = rr(x, y, ow, oh, stl.bg, 12, `stroke="${stl.bd}" stroke-width="${st ? 1.6 : 1}"`);
      o += t(x + 16, y + 33, label, { f: F.serif, s: 17, c: stl.fg });
      o += rr(x + ow - 66, y + 12, 22, 22, "none", 4, `stroke="${stl.fg}" stroke-opacity="0.4" stroke-width="1"`);
      o += t(x + ow - 55, y + 28, key, { f: F.ui, s: 11, c: stl.fg, a: "middle" });
      if (st === "ok") o += `<g transform="translate(${x + ow - 34},${y + 19})">${ICONS.check(14, stl.fg)}</g>`;
      s += o;
    });
    return { s, h: ph + 14 + 2 * oh + 10 };
  };
}

const scenes = {
  "edit-deck": { P: LIGHT, body: editDeck(LIGHT) },
  "study-flip-front": { P: LIGHT, body: studyShell(LIGHT, 0, (cw) => studyHead(LIGHT, cw, "Flip", 0.15, "Card 3 of 20", false), flipFrontBody(LIGHT), "Space flip · ← → cards · Esc exit") },
  "study-flip-back": { P: LIGHT, body: studyShell(LIGHT, 0, (cw) => studyHead(LIGHT, cw, "Flip", 0.15, "Card 3 of 20", false), flipBackBody(LIGHT), "1–4 grade · Space next card · Esc exit") },
  "study-match": { P: LIGHT, body: studyShell(LIGHT, 0, (cw) => studyHead(LIGHT, cw, "Match the pairs", 0.4, "2 of 5 matched", true), (cw) => matchBody(LIGHT)(cw, { audio: ["ok", null, "sel", null, null], words: ["ok", null, "bad", null, null] }), "press a clip, then its word · Esc exit") },
  "study-match-dark": { P: DARK, body: studyShell(DARK, 0, (cw) => studyHead(DARK, cw, "Match the pairs", 0, "0 of 5 matched", true), (cw) => matchBody(DARK)(cw, { audio: ["sel", null, null, null, null], words: [null, null, null, null, null] }), "press a clip, then its word · Esc exit") },
  "study-mcq": { P: LIGHT, body: studyShell(LIGHT, 0, (cw) => studyHead(LIGHT, cw, "Multiple choice", 0.2, "Card 4 of 20", false), mcqBody(LIGHT), "1–4 answer · Esc exit") },
};

for (const [name, sc] of Object.entries(scenes)) {
  const { s, h } = page(sc.P, sc.body, 700);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${h}" viewBox="0 0 1280 ${h}">${s}</svg>`;
  writeFileSync(`${name}.svg`, svg);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 2560 },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Inter" },
    background: sc.P.bg,
  });
  writeFileSync(`${name}.png`, resvg.render().asPng());
  console.log(name, h);
}
