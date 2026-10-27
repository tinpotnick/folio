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
  // Code spans are LITERAL: lift them out before any other rule runs
  // (a `*` inside backticks must never start italics), then put them
  // back. U+E000 (private use) stands in for each span.
  const spans: string[] = [];
  const lifted = escaped.replace(/`([^`]+)`/g, (_m, code: string) => {
    spans.push(`<code>${code}</code>`);
    return `\uE000${String(spans.length - 1)}\uE000`;
  });
  return (
    lifted
      // Links first: the label then still gets the inline format
      // rules applied INSIDE the anchor (bold link text works).
      .replace(
        /(!?)\[([^\]]+)\]\(([^)\s"]+)\)/g,
        (m, bang: string, label: string, url: string) =>
          bang === "!" ? m : `<a href="${url}">${label}</a>`,
      )
      // Footnote references (GitHub's [^label]): numbered by the
      // component in reading order (spec: docs/specs/footnotes.md).
      .replace(
        /\[\^([\w.-]+)\]/g,
        '<sup class="folio-fnref" data-fn="$1" contenteditable="false"><a role="doc-noteref" tabindex="0">$1</a></sup>',
      )
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\+\+([^+]+)\+\+/g, "<ins>$1</ins>")
      .replace(/\uE000(\d+)\uE000/g, (_m, n: string) => spans[Number(n)] ?? "")
  );
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
      // No-break spaces are the editor's, not the author's: the browser
      // types one wherever an ordinary space would collapse (at a line's
      // end, beside a footnote number or a reference) and turns it back
      // only when a letter follows. They must not reach the file.
      out += (node.textContent ?? "").replaceAll("\u00a0", " ");
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
      case "DEL":
      case "S":
        out += `~~${nodesToMarkdown(el)}~~`;
        break;
      case "INS":
      case "U":
        out += `++${nodesToMarkdown(el)}++`;
        break;
      case "A":
        out += `[${nodesToMarkdown(el)}](${el.getAttribute("href") ?? ""})`;
        break;
      case "BR":
        out += "\n";
        break;
      case "SUP":
        if (el.classList.contains("folio-fnref")) {
          out += `[^${el.getAttribute("data-fn") ?? ""}]`;
          break;
        }
        out += nodesToMarkdown(el);
        break;
      default:
        out += nodesToMarkdown(el);
    }
  }
  return out;
}
