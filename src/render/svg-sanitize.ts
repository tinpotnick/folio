/**
 * Make SVG markup safe to place in a document (spec: docs/specs/
 * drawn-blocks.md). SVG is a full document format: it can carry
 * scripts, event handlers, `javascript:` links, embedded HTML
 * (foreignObject), and references that LOAD things from the network.
 * Drawings from text (Graphviz output, hand-written SVG blocks) keep
 * their shapes, text, styles and in-document references - and lose
 * everything that runs or reaches out (documents render offline).
 */

const DROP = new Set(["script", "foreignobject", "iframe", "object", "embed"]);

/** Only same-document references (#id) and data: images may stay. */
function safeRef(value: string, tag: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.startsWith("#")) return true;
  if (tag === "image" && v.startsWith("data:image/")) return true;
  if (tag === "a" && (v.startsWith("https://") || v.startsWith("http://"))) {
    // A link is followed only by a click - it loads nothing on render.
    return true;
  }
  return false;
}

/** Returns sanitized SVG markup, or throws when there is no <svg>. */
export function sanitizeSvg(markup: string): string {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) {
    throw new Error("not valid SVG - it needs one <svg> element");
  }
  const walk = (el: Element): void => {
    for (const child of Array.from(el.children)) {
      if (DROP.has(child.tagName.toLowerCase())) {
        child.remove();
        continue;
      }
      walk(child);
    }
    const tag = el.tagName.toLowerCase();
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (
        (name === "href" || name === "xlink:href") &&
        !safeRef(attr.value, tag)
      ) {
        el.removeAttribute(attr.name);
      } else if (/url\(\s*['"]?\s*(?!#)/i.test(attr.value)) {
        // url(...) pointing anywhere but #id loads a resource.
        el.removeAttribute(attr.name);
      }
    }
    if (
      tag === "style" &&
      /@import|url\(\s*['"]?\s*(?!#)/i.test(el.textContent ?? "")
    ) {
      el.remove();
    }
  };
  walk(svg);
  return new XMLSerializer().serializeToString(svg);
}
