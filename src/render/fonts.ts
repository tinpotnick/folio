/**
 * folio's bundled typefaces (ADR-0017). Themes name real faces, so
 * the faces ship WITH the component: Vite emits each woff2 as a
 * hashed asset next to the bundle and documents render identically
 * offline and on machines that have none of these installed (a
 * theme naming a font the OS lacks silently falls back - every
 * theme then looks the same, the bug this module exists to fix).
 *
 * Latin subset, variable weight axis, OFL-1.1 (Fontsource). A face
 * downloads only when a rendered document actually uses it.
 *
 * @font-face does not work inside a shadow root, so the faces are
 * registered once on the host DOCUMENT - which also lets the host
 * page show them (the settings dialog's theme cards).
 */
import sourceSerif from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2?url";
import sourceSerifItalic from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-italic.woff2?url";
import inter from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import interItalic from "@fontsource-variable/inter/files/inter-latin-wght-italic.woff2?url";
import plexSans from "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url";
import plexSansItalic from "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-italic.woff2?url";
import fraunces from "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url";
import frauncesItalic from "@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2?url";
import garamond from "@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2?url";
import garamondItalic from "@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-italic.woff2?url";
import spaceGrotesk from "@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url";
import franklin from "@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-normal.woff2?url";
import franklinItalic from "@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-italic.woff2?url";
import playfair from "@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2?url";
import playfairItalic from "@fontsource-variable/playfair-display/files/playfair-display-latin-wght-italic.woff2?url";
import literata from "@fontsource-variable/literata/files/literata-latin-wght-normal.woff2?url";
import literataItalic from "@fontsource-variable/literata/files/literata-latin-wght-italic.woff2?url";
import jetbrains from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
import jetbrainsItalic from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-italic.woff2?url";

interface Face {
  /** The family name documents and themes use. */
  family: string;
  /** The CSS fallback stack after the family. */
  fallback: string;
  weights: string;
  normal: string;
  italic?: string;
}

const SERIF = "Georgia, serif";
const SANS = 'ui-sans-serif, system-ui, "Segoe UI", Helvetica, sans-serif';

const FACES: Face[] = [
  {
    family: "Source Serif 4",
    fallback: SERIF,
    weights: "200 900",
    normal: sourceSerif,
    italic: sourceSerifItalic,
  },
  {
    family: "Inter",
    fallback: SANS,
    weights: "100 900",
    normal: inter,
    italic: interItalic,
  },
  {
    family: "IBM Plex Sans",
    fallback: SANS,
    weights: "100 700",
    normal: plexSans,
    italic: plexSansItalic,
  },
  {
    family: "Fraunces",
    fallback: SERIF,
    weights: "100 900",
    normal: fraunces,
    italic: frauncesItalic,
  },
  {
    family: "EB Garamond",
    fallback: SERIF,
    weights: "400 800",
    normal: garamond,
    italic: garamondItalic,
  },
  {
    family: "Space Grotesk",
    fallback: SANS,
    weights: "300 700",
    normal: spaceGrotesk,
  },
  {
    family: "Libre Franklin",
    fallback: SANS,
    weights: "100 900",
    normal: franklin,
    italic: franklinItalic,
  },
  {
    family: "Playfair Display",
    fallback: SERIF,
    weights: "400 900",
    normal: playfair,
    italic: playfairItalic,
  },
  {
    family: "Literata",
    fallback: SERIF,
    weights: "200 900",
    normal: literata,
    italic: literataItalic,
  },
  {
    family: "JetBrains Mono",
    fallback: 'ui-monospace, "SF Mono", Menlo, monospace',
    weights: "100 800",
    normal: jetbrains,
    italic: jetbrainsItalic,
  },
];

/** The bundled family names, in the order the settings dialog offers. */
export const BUNDLED_FONTS: string[] = FACES.map((f) => f.family);

/**
 * The CSS font stack for a family name: a bundled face gets its own
 * category fallback; an unknown name (a document may name any font
 * the reader might have) falls back to a serif.
 */
export function fontStack(family: string): string {
  const face = FACES.find((f) => f.family === family);
  return `"${family}", ${face?.fallback ?? SERIF}`;
}

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

function faceRule(face: Face, style: string, url: string): string {
  return `@font-face {
  font-family: "${face.family}";
  font-style: ${style};
  font-display: swap;
  font-weight: ${face.weights};
  src: url("${url}") format("woff2");
  unicode-range: ${LATIN};
}`;
}

/** The @font-face rules for every bundled face. */
export function fontFaceCss(): string {
  return FACES.flatMap((f) => [
    faceRule(f, "normal", f.normal),
    ...(f.italic ? [faceRule(f, "italic", f.italic)] : []),
  ]).join("\n");
}

/** Register the bundled faces on a document, once. */
export function registerFonts(doc: Document = document): void {
  if (doc.getElementById("folio-fonts")) return;
  const style = doc.createElement("style");
  style.id = "folio-fonts";
  style.textContent = fontFaceCss();
  doc.head.appendChild(style);
}
