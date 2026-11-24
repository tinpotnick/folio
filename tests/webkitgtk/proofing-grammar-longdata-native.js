// native-key: x
// Regression for the ~20-30s source-view freeze: with grammar check ON,
// switching to Markdown view lints the WHOLE source - base64 data URIs
// included - on the main thread (Harper's cost on a multi-KB run is
// super-linear). maskForLint (src/spell/grammar.ts) now blanks runs
// over 128 chars and ::: directive lines before Harper sees them.
// Here: 8 x 5kB data URIs, grammar on, switch to source view - the lint
// must still run (a real grammar mark appears) but cost no long task,
// and a REAL key must land in the editor right after.
const host = document.querySelector("#the-doc");
const B64 = "A".repeat(5000);
let md = "# T\n\n";
for (let i = 0; i < 8; i++)
  md += `::: audio {#a${i}}\nsrc: data:audio/ogg;base64,${B64}\n:::\n\n`;
md += "I has a dog.\n";
await host.load(md);
host.setGrammar(true);
// warm the Harper WASM BEFORE observing, so the load is not measured
const m = await import("/src/spell/grammar.js");
await m.getLinter();
const longTasks = [];
try {
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) longTasks.push(Math.round(e.duration));
  });
  obs.observe({ entryTypes: ["longtask"] });
} catch (e) {}
const btnMd = document.querySelector("#btn-markdown");
btnMd.dispatchEvent(
  new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }),
);
// let the post-switch mark pass (300ms timer) run to completion
await new Promise((r) => setTimeout(r, 4000));
const ed = document.querySelector("#editor");
const len0 = ed.value.length;
ed.focus();
ed.setSelectionRange(0, 0);
window.__probe = { len0 };
window.__folioCheck = () => {
  const v = document.querySelector("#editor").value;
  const grammarMark = !!document.querySelector("#md-view .folio-grammar");
  const worst = longTasks.length ? Math.max(...longTasks) : 0;
  return [
    "",
    "grammar lint still runs after the switch (a grammar mark appeared): " +
      grammarMark,
    "no long task >= 2s during switch + lint (worst: " +
      worst +
      "ms): " +
      (worst < 2000),
    "REAL key x landed in the editor right after the switch: " +
      (v.length === window.__probe.len0 + 1 && v.startsWith("x")),
  ].join(" | ");
};
return "set";
