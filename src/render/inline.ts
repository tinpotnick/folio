/**
 * Inline Markdown <-> HTML (the WYSIWYG seam, ADR-0002).
 * The document stores semantics (`**strong**`); the rendered view
 * shows HTML. Editing in the rendered view must round-trip back to
 * the same semantic source. One deep module for both directions.
 */

export function inlineMarkdownToHtml(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function htmlToInlineMarkdown(html: string): string {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  return nodesToMarkdown(tpl.content);
}

function nodesToMarkdown(root: Node): string {
  let out = "";
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    switch (el.tagName) {
      case "STRONG":
      case "B":
        out += `**${nodesToMarkdown(el)}**`;
        break;
      case "EM":
      case "I":
        out += `*${nodesToMarkdown(el)}*`;
        break;
      case "CODE":
        out += `\`${el.textContent ?? ""}\``;
        break;
      case "BR":
        out += "\n";
        break;
      default:
        out += nodesToMarkdown(el);
    }
  }
  return out;
}
