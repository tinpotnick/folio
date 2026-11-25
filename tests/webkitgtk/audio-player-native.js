// folio's own audio player in the REAL engine (WebKitGTK): the
// hidden <audio> engine drives a custom card; the waveform peaks
// must decode (OfflineAudioContext.decodeAudioData), the density
// tier must follow the container width (ResizeObserver), a focused
// player button must own its keys (Backspace must NOT remove the
// figure), and play/speed must run through the engine element.
// (spec: docs/specs/audio-embeds.md; mock-ups: docs/mockups/audio-player/)
const host = document.querySelector("#the-doc");
// A real 1 s mono 8 kHz PCM WAV, built in-page.
const wavB64 = await (async () => {
  const sr = 8000;
  const n = sr;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 2, Math.round(Math.sin(i / 3) * 8000), true);
  }
  let bin = "";
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i += 8192) {
    bin += String.fromCharCode(...u8.subarray(i, i + 8192));
  }
  return btoa(bin);
})();
await host.load(
  `::: audio {#c}\nsrc: data:audio/wav;base64,${wavB64}\nalt: "tone"\n:::\n\n# T\n\ntext\n`,
);
await new Promise((r) => setTimeout(r, 1200));
const root = host.shadowRoot;
const figure = root.querySelector("figure.folio-audio");
const player = figure.querySelector(".folio-audio-player");
const audio = figure.querySelector("audio.folio-audio-engine");
const playBtn = figure.querySelector(".ap-play");
const hasPlayer = !!player && !!audio && !audio.hasAttribute("controls");

// Peaks decoded into real bar heights (flat bars are 4 tall).
await new Promise((r) => setTimeout(r, 1500));
const firstBar = figure.querySelector(".ap-wave-svg .ap-bar");
const peaksOk =
  !player.dataset.peaks &&
  !!firstBar &&
  Number(firstBar.getAttribute("height")) > 4;

// Density tier follows container width (ResizeObserver in WebKitGTK).
figure.style.width = "300px";
await new Promise((r) => setTimeout(r, 400));
const stripOk = player.dataset.density === "strip";
figure.style.width = "150px";
await new Promise((r) => setTimeout(r, 400));
const chipOk = player.dataset.density === "chip";
figure.style.width = "";

// The focused play button owns its keys: Backspace must not remove
// the figure (the article handler yields to player controls).
playBtn.focus();
playBtn.dispatchEvent(
  new KeyboardEvent("keydown", {
    key: "Backspace",
    bubbles: true,
    composed: true,
    cancelable: true,
  }),
);
await new Promise((r) => setTimeout(r, 200));
const stillThere = !!root.querySelector("figure.folio-audio");

// Play toggles through the engine element; the speed chip sets the rate.
playBtn.click();
await new Promise((r) => setTimeout(r, 700));
const playing = !audio.paused && playBtn.getAttribute("aria-label") === "Pause";
const speedBtn = figure.querySelector(".ap-speed");
speedBtn.click();
await new Promise((r) => setTimeout(r, 150));
const opt = [...figure.querySelectorAll(".ap-speed-opt")].find(
  (o) => o.textContent === "1.5×",
);
opt.click();
await new Promise((r) => setTimeout(r, 150));
const rateOk = audio.playbackRate === 1.5 && speedBtn.textContent === "1.5×";

return [
  "",
  "player card over a hidden engine (no native controls): " + hasPlayer,
  "waveform peaks decoded (decodeAudioData): " + peaksOk,
  "density tier strip at 300px (ResizeObserver): " + stripOk,
  "density tier chip at 150px: " + chipOk,
  "Backspace on focused play button keeps the figure: " + stillThere,
  "play button plays through the engine: " + playing,
  "speed chip sets playbackRate 1.5: " + rateOk,
].join(" | ");
