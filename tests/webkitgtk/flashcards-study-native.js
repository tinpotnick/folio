// native-key: space
// Study-mode contract in real WebKitGTK (spec: docs/specs/flashcards.md):
// an all-sound deck opens in Match; while studying the inspector bar
// must NOT reveal from clicks/focus inside the study UI; and a REAL
// Space key must drive the study view even when focus sits on the
// figure (a real mouse click on the play button can select the figure
// and focus the host - keys then arrive via the article-level fallback).
const host = document.querySelector("#the-doc");
await host.load(
  `::: audio {#a1}\nsrc: data:audio/wav;base64,UklGRiQFAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAFAAAAAPgDeAcWCoILkwtECr8HUAReAGH80vgc9pH0YPSP9fv3WftE/0QD4waxCVkLqguaCkkI/QQaARb9avmF9sD0TvQ/9Xb3r/qJ/o4CRwZCCSULtgvlCsoIpQXVAc79Cfr59vr0SPT69Pn2CfrO/dUBpQXKCOUKtgslC0IJRwaOAon+r/p29z/1TvTA9IX2avkW/RoB/QRJCJoKqgtZC7EJ4wZEA0T/Wfv794/1YPSR9Bz20vhh/F4AUAS/B0QKkwuCCxYKeAf4AwAACPyI+Or1fvRt9Lz1Qfiw+6L/nwMuB+QJbwugC3EKBQinBLwAvPwd+U/2p/RW9Gb1t/cD++b+6gKWBnsJQAuyC8EKighRBXcBcv25+b722/RK9Bv1Nvdb+iv+MgL3BQcJBgu4CwYLBwn3BTICK/5b+jb3G/VK9Nv0vva5+XL9dwFRBYoIwQqyC0ALewmWBuoC5v4D+7f3ZvVW9Kf0T/Yd+bz8vACnBAUIcQqgC28L5AkuB58Dov+w+0H4vPVt9H706vWI+Aj8AAD4A3gHFgqCC5MLRAq/B1AEXgBh/NL4HPaR9GD0j/X791n7RP9EA+MGsQlZC6oLmgpJCP0EGgEW/Wr5hfbA9E70P/V296/6if6OAkcGQgklC7YL5QrKCKUF1QHO/Qn6+fb69Ej0+vT59gn6zv3VAaUFygjlCrYLJQtCCUcGjgKJ/q/6dvc/9U70wPSF9mr5Fv0aAf0ESQiaCqoLWQuxCeMGRANE/1n7+/eP9WD0kfQc9tL4YfxeAFAEvwdECpMLggsWCngH+AMAAAj8iPjq9X70bfS89UH4sPui/58DLgfkCW8LoAtxCgUIpwS8ALz8HflP9qf0VvRm9bf3A/vm/uoClgZ7CUALsgvBCooIUQV3AXL9ufm+9tv0SvQb9Tb3W/or/jIC9wUHCQYLuAsGCwcJ9wUyAiv+W/o29xv1SvTb9L72ufly/XcBUQWKCMEKsgtAC3sJlgbqAub+A/u392b1VvSn9E/2Hfm8/LwApwQFCHEKoAtvC+QJLgefA6L/sPtB+Lz1bfR+9Or1iPgI/AAA+AN4BxYKgguTC0QKvwdQBF4AYfzS+Bz2kfRg9I/1+/dZ+0T/RAPjBrEJWQuqC5oKSQj9BBoBFv1q+YX2wPRO9D/1dvev+on+jgJHBkIJJQu2C+UKygilBdUBzv0J+vn2+vRI9Pr0+fYJ+s791QGlBcoI5Qq2CyULQglHBo4Cif6v+nb3P/VO9MD0hfZq+Rb9GgH9BEkImgqqC1kLsQnjBkQDRP9Z+/v3j/Vg9JH0HPbS+GH8XgBQBL8HRAqTC4ILFgp4B/gDAAAI/Ij46vV+9G30vPVB+LD7ov+fAy4H5AlvC6ALcQoFCKcEvAC8/B35T/an9Fb0ZvW39wP75v7qApYGewlAC7ILwQqKCFEFdwFy/bn5vvbb9Er0G/U291v6K/4yAvcFBwkGC7gLBgsHCfcFMgIr/lv6Nvcb9Ur02/S+9rn5cv13AVEFigjBCrILQAt7CZYG6gLm/gP7t/dm9Vb0p/RP9h35vPy8AKcEBQhxCqALbwvkCS4HnwOi/7D7Qfi89W30fvTq9Yj4CPwAAPgDeAcWCoILkwtECr8HUAReAGH80vgc9pH0YPSP9fv3WftE/0QD4waxCVkLqguaCkkI/QQaARb9avmF9sD0TvQ/9Xb3r/qJ/o4CRwZCCQ==\n:::\n\n` +
    `::: audio {#a2}\nsrc: data:audio/wav;base64,UklGRiQFAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAFAAAAAPgDeAcWCoILkwtECr8HUAReAGH80vgc9pH0YPSP9fv3WftE/0QD4waxCVkLqguaCkkI/QQaARb9avmF9sD0TvQ/9Xb3r/qJ/o4CRwZCCSULtgvlCsoIpQXVAc79Cfr59vr0SPT69Pn2CfrO/dUBpQXKCOUKtgslC0IJRwaOAon+r/p29z/1TvTA9IX2avkW/RoB/QRJCJoKqgtZC7EJ4wZEA0T/Wfv794/1YPSR9Bz20vhh/F4AUAS/B0QKkwuCCxYKeAf4AwAACPyI+Or1fvRt9Lz1Qfiw+6L/nwMuB+QJbwugC3EKBQinBLwAvPwd+U/2p/RW9Gb1t/cD++b+6gKWBnsJQAuyC8EKighRBXcBcv25+b722/RK9Bv1Nvdb+iv+MgL3BQcJBgu4CwYLBwn3BTICK/5b+jb3G/VK9Nv0vva5+XL9dwFRBYoIwQqyC0ALewmWBuoC5v4D+7f3ZvVW9Kf0T/Yd+bz8vACnBAUIcQqgC28L5AkuB58Dov+w+0H4vPVt9H706vWI+Aj8AAD4A3gHFgqCC5MLRAq/B1AEXgBh/NL4HPaR9GD0j/X791n7RP9EA+MGsQlZC6oLmgpJCP0EGgEW/Wr5hfbA9E70P/V296/6if6OAkcGQgklC7YL5QrKCKUF1QHO/Qn6+fb69Ej0+vT59gn6zv3VAaUFygjlCrYLJQtCCUcGjgKJ/q/6dvc/9U70wPSF9mr5Fv0aAf0ESQiaCqoLWQuxCeMGRANE/1n7+/eP9WD0kfQc9tL4YfxeAFAEvwdECpMLggsWCngH+AMAAAj8iPjq9X70bfS89UH4sPui/58DLgfkCW8LoAtxCgUIpwS8ALz8HflP9qf0VvRm9bf3A/vm/uoClgZ7CUALsgvBCooIUQV3AXL9ufm+9tv0SvQb9Tb3W/or/jIC9wUHCQYLuAsGCwcJ9wUyAiv+W/o29xv1SvTb9L72ufly/XcBUQWKCMEKsgtAC3sJlgbqAub+A/u392b1VvSn9E/2Hfm8/LwApwQFCHEKoAtvC+QJLgefA6L/sPtB+Lz1bfR+9Or1iPgI/AAA+AN4BxYKgguTC0QKvwdQBF4AYfzS+Bz2kfRg9I/1+/dZ+0T/RAPjBrEJWQuqC5oKSQj9BBoBFv1q+YX2wPRO9D/1dvev+on+jgJHBkIJJQu2C+UKygilBdUBzv0J+vn2+vRI9Pr0+fYJ+s791QGlBcoI5Qq2CyULQglHBo4Cif6v+nb3P/VO9MD0hfZq+Rb9GgH9BEkImgqqC1kLsQnjBkQDRP9Z+/v3j/Vg9JH0HPbS+GH8XgBQBL8HRAqTC4ILFgp4B/gDAAAI/Ij46vV+9G30vPVB+LD7ov+fAy4H5AlvC6ALcQoFCKcEvAC8/B35T/an9Fb0ZvW39wP75v7qApYGewlAC7ILwQqKCFEFdwFy/bn5vvbb9Er0G/U291v6K/4yAvcFBwkGC7gLBgsHCfcFMgIr/lv6Nvcb9Ur02/S+9rn5cv13AVEFigjBCrILQAt7CZYG6gLm/gP7t/dm9Vb0p/RP9h35vPy8AKcEBQhxCqALbwvkCS4HnwOi/7D7Qfi89W30fvTq9Yj4CPwAAPgDeAcWCoILkwtECr8HUAReAGH80vgc9pH0YPSP9fv3WftE/0QD4waxCVkLqguaCkkI/QQaARb9avmF9sD0TvQ/9Xb3r/qJ/o4CRwZCCQ==\n:::\n\n` +
    '::: flashcards {#d}\ntitle: "Spoken"\ncard: "perro" | "dog" | @a1\ncard: "gato" | "cat" | @a2\n:::\n',
);
await new Promise((r) => setTimeout(r, 300));
const root = host.shadowRoot;
const fig = root.querySelector("figure.folio-flashcards");
const label = fig.querySelector(".folio-fc-label");
const r = label.getBoundingClientRect();
for (const type of ["mousedown", "mouseup", "click"]) {
  label.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      composed: true,
      cancelable: true,
      clientX: r.left + 5,
      clientY: r.top + 5,
    }),
  );
}
await new Promise((res) => setTimeout(res, 200));
const insp = fig.querySelector(".folio-inspector");
const studyBtn = [...insp.querySelectorAll("button")].find((b) =>
  b.textContent.includes("Study deck"),
);
studyBtn.dispatchEvent(
  new MouseEvent("click", { bubbles: true, composed: true }),
);
await new Promise((res) => setTimeout(res, 200));
const matchVisible = !!root.querySelector(".folio-fc-study .folio-fc-match");
// re-query: startStudy re-rendered the figure, the old refs are detached
const liveFig = root.querySelector("figure.folio-flashcards");
const barHiddenAfterOpen = liveFig.querySelector(".folio-inspector").hidden;
// switch to Flip, then simulate the real-click focus landing on the figure
const flipBtn = [...root.querySelectorAll(".folio-fc-study .fc-mode-btn")].find(
  (b) => b.textContent === "Flip",
);
flipBtn.dispatchEvent(
  new MouseEvent("click", { bubbles: true, composed: true }),
);
await new Promise((res) => setTimeout(res, 200));
const barHiddenInStudy = liveFig.querySelector(".folio-inspector").hidden;
// mousedown on the figure sets lastBlock (as a real click does)
liveFig.dispatchEvent(
  new MouseEvent("mousedown", {
    bubbles: true,
    composed: true,
    clientX: r.left + 5,
    clientY: r.top + 5,
  }),
);
liveFig.focus(); // figure has tabIndex=-1: focus can land here after a real click
window.__pre =
  "matchDefault=" +
  matchVisible +
  " barHiddenAfterOpen=" +
  barHiddenAfterOpen +
  " barHiddenInStudy=" +
  barHiddenInStudy +
  " activeBeforeKey=" +
  (root.activeElement
    ? root.activeElement.tagName + "." + root.activeElement.className
    : "null");
window.__folioCheck = () => {
  const srs = !!root.querySelector(".folio-fc-study .fc-srs");
  const ae = root.activeElement;
  return [
    "",
    "all-sound deck opened in Match: " + matchVisible,
    "inspector bar hidden while studying: " + barHiddenInStudy,
    "REAL space (focus on figure) flipped the card (grade buttons): " + srs,
    "study root regained focus after the key: " +
      (ae ? ae.classList.contains("folio-fc-study") : false),
  ].join(" | ");
};
return "set";
