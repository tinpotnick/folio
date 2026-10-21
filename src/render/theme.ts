/**
 * Closed, typed theme schema (ADR-0002). Documents reference themes;
 * they never carry style. This module maps frontmatter style keys to
 * a typed Theme and emits the component's CSS.
 *
 * A theme is a whole LOOK, not a font swap (spec: docs/specs/
 * themes.md): typefaces, scale, heading treatment, table style,
 * chart palette, and colors - for BOTH renditions. Dark mode is a
 * rendition of the same theme (like print), so every theme carries
 * its own dark colors and dark palette: a dark editorial page is
 * still recognisably editorial.
 */
import type { Doc } from "../engine/doc.js";
import { fontStack } from "./fonts.js";

/** The rendition: the host's ambient mode (`<folio-doc mode>`). */
export type Mode = "light" | "dark";

export const TABLE_STYLES = [
  "booktabs",
  "plain",
  "striped",
  "minimal",
  "banded",
  "ledger",
] as const;
export type TableStyle = (typeof TABLE_STYLES)[number];

/** One rendition's document colors. */
export interface ThemeColors {
  paper: string;
  ink: string;
  /** Captions, units, formula cells, axis ticks. */
  muted: string;
  heading: string;
  /** Links, heading accents, the banded table header. */
  accent: string;
  /** Table rules (booktabs top/bottom), heading rules. */
  rule: string;
  /** Light separators: grid lines, row rules, chart grid. */
  hairline: string;
  /** Header bands, stripes, code backgrounds. */
  tint: string;
}

export interface Theme {
  bodyFont: string;
  bodySize: string;
  lineHeight: number;
  /** The text column's width. */
  measure: string;
  h1Font: string;
  /** h2-h6 (h1 has its own key). */
  headingFont: string;
  monoFont: string;
  h1Size: string;
  h2Size: string;
  h3Size: string;
  headingWeight: number;
  headingTracking: string;
  /** h3 as a small-caps / uppercase label, or plain. */
  h3Case: "none" | "uppercase" | "small-caps";
  h1Align: "start" | "center";
  /** A rule over (or under) every h2. */
  h2Rule: "none" | "above" | "below";
  justify: boolean;
  captionAlign: "start" | "center";
  captionItalic: boolean;
  tableStyle: TableStyle;
  /** Rows a windowed table figure shows in flow (table.rows.show). */
  tableRowsShow: number;
  palette: Record<Mode, string[]>;
  colors: Record<Mode, ThemeColors>;
  pageBreakH1: boolean;
  pageBreakH2: boolean;
}

/**
 * Chart palettes, each hand-tuned for BOTH papers: the dark set is
 * lighter and a little less saturated - the same hues, readable on
 * a dark page without turning neon.
 */
export const PALETTES: Record<string, Record<Mode, string[]>> = {
  muted: {
    light: ["#3d5a98", "#2a9d8f", "#b5761c", "#c8553d", "#7a5c99", "#5c7c5a"],
    dark: ["#8ea6dd", "#5fc4b6", "#e8b66a", "#e08a74", "#b49ad3", "#93b58f"],
  },
  corporate: {
    light: ["#1f3a5f", "#3f72a6", "#5a8cbc", "#a8875b", "#5b6b7a"],
    dark: ["#7fa6d6", "#a9c6e6", "#5a8fc4", "#d1b384", "#9aa8b6"],
  },
  ink: {
    light: ["#334155", "#0f766e", "#b45309", "#6d28d9", "#64748b"],
    dark: ["#93a8c4", "#5eb8ad", "#d9a35b", "#a78bda", "#cbd5e1"],
  },
  warm: {
    light: ["#b4442c", "#b8701c", "#5f8a6b", "#8e4b6e", "#3f6a92"],
    dark: ["#e4806a", "#e9ae62", "#8fbd9b", "#c587a8", "#86acd1"],
  },
  sepia: {
    light: ["#7a4a2a", "#a8763e", "#5d6b4a", "#8c3b3b", "#4a5a6e"],
    dark: ["#c99a74", "#d8b07a", "#a4b38a", "#cf8a7f", "#97a9bf"],
  },
  vivid: {
    light: ["#5b3fd1", "#0e8ca8", "#c2387a", "#b5700f", "#2f9e5e"],
    dark: ["#a594f9", "#5cc6dc", "#e57aa9", "#eab057", "#6cc792"],
  },
  news: {
    light: ["#c8102e", "#2b2b2b", "#2a6ebb", "#a67a00", "#8a8a8a"],
    dark: ["#ec6a6a", "#d4d4d4", "#6ea8e6", "#f0c24b", "#a3a3a3"],
  },
  jewel: {
    light: ["#1e5c4a", "#b08d3c", "#6b3a5e", "#2c4a7a", "#a0522d"],
    dark: ["#6fbfa5", "#d9b864", "#b98aae", "#8aa8d8", "#d99068"],
  },
  mono: {
    light: ["#262626", "#737373", "#1d4ed8", "#8a8a8a", "#525252"],
    dark: ["#b0b0b0", "#7a7a7a", "#7aa2f7", "#d4d4d4", "#727272"],
  },
  swiss: {
    light: ["#e4251b", "#111111", "#8a8a8a", "#a37c00", "#3a5f8f"],
    dark: ["#ef5b50", "#d6d6d6", "#8a8a8a", "#e8c14d", "#7fa1cf"],
  },
};

const DEFAULT_THEME: Theme = {
  bodyFont: fontStack("Source Serif 4"),
  bodySize: "17px",
  lineHeight: 1.65,
  measure: "720px",
  h1Font: fontStack("Source Serif 4"),
  headingFont: fontStack("Source Serif 4"),
  monoFont: fontStack("JetBrains Mono"),
  h1Size: "28pt",
  h2Size: "20pt",
  h3Size: "16pt",
  headingWeight: 650,
  headingTracking: "-0.005em",
  h3Case: "none",
  h1Align: "start",
  h2Rule: "none",
  justify: false,
  captionAlign: "center",
  captionItalic: false,
  tableStyle: "booktabs",
  tableRowsShow: 50,
  palette: PALETTES["muted"] ?? { light: ["#3d5a98"], dark: ["#8ea6dd"] },
  colors: {
    light: {
      paper: "#ffffff",
      ink: "#1f2328",
      muted: "#5c636b",
      heading: "#14171a",
      accent: "#2f4fb5",
      rule: "#1f2328",
      hairline: "#e6e8eb",
      tint: "#f5f6f8",
    },
    dark: {
      paper: "#1c1c1f",
      ink: "#e6e4df",
      muted: "#a19e98",
      heading: "#f4f2ed",
      accent: "#9db4ff",
      rule: "#8a8780",
      hairline: "#2e2e32",
      tint: "#252529",
    },
  },
  pageBreakH1: false,
  pageBreakH2: false,
};

function palette(name: string): Record<Mode, string[]> {
  return PALETTES[name] ?? DEFAULT_THEME.palette;
}

/** A theme's catalogue entry: what the settings dialog shows. */
export interface ThemeInfo {
  label: string;
  description: string;
}

/**
 * Named themes (ADR-0002): a theme is a PRESET of typed theme
 * values, applied before the document's own style keys - a style
 * key always overrides its theme. Unknown names fall back to the
 * default look (a document may outlive a theme).
 */
export const THEME_PRESETS: Record<
  string,
  { info: ThemeInfo; look: Partial<Theme> }
> = {
  // folio's own look - also the fallback for unknown names.
  default: {
    info: {
      label: "Folio",
      description: "Source Serif throughout, booktabs tables, muted palette",
    },
    look: {},
  },
  "corporate-report": {
    info: {
      label: "Corporate report",
      description: "Inter, navy headings, banded table headers",
    },
    look: {
      bodyFont: fontStack("Inter"),
      bodySize: "15.5px",
      lineHeight: 1.6,
      h1Font: fontStack("Inter"),
      headingFont: fontStack("Inter"),
      h1Size: "26pt",
      h2Size: "17pt",
      h3Size: "13pt",
      headingWeight: 700,
      headingTracking: "-0.018em",
      h2Rule: "below",
      captionAlign: "start",
      tableStyle: "banded",
      palette: palette("corporate"),
      colors: {
        light: {
          paper: "#ffffff",
          ink: "#1e2733",
          muted: "#5b6675",
          heading: "#1f3a5f",
          accent: "#2b5d94",
          rule: "#1f3a5f",
          hairline: "#dfe5ec",
          tint: "#eef3f8",
        },
        dark: {
          paper: "#19202a",
          ink: "#dfe6ee",
          muted: "#93a1b1",
          heading: "#b4cdea",
          accent: "#8fb4de",
          rule: "#7fa6d6",
          hairline: "#2b3542",
          tint: "#222b37",
        },
      },
    },
  },
  technical: {
    info: {
      label: "Technical",
      description: "IBM Plex Sans, gridded tables, slate and teal",
    },
    look: {
      bodyFont: fontStack("IBM Plex Sans"),
      bodySize: "15px",
      lineHeight: 1.6,
      measure: "760px",
      h1Font: fontStack("IBM Plex Sans"),
      headingFont: fontStack("IBM Plex Sans"),
      h1Size: "22pt",
      h2Size: "16pt",
      h3Size: "11pt",
      headingWeight: 600,
      headingTracking: "0",
      h3Case: "uppercase",
      captionAlign: "start",
      tableStyle: "plain",
      palette: palette("ink"),
      colors: {
        light: {
          paper: "#ffffff",
          ink: "#1d2430",
          muted: "#5f6b7a",
          heading: "#111827",
          accent: "#0f766e",
          rule: "#94a3b8",
          hairline: "#e2e8f0",
          tint: "#f1f5f9",
        },
        dark: {
          paper: "#171c21",
          ink: "#d8dee6",
          muted: "#8b97a6",
          heading: "#f1f5f9",
          accent: "#5eb8ad",
          rule: "#4b5563",
          hairline: "#2a323c",
          tint: "#1f262e",
        },
      },
    },
  },
  editorial: {
    info: {
      label: "Editorial",
      description: "Fraunces display, Literata text, warm magazine palette",
    },
    look: {
      bodyFont: fontStack("Literata"),
      bodySize: "18px",
      lineHeight: 1.7,
      measure: "680px",
      h1Font: fontStack("Fraunces"),
      headingFont: fontStack("Fraunces"),
      h1Size: "36pt",
      h2Size: "22pt",
      h3Size: "15pt",
      headingWeight: 600,
      headingTracking: "-0.015em",
      h2Rule: "above",
      captionAlign: "start",
      captionItalic: true,
      tableStyle: "minimal",
      palette: palette("warm"),
      colors: {
        light: {
          paper: "#fffdf9",
          ink: "#23201c",
          muted: "#6d665c",
          heading: "#1a1714",
          accent: "#b4442c",
          rule: "#23201c",
          hairline: "#ebe5da",
          tint: "#f6f1e8",
        },
        dark: {
          paper: "#1d1a17",
          ink: "#e9e3d8",
          muted: "#a59d90",
          heading: "#f6f0e6",
          accent: "#e4806a",
          rule: "#8c8478",
          hairline: "#332e28",
          tint: "#26221e",
        },
      },
    },
  },
  manuscript: {
    info: {
      label: "Manuscript",
      description: "EB Garamond on cream, centred title, small-caps subheads",
    },
    look: {
      bodyFont: fontStack("EB Garamond"),
      bodySize: "19.5px",
      lineHeight: 1.6,
      measure: "640px",
      h1Font: fontStack("EB Garamond"),
      headingFont: fontStack("EB Garamond"),
      h1Size: "30pt",
      h2Size: "19pt",
      h3Size: "15pt",
      headingWeight: 500,
      headingTracking: "0.01em",
      h3Case: "small-caps",
      h1Align: "center",
      captionItalic: true,
      tableStyle: "booktabs",
      palette: palette("sepia"),
      colors: {
        light: {
          paper: "#fbf7ee",
          ink: "#2b2620",
          muted: "#776c5e",
          heading: "#2b2620",
          accent: "#8c3b3b",
          rule: "#2b2620",
          hairline: "#e6dccb",
          tint: "#f3ecdf",
        },
        dark: {
          paper: "#1f1b16",
          ink: "#e8dfcf",
          muted: "#a89a85",
          heading: "#f2e9d8",
          accent: "#d58f84",
          rule: "#9a8c76",
          hairline: "#362f27",
          tint: "#29241e",
        },
      },
    },
  },
  modern: {
    info: {
      label: "Modern",
      description: "Space Grotesk headings, Inter text, striped tables",
    },
    look: {
      bodyFont: fontStack("Inter"),
      bodySize: "16px",
      lineHeight: 1.65,
      h1Font: fontStack("Space Grotesk"),
      headingFont: fontStack("Space Grotesk"),
      h1Size: "32pt",
      h2Size: "19pt",
      h3Size: "14pt",
      headingWeight: 700,
      headingTracking: "-0.025em",
      captionAlign: "start",
      tableStyle: "striped",
      palette: palette("vivid"),
      colors: {
        light: {
          paper: "#ffffff",
          ink: "#18181b",
          muted: "#63636e",
          heading: "#0b0b0f",
          accent: "#5b3fd1",
          rule: "#d4d4d8",
          hairline: "#ececf0",
          tint: "#f5f4fb",
        },
        dark: {
          paper: "#18171c",
          ink: "#e7e6ee",
          muted: "#9d9aab",
          heading: "#fafafa",
          accent: "#a594f9",
          rule: "#3f3d4a",
          hairline: "#2a2832",
          tint: "#211f28",
        },
      },
    },
  },
  newsroom: {
    info: {
      label: "Newsroom",
      description: "Heavy Libre Franklin heads, rules above, red accent",
    },
    look: {
      bodySize: "17px",
      lineHeight: 1.55,
      h1Font: fontStack("Libre Franklin"),
      headingFont: fontStack("Libre Franklin"),
      h1Size: "32pt",
      h2Size: "18pt",
      h3Size: "11.5pt",
      headingWeight: 800,
      headingTracking: "-0.02em",
      h3Case: "uppercase",
      h2Rule: "above",
      captionAlign: "start",
      tableStyle: "ledger",
      palette: palette("news"),
      colors: {
        light: {
          paper: "#ffffff",
          ink: "#121212",
          muted: "#5e5e5e",
          heading: "#121212",
          accent: "#c8102e",
          rule: "#121212",
          hairline: "#e2e2e2",
          tint: "#f4f4f4",
        },
        dark: {
          paper: "#161616",
          ink: "#e8e8e8",
          muted: "#9e9e9e",
          heading: "#fafafa",
          accent: "#f0646a",
          rule: "#d0d0d0",
          hairline: "#2c2c2c",
          tint: "#202020",
        },
      },
    },
  },
  elegant: {
    info: {
      label: "Elegant",
      description: "Playfair Display over airy Inter, emerald and gold",
    },
    look: {
      bodyFont: fontStack("Inter"),
      bodySize: "15.5px",
      lineHeight: 1.8,
      measure: "660px",
      h1Font: fontStack("Playfair Display"),
      headingFont: fontStack("Playfair Display"),
      h1Size: "34pt",
      h2Size: "21pt",
      h3Size: "10.5pt",
      headingWeight: 500,
      headingTracking: "0",
      h3Case: "uppercase",
      h1Align: "center",
      captionItalic: true,
      tableStyle: "minimal",
      palette: palette("jewel"),
      colors: {
        light: {
          paper: "#ffffff",
          ink: "#262626",
          muted: "#6b6b6b",
          heading: "#14201b",
          accent: "#1e5c4a",
          rule: "#b08d3c",
          hairline: "#ece7dc",
          tint: "#f7f5ef",
        },
        dark: {
          paper: "#141816",
          ink: "#e6e3dc",
          muted: "#a3a097",
          heading: "#f5f1e8",
          accent: "#6fbfa5",
          rule: "#b9994f",
          hairline: "#2a302c",
          tint: "#1c211e",
        },
      },
    },
  },
  academic: {
    info: {
      label: "Academic",
      description: "Justified serif, compact heads, greyscale figures",
    },
    look: {
      bodySize: "16px",
      lineHeight: 1.55,
      measure: "620px",
      h1Size: "21pt",
      h2Size: "14pt",
      h3Size: "12pt",
      headingWeight: 700,
      headingTracking: "0",
      h1Align: "center",
      justify: true,
      captionAlign: "center",
      tableStyle: "booktabs",
      palette: palette("mono"),
      colors: {
        light: {
          paper: "#ffffff",
          ink: "#1a1a1a",
          muted: "#5a5a5a",
          heading: "#000000",
          accent: "#1d4ed8",
          rule: "#000000",
          hairline: "#e3e3e3",
          tint: "#f4f4f4",
        },
        dark: {
          paper: "#1b1b1b",
          ink: "#e2e2e2",
          muted: "#9a9a9a",
          heading: "#f5f5f5",
          accent: "#8fb0ff",
          rule: "#bdbdbd",
          hairline: "#2f2f2f",
          tint: "#242424",
        },
      },
    },
  },
  swiss: {
    info: {
      label: "Swiss",
      description: "Bold Inter, oversized title, signal-red accent",
    },
    look: {
      bodyFont: fontStack("Inter"),
      bodySize: "16px",
      lineHeight: 1.55,
      h1Font: fontStack("Inter"),
      headingFont: fontStack("Inter"),
      h1Size: "42pt",
      h2Size: "20pt",
      h3Size: "11pt",
      headingWeight: 800,
      headingTracking: "-0.035em",
      h3Case: "uppercase",
      h2Rule: "above",
      captionAlign: "start",
      tableStyle: "minimal",
      palette: palette("swiss"),
      colors: {
        light: {
          paper: "#ffffff",
          ink: "#111111",
          muted: "#666666",
          heading: "#111111",
          accent: "#e4251b",
          rule: "#111111",
          hairline: "#e5e5e5",
          tint: "#f3f3f3",
        },
        dark: {
          paper: "#121212",
          ink: "#ececec",
          muted: "#9a9a9a",
          heading: "#ffffff",
          accent: "#ff5a4f",
          rule: "#ececec",
          hairline: "#2b2b2b",
          tint: "#1c1c1c",
        },
      },
    },
  },
};

/** The theme names the settings dialog offers, in order. */
export function themeNames(): string[] {
  return Object.keys(THEME_PRESETS);
}

/** A theme's label and description (unknown names: the default's). */
export function themeInfo(name: string): ThemeInfo {
  return (
    (THEME_PRESETS[name] ?? THEME_PRESETS["default"])?.info ?? {
      label: name,
      description: "",
    }
  );
}

/** A named theme with no document overrides. */
export function presetTheme(name: string | undefined): Theme {
  const look = name !== undefined ? THEME_PRESETS[name]?.look : undefined;
  return { ...DEFAULT_THEME, ...(look ?? {}) };
}

export function themeFromDoc(doc: Doc): Theme {
  const style = new Map(doc.frontmatter.style);
  // The named theme presets the base look; the document's own
  // style keys then override key by key (ADR-0002: style lives
  // with the theme, and explicit always wins).
  const base = presetTheme(doc.frontmatter.theme);
  const bodyFamily = style.get("body.font.family");
  const h1Family = style.get("h1.font.family");
  const tableStyle = style.get("table.style");
  return {
    ...base,
    bodyFont: bodyFamily ? fontStack(bodyFamily) : base.bodyFont,
    bodySize: style.get("body.font.size") ?? base.bodySize,
    h1Font: h1Family ? fontStack(h1Family) : base.h1Font,
    h1Size: style.get("h1.font.size") ?? base.h1Size,
    h2Size: style.get("h2.font.size") ?? base.h2Size,
    h3Size: style.get("h3.font.size") ?? base.h3Size,
    tableStyle: (TABLE_STYLES as readonly string[]).includes(tableStyle ?? "")
      ? (tableStyle as TableStyle)
      : base.tableStyle,
    tableRowsShow: (() => {
      const raw = Number(style.get("table.rows.show"));
      return Number.isFinite(raw) && raw >= 3
        ? Math.floor(raw)
        : base.tableRowsShow;
    })(),
    palette: PALETTES[style.get("chart.palette") ?? ""] ?? base.palette,
    pageBreakH1: style.get("pagebreak.h1") === "before",
    pageBreakH2: style.get("pagebreak.h2") === "before",
  };
}

/**
 * The editing chrome inside the document (inspector bars, menus, the
 * dataset browser, code syntax colors) follows the MODE, not the
 * theme: it is app furniture, shared by every theme.
 */
const CHROME: Record<Mode, Record<string, string>> = {
  light: {
    "rule-strong": "#d0d7de",
    "surface-2": "#fafbfc",
    "input-bg": "#ffffff",
    focus: "#1f3fbf",
    hover: "#f3f4f6",
    unit: "#9a6700",
    "sy-comment": "#6e7781",
    "sy-keyword": "#cf222e",
    "sy-string": "#0a3069",
    "sy-blue": "#0550ae",
    "sy-purple": "#8250df",
    "sy-orange": "#953800",
    "sy-green": "#116329",
    "sy-green-bg": "#dafbe1",
    "sy-red": "#82071e",
    "sy-red-bg": "#ffebe9",
  },
  dark: {
    "rule-strong": "#3f3f46",
    "surface-2": "#1f1f23",
    "input-bg": "#18181b",
    focus: "#9db4ff",
    hover: "#2a2a2f",
    unit: "#d6a24a",
    "sy-comment": "#8b8b93",
    "sy-keyword": "#f08d84",
    "sy-string": "#a3c9ef",
    "sy-blue": "#8fb8e8",
    "sy-purple": "#c9b2f0",
    "sy-orange": "#e8ac74",
    "sy-green": "#9cc99a",
    "sy-green-bg": "#1f2e22",
    "sy-red": "#f0a39b",
    "sy-red-bg": "#3a2222",
  },
};

/**
 * The rendition's custom properties. The component sets them on
 * :host; a host may still override any of them from outside
 * (`folio-doc { --folio-paper: ... }` beats :host).
 */
function modeVars(theme: Theme, mode: Mode): string {
  const c = theme.colors[mode];
  const vars: Record<string, string> = {
    paper: c.paper,
    ink: c.ink,
    "ink-muted": c.muted,
    heading: c.heading,
    accent: c.accent,
    "table-rule": c.rule,
    rule: c.hairline,
    tint: c.tint,
    surface: c.tint,
    ...CHROME[mode],
  };
  return Object.entries(vars)
    .map(([k, v]) => `--folio-${k}: ${v};`)
    .join("\n      ");
}

/** Table-style rules, layered over the booktabs base. */
function tableCss(style: TableStyle, mode: Mode): string {
  const T = "table.folio-table";
  switch (style) {
    case "plain":
      return `${T} thead tr { border-top: 1px solid var(--folio-table-rule); }
    ${T} thead th { border-bottom: 1px solid var(--folio-table-rule); background: var(--folio-tint); }
    ${T} tbody tr:last-child td { border-bottom: 1px solid var(--folio-table-rule); }
    ${T} td, ${T} th { border: 1px solid var(--folio-rule); }`;
    case "striped":
      return `${T} thead tr { border-top: none; }
    ${T} thead th { border-bottom: 2px solid var(--folio-table-rule); }
    ${T} tbody tr:last-child td { border-bottom: none; }
    ${T} tbody tr:nth-child(even) td { background: var(--folio-tint); }`;
    case "minimal":
      return `${T} thead tr { border-top: none; }
    ${T} thead th {
      border-bottom: 1px solid var(--folio-table-rule);
      font-size: 0.78em;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--folio-ink-muted);
    }
    ${T} thead th .unit { text-transform: none; letter-spacing: 0; }
    ${T} tbody tr:last-child td { border-bottom: none; }
    ${T} tbody td { border-bottom: 1px solid var(--folio-rule); }`;
    case "banded": {
      // Light: paper text on a solid accent band. Dark: a solid band
      // of a light accent would be the loudest thing on the page, so
      // the band is the accent sunk into the paper, with heading ink.
      const band = (pct: number): string =>
        mode === "dark"
          ? `color-mix(in srgb, var(--folio-accent) ${String(pct)}%, var(--folio-paper))`
          : `color-mix(in srgb, var(--folio-accent) ${String(100 - (pct - 26))}%, var(--folio-ink))`;
      const ink =
        mode === "dark" ? "var(--folio-heading)" : "var(--folio-paper)";
      return `${T} thead tr { border-top: none; }
    ${T} thead th {
      border-bottom: none;
      background: ${mode === "dark" ? band(26) : "var(--folio-accent)"};
      color: ${ink};
    }
    ${T} thead th .unit { color: inherit; opacity: 0.8; }
    /* Hover and rename keep the band and only deepen it - the
       generic pale wash would leave paper text on near-paper,
       invisible. */
    ${T} thead th:has(.name:hover) { background: ${band(34)}; }
    ${T} thead th.editing {
      background: ${band(40)};
      box-shadow: inset 0 0 0 1px ${ink};
      caret-color: ${ink};
    }
    ${T} tbody tr:last-child td { border-bottom: 2px solid var(--folio-accent); }
    ${T} tbody td { border-bottom: 1px solid var(--folio-rule); }`;
    }
    case "ledger":
      return `${T} thead tr { border-top: 3px solid var(--folio-table-rule); }
    ${T} thead th {
      border-bottom: 1px solid var(--folio-table-rule);
      font-size: 0.8em;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    ${T} thead th .unit { text-transform: none; letter-spacing: 0; }
    ${T} tbody td { border-bottom: 1px solid var(--folio-rule); }
    ${T} tbody tr:last-child td { border-bottom: 1px solid var(--folio-table-rule); }`;
    case "booktabs":
      return "";
  }
}

/** The theme's heading treatment (font, weight, rules, case). */
function headingCss(theme: Theme): string {
  const h3Case =
    theme.h3Case === "uppercase"
      ? "text-transform: uppercase; letter-spacing: 0.08em;"
      : theme.h3Case === "small-caps"
        ? "font-variant: small-caps; letter-spacing: 0.04em; text-transform: lowercase;"
        : "";
  const h2Rule =
    theme.h2Rule === "above"
      ? "border-top: 2px solid var(--folio-table-rule); padding-top: 0.45em;"
      : theme.h2Rule === "below"
        ? "border-bottom: 1px solid var(--folio-rule); padding-bottom: 0.3em;"
        : "";
  return `
    article.folio-doc h1,
    article.folio-doc h2,
    article.folio-doc h3,
    article.folio-doc h4,
    article.folio-doc h5,
    article.folio-doc h6 {
      font-family: ${theme.headingFont};
      font-weight: ${String(theme.headingWeight)};
      letter-spacing: ${theme.headingTracking};
      color: var(--folio-heading);
    }
    article.folio-doc h1 { font-family: ${theme.h1Font}; }
    article.folio-doc h2 { ${h2Rule} }
    article.folio-doc h3 { ${h3Case} }
    ${
      theme.h1Align === "center"
        ? "article.folio-doc h1 { text-align: center; }"
        : ""
    }
    ${
      theme.justify
        ? "article.folio-doc p { text-align: justify; hyphens: auto; text-wrap: pretty; }"
        : ""
    }`;
}

export function themeCss(theme: Theme, mode: Mode = "light"): string {
  return `
    :host {
      display: block;
      ${modeVars(theme, mode)}
    }
    /* Author display rules beat the UA's [hidden] mapping, and the
       host page's guard does not pierce the shadow boundary. */
    [hidden] {
      display: none !important;
    }
    article.folio-doc {
      max-width: ${theme.measure};
      margin: 0 auto;
      font-family: ${theme.bodyFont};
      font-size: ${theme.bodySize};
      line-height: ${String(theme.lineHeight)};
      color: var(--folio-ink);
      /* The document OWNS its paper - a PAGE, with its own margins,
         so a tinted or dark paper never runs text into its edge.
         Hosts set the margin and the page's lift on their desk. */
      background: var(--folio-paper);
      padding: var(--folio-page-padding, 0);
      border-radius: var(--folio-page-radius, 0);
      box-shadow: var(--folio-page-shadow, none);
      font-optical-sizing: auto;
      text-rendering: optimizeLegibility;
    }
    /* The page's own top margin is the padding: the first block
       never adds a second one. */
    article.folio-doc > :first-child { margin-top: 0; }
    h1 {
      font-size: ${theme.h1Size};
      line-height: 1.2;
      margin: 1.6em 0 0.6em;
    }
    h2 {
      font-size: ${theme.h2Size};
      line-height: 1.25;
      margin: 1.8em 0 0.5em;
    }
    h3 {
      font-size: ${theme.h3Size};
      line-height: 1.3;
      margin: 1.5em 0 0.4em;
    }
    /* Right-to-left scripts (Arabic, Hebrew, ...) follow their own
       direction: each block's direction and justification derive
       from its first strong character (unicode-bidi: plaintext),
       so an Arabic paragraph right-aligns while the surrounding
       English document is untouched. A direction is typography,
       not content - it lives in the theme, never in the document
       (AGENTS.md #1). */
    article.folio-doc h1,
    article.folio-doc h2,
    article.folio-doc p,
    article.folio-doc li,
    article.folio-doc figcaption,
    article.folio-doc td,
    article.folio-doc th {
      unicode-bidi: plaintext;
      text-align: start;
    }
    ${headingCss(theme)}
    article.folio-doc figcaption {
      ${theme.captionAlign === "center" ? "text-align: center;" : ""}
      ${theme.captionItalic ? "font-style: italic;" : ""}
    }
    figure {
      margin: 1.6em 0;
    }
    figcaption {
      font-size: 0.85em;
      color: var(--folio-ink-muted, #57606a);
      margin-top: 0.4em;
      text-align: center;
    }
    table.folio-table {
      border-collapse: collapse;
      width: 100%;
      font-variant-numeric: tabular-nums;
    }
    table.folio-table thead tr { border-top: 2px solid var(--folio-table-rule, #1f2328); }
    table.folio-table thead th {
      border-bottom: 1px solid var(--folio-table-rule, #1f2328);
      text-align: left;
      padding: 6px 10px;
      font-weight: 600;
    }
    table.folio-table tbody tr:last-child td {
      border-bottom: 2px solid var(--folio-table-rule, #1f2328);
    }
    table.folio-table td, table.folio-table th { padding: 5px 10px; }
    table.folio-table td:empty::after {
      content: "\\00a0";
      opacity: 0;
    }
    table.folio-table thead th .unit {
      font-weight: 400;
      font-style: italic;
      font-size: 0.8em;
      color: var(--folio-ink-muted, #57606a);
    }
    table.folio-table thead th .name { user-select: text; }
    /* The header highlight is the CELL's, exactly like a data
       cell: the blue wash and the faint inner border fill the
       whole th - never a box hugging the text. Hover follows the
       name only (the unit is not an editing affordance). */
    table.folio-table thead th:has(.name:hover) {
      background: rgba(76, 110, 245, 0.05);
    }
    table.folio-table thead th.editing {
      outline: none;
      background: rgba(76, 110, 245, 0.07);
      box-shadow: inset 0 0 0 1px rgba(76, 110, 245, 0.25);
    }
    table.folio-table thead th .name:focus { outline: none; }
    /* While the name is edited the th is all name: the unit hides
       and the span fills the cell, so renaming feels like editing
       any other cell. */
    table.folio-table thead th.editing .unit { display: none; }
    table.folio-table thead th.editing .name { display: block; }
    .folio-table-error {
      color: var(--folio-unit, #9a6700);
      font-size: 0.9em;
      padding: 6px 2px;
    }
    ${tableCss(theme.tableStyle, mode)}
    ${
      theme.pageBreakH1
        ? `@media print { article.folio-doc > h1:not(:first-child) { break-before: page; page-break-before: always; } }`
        : ""
    }
    ${
      theme.pageBreakH2
        ? `@media print { article.folio-doc > h2:not(:first-child) { break-before: page; page-break-before: always; } }`
        : ""
    }
    /* Numbers right-align (ADR-0002, derived from the column type).
       Specific enough to beat the bidi rule's text-align: start. */
    article.folio-doc td.num,
    article.folio-doc th.num { text-align: right; }
    article.folio-doc td.align-center,
    article.folio-doc th.align-center { text-align: center; }
    /* The table bar names the table's kind (spec: simple-tables.md). */
    .folio-inspector .insp-kind {
      flex: none;
      font-weight: 600;
      color: var(--folio-ink-muted);
      padding: 0 4px;
      white-space: nowrap;
    }
    .folio-inspector .insp-convert {
      flex: none;
      margin-left: auto;
      font: inherit;
      font-size: 12px;
      border: 1px solid var(--folio-rule-strong);
      background: var(--folio-input-bg);
      color: var(--folio-ink);
      border-radius: 5px;
      padding: 3px 8px;
      cursor: pointer;
      white-space: nowrap;
    }
    .folio-inspector .insp-convert:hover:not(:disabled) {
      background: var(--folio-hover);
    }
    .folio-inspector .insp-convert.blocked {
      opacity: 0.6;
    }
    .folio-inspector .insp-chart {
      flex: none;
      font: inherit;
      font-size: 12px;
      border: 1px solid var(--folio-rule-strong);
      background: var(--folio-input-bg);
      color: var(--folio-ink);
      border-radius: 5px;
      padding: 3px 8px;
      cursor: pointer;
    }
    .folio-inspector .insp-chart:hover { background: var(--folio-hover); }
    .folio-inspector .insp-note {
      flex-basis: 100%;
      color: var(--folio-unit);
      font-size: 12px;
    }
    /* A table bar wraps rather than running past the page. */
    figure[data-table-kind] > .folio-inspector { flex-wrap: wrap; }
    .folio-table-scroll {
      overflow-x: auto;
      overscroll-behavior-x: contain;
    }
    /* Long numbers never wrap mid-value; the scroller takes the
       width instead. */
    table.folio-table td.num { white-space: nowrap; }
    td.folio-formula {
      font-feature-settings: "tnum";
      color: var(--folio-ink-muted, #57606a);
      cursor: default;
    }
    pre.folio-code {
      font-family: ${theme.monoFont};
      font-size: 0.86em;
      background: var(--folio-surface, #f6f8fa);
      border: 1px solid var(--folio-rule, #e6e8eb);
      border-radius: 6px;
      padding: 12px 14px;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      margin: 0.9em 0;
    }
    pre.folio-code code {
      background: transparent;
      padding: 0;
      border-radius: 0;
    }
    figure.folio-diagram {
      margin: 0.9em 0;
      padding: 12px;
      border: 1px dashed var(--folio-rule);
      border-radius: 6px;
    }
    figure.folio-diagram:focus {
      outline: 2px solid var(--folio-focus, #1f3fbf);
      border-style: solid;
    }
    .folio-inspector {
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 6px 8px;
      margin-bottom: 8px;
      border: 1px solid var(--folio-rule, #e6e8eb);
      border-radius: 6px;
      background: var(--folio-surface-2, #fafbfc);
      font-family: system-ui, sans-serif;
      font-size: 12px;
    }
    .folio-inspector select,
    .folio-inspector input {
      font: inherit;
      font-size: 12px;
      padding: 3px 6px;
      border: 1px solid var(--folio-rule-strong, #d0d7de);
      border-radius: 5px;
      background: var(--folio-input-bg, #ffffff);
      color: var(--folio-ink, #1f2328);
    }
    .folio-inspector .insp-expr {
      flex: 1;
      min-width: 80px;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
    }
    .folio-inspector .insp-unit {
      font-style: italic;
      width: 5em;
    }
    .folio-inspector .insp-source-text {
      flex: 1;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      resize: vertical;
      min-height: 3em;
      box-sizing: border-box;
    }
    .folio-inspector .insp-select,
    .folio-inspector .insp-filter,
    .folio-inspector .insp-caption {
      flex: 1;
      min-width: 60px;
    }
    .folio-inspector .insp-fx {
      font-style: italic;
      color: var(--folio-ink-muted, #57606a);
      flex: none;
    }
    .folio-inspector .insp-fx {
      font-style: italic;
      color: var(--folio-ink-muted, #57606a);
      flex: none;
    }
    /* --- Table viewport status line (windowed tables) --- */
    .folio-table-more {
      font-size: 0.8em;
      color: var(--folio-ink-muted, #57606a);
      margin-top: 0.35em;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .folio-table-more .ds-open {
      font: inherit;
      font-size: 0.95em;
      border: 1px solid var(--folio-rule-strong, #d0d7de);
      background: var(--folio-input-bg, #ffffff);
      border-radius: 5px;
      padding: 1px 8px;
      cursor: pointer;
      color: var(--folio-ink, #1f2328);
    }
    .folio-table-more .ds-open:hover { background: var(--folio-hover, #f3f4f6); }
    .folio-inspector .insp-dataset {
      flex: none;
      border: 1px solid var(--folio-rule-strong, #d0d7de);
      background: var(--folio-input-bg, #ffffff);
      border-radius: 5px;
      padding: 2px 7px;
      cursor: pointer;
      color: var(--folio-ink, #1f2328);
      line-height: 1.4;
    }
    .folio-inspector .insp-dataset:hover { background: var(--folio-hover, #f3f4f6); }

    /* --- Dataset browser overlay --- */
    .folio-ds-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(31, 35, 40, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .folio-ds-overlay[hidden] { display: none; }
    .folio-ds-panel {
      background: var(--folio-input-bg, #ffffff);
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
      width: min(1000px, 92vw);
      height: min(640px, 84vh);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .folio-ds-head {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid var(--folio-rule, #e6e8eb);
      flex: none;
    }
    .folio-ds-title {
      font-weight: 600;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 13px;
      color: var(--folio-ink, #1f2328);
    }
    .folio-ds-filter {
      flex: 1;
      font: inherit;
      font-size: 13px;
      padding: 4px 8px;
      border: 1px solid var(--folio-rule-strong, #d0d7de);
      border-radius: 6px;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
    }
    .folio-ds-count {
      font-size: 12px;
      color: var(--folio-ink-muted, #57606a);
      white-space: nowrap;
    }
    .folio-ds-done {
      font: inherit;
      font-size: 13px;
      border: 1px solid var(--folio-rule-strong, #d0d7de);
      background: var(--folio-input-bg, #ffffff);
      border-radius: 6px;
      padding: 3px 12px;
      cursor: pointer;
    }
    .folio-ds-done:hover { background: var(--folio-hover, #f3f4f6); }
    .folio-ds-grid {
      flex: 1;
      overflow-y: auto;
      position: relative;
      font-variant-numeric: tabular-nums;
    }
    .folio-ds-canvas { position: relative; }
    .folio-ds-header {
      position: sticky;
      top: 0;
      z-index: 2;
      display: grid;
      height: 32px;
      background: var(--folio-surface, #f6f8fa);
      border-bottom: 1px solid var(--folio-rule-strong, #d0d7de);
    }
    .folio-ds-hcell {
      display: flex;
      align-items: center;
      padding: 0 10px;
      font-size: 12px;
      font-weight: 600;
      color: var(--folio-ink, #1f2328);
      cursor: pointer;
      border-right: 1px solid var(--folio-rule, #e6e8eb);
      user-select: none;
    }
    .folio-ds-hcell:hover { background: var(--folio-hover, #eceff2); }
    .folio-ds-hcell.sorted { color: var(--folio-focus, #1f3fbf); }
    .folio-ds-row {
      position: absolute;
      left: 0;
      right: 0;
      height: 32px;
      display: grid;
      border-bottom: 1px solid var(--folio-rule, #eef0f3);
    }
    .folio-ds-cell {
      display: flex;
      align-items: center;
      padding: 0 10px;
      font-size: 13px;
      border-right: 1px solid var(--folio-rule, #eef0f3);
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .folio-ds-cell.num { justify-content: flex-end; }
    .folio-ds-cell:not(.computed):hover {
      background: rgba(76, 110, 245, 0.06);
      cursor: text;
    }
    .folio-ds-cell.computed { color: var(--folio-ink-muted, #57606a); }
    .folio-ds-edit {
      font: inherit;
      font-size: 13px;
      width: 100%;
      border: none;
      outline: none;
      padding: 0;
      background: transparent;
    }
    figure.folio-image {
      margin: 1.2em 0;
      user-select: none;
    }
    figure.folio-image img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 0 auto;
    }
    figure.folio-image:focus {
      outline: 2px solid var(--folio-focus, #1f3fbf);
    }
    figure.folio-audio {
      margin: 1.2em 0;
      user-select: none;
    }
    figure.folio-audio .folio-audio-label {
      font-size: 12px;
      color: var(--folio-ink-muted, #6b7280);
      padding: 1px 1px 6px;
      user-select: none;
    }
    figure.folio-audio audio {
      display: block;
      width: 100%;
    }
    figure.folio-audio:focus {
      outline: 2px solid var(--folio-focus, #1f3fbf);
    }
    .folio-inspector .insp-alt {
      flex: 1;
      min-width: 120px;
    }
    .folio-inspector .insp-file {
      max-width: 180px;
      font-size: 12px;
    }
    figure.folio-codeblock {
      margin: 0.9em 0;
      padding: 0;
    }
    figure.folio-codeblock pre.folio-code {
      margin: 0;
    }
    /* The code header sits on the code body like a tab strip. */
    figure.folio-codeblock > .code-inspector {
      /* Sticky, so a long block's header (strudel's Play/Stop)
         stays in view while the caret is deep inside it. Hosts
         with their own sticky chrome set --folio-sticky-top. */
      position: sticky;
      top: var(--folio-sticky-top, 0px);
      z-index: 2;
      margin-bottom: 0;
      border-bottom: none;
      border-radius: 6px 6px 0 0;
      background: var(--folio-hover, #eef1f4);
    }
    figure.folio-codeblock > .code-inspector:not([hidden]) + pre.folio-code {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
    .code-inspector select.code-lang {
      font-weight: 600;
    }
    /* Syntax colors (highlight.js token classes; GitHub light). */
    pre.folio-code .hljs-comment,
    pre.folio-code .hljs-quote {
      color: var(--folio-sy-comment, #6e7781);
      font-style: italic;
    }
    pre.folio-code .hljs-keyword,
    pre.folio-code .hljs-selector-tag,
    pre.folio-code .hljs-doctag,
    pre.folio-code .hljs-template-tag {
      color: var(--folio-sy-keyword, #cf222e);
    }
    pre.folio-code .hljs-string,
    pre.folio-code .hljs-regexp,
    pre.folio-code .hljs-meta .hljs-string {
      color: var(--folio-sy-string, #0a3069);
    }
    pre.folio-code .hljs-number,
    pre.folio-code .hljs-literal,
    pre.folio-code .hljs-attr,
    pre.folio-code .hljs-attribute,
    pre.folio-code .hljs-symbol,
    pre.folio-code .hljs-meta,
    pre.folio-code .hljs-selector-attr,
    pre.folio-code .hljs-selector-class,
    pre.folio-code .hljs-selector-id,
    pre.folio-code .hljs-variable.language_ {
      color: var(--folio-sy-blue, #0550ae);
    }
    pre.folio-code .hljs-title,
    pre.folio-code .hljs-title.function_,
    pre.folio-code .hljs-title.class_,
    pre.folio-code .hljs-section {
      color: var(--folio-sy-purple, #8250df);
    }
    pre.folio-code .hljs-built_in,
    pre.folio-code .hljs-type,
    pre.folio-code .hljs-params,
    pre.folio-code .hljs-variable,
    pre.folio-code .hljs-template-variable {
      color: var(--folio-sy-orange, #953800);
    }
    pre.folio-code .hljs-name,
    pre.folio-code .hljs-tag,
    pre.folio-code .hljs-selector-pseudo,
    pre.folio-code .hljs-bullet {
      color: var(--folio-sy-green, #116329);
    }
    pre.folio-code .hljs-addition {
      color: var(--folio-sy-green, #116329);
      background: var(--folio-sy-green-bg, #dafbe1);
    }
    pre.folio-code .hljs-deletion {
      color: var(--folio-sy-red, #82071e);
      background: var(--folio-sy-red-bg, #ffebe9);
    }
    pre.folio-code .hljs-emphasis { font-style: italic; }
    pre.folio-code .hljs-strong { font-weight: 600; }
    /* Strudel's playing lights: an atom lights the moment its
       note sounds and fades out once it is released. */
    figure.folio-strudel .strudel-atom {
      border-radius: 3px;
      transition: background-color 420ms ease-out, box-shadow 420ms ease-out;
    }
    figure.folio-strudel .strudel-atom.strudel-on {
      background-color: rgba(130, 80, 223, 0.28);
      box-shadow: 0 0 0 1px rgba(130, 80, 223, 0.55);
      transition-duration: 0ms;
    }
    /* The online-samples consent (ADR-0019): a warning row of its own. */
    .folio-inspector .strudel-consent {
      flex-basis: 100%;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      padding: 6px 8px;
      border-radius: 5px;
      background: color-mix(in srgb, var(--folio-unit) 14%, transparent);
      color: var(--folio-ink);
      font-size: 12px;
    }
    .folio-inspector .strudel-consent[hidden] { display: none; }
    figure.folio-codeblock > .code-inspector { flex-wrap: wrap; }
    .strudel-consent button { flex: none; }
    .folio-inspector .strudel-consent > span { flex: 1 1 260px; }
    .folio-inspector .strudel-error {
      color: var(--folio-sy-red, #b3261e);
      font-size: 12px;
    }
    figure.folio-math {
      margin: 1.2em 0;
      overflow-x: auto;
      overflow-y: hidden;
    }
    figure.folio-math .math-holder .katex-display {
      margin: 0;
    }
    code {
      font-family: ${theme.monoFont};
      font-size: 0.9em;
      background: var(--folio-surface, #f6f8fa);
      padding: 0.1em 0.3em;
      border-radius: 3px;
    }
    p { margin: 0.9em 0; }
    /* Lists (spec: docs/specs/lists.md): the theme's rhythm, markers
       in muted ink so the text leads. */
    article.folio-doc ul,
    article.folio-doc ol {
      margin: 0.9em 0;
      padding-inline-start: 1.6em;
    }
    article.folio-doc li {
      margin: 0.3em 0;
      padding-inline-start: 0.25em;
    }
    /* A sub-list sits tight under its item: nesting must not loosen
       the list's rhythm. */
    article.folio-doc li > ul,
    article.folio-doc li > ol {
      margin: 0.15em 0 0;
    }
    article.folio-doc li::marker {
      color: var(--folio-ink-muted);
    }
    article.folio-doc ol > li::marker {
      font-variant-numeric: tabular-nums;
    }
    article.folio-doc[contenteditable="true"] { caret-color: var(--folio-ink, #1f2328); }
    article.folio-doc[contenteditable="true"]:focus { outline: none; }
    p:empty::before, h1:empty::before, h2:empty::before {
      content: "…";
      color: var(--folio-ink-muted, #b0b8c1);
    }
    article.folio-doc a {
      color: var(--folio-accent);
      text-decoration: underline;
      text-decoration-color: color-mix(in srgb, var(--folio-accent) 40%, transparent);
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    article.folio-doc a:hover { text-decoration-color: var(--folio-accent); }
    .folio-link-menu {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .folio-link-menu input {
      font: inherit;
      font-size: 13px;
      padding: 3px 6px;
      border: 1px solid var(--folio-rule-strong, #d0d7de);
      border-radius: 5px;
      background: var(--folio-input-bg, #ffffff);
      color: var(--folio-ink, #1f2328);
    }
    .folio-link-menu .link-url {
      width: 240px;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
    }
    .folio-link-menu button {
      font: inherit;
      font-size: 12px;
      border: 1px solid var(--folio-rule-strong, #d0d7de);
      background: var(--folio-input-bg, #ffffff);
      border-radius: 5px;
      padding: 3px 8px;
      cursor: pointer;
      color: var(--folio-ink, #1f2328);
      white-space: nowrap;
    }
    .folio-link-menu button:hover { background: var(--folio-hover, #f3f4f6); }
    .folio-link-menu .link-remove { color: var(--folio-sy-red, #9a3131); }
    td[contenteditable]:hover { background: rgba(76, 110, 245, 0.05); }
    td[contenteditable]:focus {
      outline: none;
      background: rgba(76, 110, 245, 0.07);
      box-shadow: inset 0 0 0 1px rgba(76, 110, 245, 0.25);
    }
    th { user-select: none; }
    figure[data-chart-source] { user-select: none; }
    .folio-menu {
      position: absolute;
      z-index: 100;
      background: var(--folio-input-bg, #ffffff);
      border: 1px solid var(--folio-rule-strong, #d0d7de);
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
      padding: 4px;
      min-width: 160px;
      display: flex;
      flex-direction: column;
    }
    .folio-menu button {
      border: none;
      background: transparent;
      text-align: left;
      padding: 6px 12px;
      font: inherit;
      font-size: 14px;
      border-radius: 5px;
      cursor: pointer;
      color: var(--folio-ink, #1f2328);
    }
    .folio-menu button:hover { background: var(--folio-hover, #f3f4f6); }
    .chart-holder svg { width: 100%; height: auto; display: block; }
    @media print {
      /* Print is always the LIGHT rendition on white paper,
         whatever the app mode. */
      :host {
        ${modeVars(theme, "light")}
        --folio-paper: #ffffff;
      }
      article.folio-doc {
        max-width: none;
        padding: 0;
        box-shadow: none;
      }
      article.folio-doc h1,
      article.folio-doc h2,
      article.folio-doc h3 {
        break-after: avoid;
      }
      figure,
      table.folio-table,
      pre.folio-code {
        break-inside: avoid;
      }
      figure.folio-audio audio {
        display: none;
      }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
}
