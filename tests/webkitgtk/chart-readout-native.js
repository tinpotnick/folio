// native-key: Left Left
// The chart readout in the desktop engine: a pointer over a line chart
// shows the values at the nearest month; focused, the real Left key
// steps back a month.
const host = document.querySelector("#the-doc");
await host.load(
  "# T\n\n::: table {#t}\ncolumns:\n  - {name: month, type: date}\n  - {name: v, type: number, format: currency}\ndata:\n  - [2024-01-31, 1000]\n  - [2024-02-29, 1500.5]\n  - [2024-03-31, 1200]\n:::\n\n::: chart {#c}\nsource: @t\nquery: {select: [month, v]}\ntype: line\n:::\n",
);
await new Promise((r) => setTimeout(r, 300));
const root = host.shadowRoot;
const holder = root.querySelector("figure[data-chart-source] .chart-holder");
const svg = holder.querySelector("svg");
const box = svg.getBoundingClientRect();
// Point at the middle month.
holder.dispatchEvent(
  new PointerEvent("pointermove", {
    bubbles: true,
    pointerType: "mouse",
    clientX: box.left + box.width * 0.5,
    clientY: box.top + box.height * 0.5,
  }),
);
const hovered = root.querySelector(".chart-readout")?.textContent ?? "";
holder.focus();
window.__folioCheck = () => {
  const head = root.querySelector(".chart-readout .readout-head")?.textContent;
  return (
    "| pointing reads the middle month, in money format: " +
    (hovered.includes("29 Feb 2024") && hovered.includes("1,500.50")) +
    "\n| focus then Left Left steps back to the first month: " +
    (head === "31 Jan 2024")
  );
};
