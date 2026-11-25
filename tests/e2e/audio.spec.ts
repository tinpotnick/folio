import { expect, test, type Page } from "@playwright/test";
import { insertFrom } from "./toolbar-helpers";

/**
 * Audio embeds (spec: docs/specs/audio-embeds.md): a recorded sound
 * is media, the temporal sibling of an image - a `::: audio`
 * directive embedded as a data URI or rendered opportunistically
 * from a URL. Playback is folio's own player (a theme-styled card
 * over a hidden <audio> engine - mock-ups: docs/mockups/
 * audio-player/): play/pause, waveform seek, time, speed chip,
 * hover volume/download, density tiers by container width.
 */

async function waitForDocument(page: Page): Promise<void> {
  await page.goto("/?doc=demo/examples/field-operations.md");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
}

async function loadDoc(page: Page, markdown: string): Promise<void> {
  await waitForDocument(page);
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

/** A real mono 8 kHz PCM WAV of the given length - the picker
 * accepts it and the engine can load its metadata. */
function wavOf(seconds: number): Buffer {
  const sampleRate = 8000;
  const n = Math.floor(sampleRate * seconds);
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.sin(i / 3) * 8000), 44 + i * 2);
  }
  return buf;
}

function tinyWav(): Buffer {
  return wavOf(0.02);
}

function wavDataUri(seconds: number): string {
  return `data:audio/wav;base64,${wavOf(seconds).toString("base64")}`;
}

test.describe("audio blocks", () => {
  test("a hand-typed audio directive renders folio's player over a hidden engine", async ({
    page,
  }) => {
    await loadDoc(
      page,
      "::: audio {#clip}\n" +
        "src: https://example.com/interview.mp3\n" +
        'alt: "the founder, on tape"\n' +
        'caption: "Founders interview, take two"\n' +
        ":::",
    );
    const figure = page.locator("#the-doc figure.folio-audio");
    await expect(figure).toHaveCount(1);
    // The platform element is still there - as the playback engine,
    // without its native controls.
    const audio = figure.locator("audio.folio-audio-engine");
    await expect(audio).toHaveCount(1);
    await expect(audio).toHaveAttribute(
      "src",
      "https://example.com/interview.mp3",
    );
    expect(await audio.evaluate((el) => el.hasAttribute("controls"))).toBe(
      false,
    );
    // folio's own player chrome: play disc, waveform, time, speed.
    const player = figure.locator(".folio-audio-player");
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute("data-density", "card");
    await expect(player.locator(".ap-play")).toBeVisible();
    await expect(player.locator(".ap-wave")).toBeVisible();
    await expect(player.locator(".ap-wave-svg .ap-bar").first()).toBeAttached();
    await expect(player.locator(".ap-time")).toContainText("0:00");
    await expect(player.locator(".ap-speed")).toHaveText("1×");
    // An external URL's peaks are not decodable here - the player
    // falls back to the plain progress track.
    await expect(player).toHaveAttribute("data-peaks", "none");
    await expect(figure.locator(".folio-audio-label")).toHaveText(
      "the founder, on tape",
    );
    await expect(figure.locator("figcaption")).toHaveText(
      "Founders interview, take two",
    );
    // Generated output: the figure is never an editable surface.
    const editable = await figure.evaluate(
      (el) => (el as HTMLElement).isContentEditable,
    );
    expect(editable).toBe(false);
    // Round-trip: the directive is already canonical.
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("::: audio {#clip}");
    expect(md).toContain('alt: "the founder, on tape"');
  });

  test("the play button plays and pauses through the hidden engine", async ({
    page,
  }) => {
    await loadDoc(
      page,
      `::: audio {#clip}\nsrc: ${wavDataUri(2)}\nalt: "tone"\n:::`,
    );
    const figure = page.locator("#the-doc figure.folio-audio");
    const audio = figure.locator("audio.folio-audio-engine");
    const play = figure.locator(".ap-play");
    // The data URI decodes into real waveform peaks.
    await expect
      .poll(async () =>
        figure
          .locator(".ap-wave-svg .ap-bar")
          .first()
          .evaluate((r) => Number(r.getAttribute("height"))),
      )
      .toBeGreaterThan(4);
    await expect(figure.locator(".folio-audio-player")).not.toHaveAttribute(
      "data-peaks",
      "none",
    );
    // Data URIs attach with preload=none (no media pipeline until
    // play), so the duration settles when playback starts.
    await expect(audio).toHaveAttribute("preload", "none");
    await play.click();
    await expect(play).toHaveAttribute("aria-label", "Pause");
    await expect
      .poll(async () => audio.evaluate((el) => (el as HTMLAudioElement).paused))
      .toBe(false);
    await expect
      .poll(async () =>
        audio.evaluate((el) => (el as HTMLAudioElement).duration),
      )
      .toBeGreaterThan(1.5);
    await expect(figure.locator(".ap-total")).toHaveText("0:02");
    await play.click();
    await expect(play).toHaveAttribute("aria-label", "Play");
    await expect
      .poll(async () => audio.evaluate((el) => (el as HTMLAudioElement).paused))
      .toBe(true);
  });

  test("clicking the waveform seeks", async ({ page }) => {
    await loadDoc(page, `::: audio {#clip}\nsrc: ${wavDataUri(2)}\n:::`);
    const figure = page.locator("#the-doc figure.folio-audio");
    const audio = figure.locator("audio.folio-audio-engine");
    // preload=none: start playback so the metadata (duration) loads.
    await figure.locator(".ap-play").click();
    await expect
      .poll(async () =>
        audio.evaluate((el) => (el as HTMLAudioElement).duration),
      )
      .toBeGreaterThan(1.5);
    const wave = figure.locator(".ap-wave");
    const box = await wave.boundingBox();
    if (!box) throw new Error("waveform not laid out");
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
    await expect
      .poll(async () =>
        audio.evaluate((el) => (el as HTMLAudioElement).currentTime),
      )
      .toBeGreaterThan(1.2);
    // The played portion of the waveform is filled up to the click.
    await expect
      .poll(async () => figure.locator(".ap-wave-svg .ap-bar.on").count())
      .toBeGreaterThan(90);
  });

  test("the speed chip sets the playback rate", async ({ page }) => {
    await loadDoc(
      page,
      "# T\n\nSome prose to click away to.\n\n" +
        `::: audio {#clip}\nsrc: ${wavDataUri(2)}\n:::`,
    );
    const figure = page.locator("#the-doc figure.folio-audio");
    const audio = figure.locator("audio.folio-audio-engine");
    const speed = figure.locator(".ap-speed");
    await speed.click();
    const pop = figure.locator(".ap-speed-pop");
    await expect(pop).toBeVisible();
    await pop.locator(".ap-speed-opt", { hasText: "1.5×" }).click();
    await expect
      .poll(async () =>
        audio.evaluate((el) => (el as HTMLAudioElement).playbackRate),
      )
      .toBe(1.5);
    await expect(speed).toHaveText("1.5×");
    await expect(pop).toBeHidden();
    // The popover closes on a press outside the figure, too.
    await speed.click();
    await expect(pop).toBeVisible();
    await page
      .locator("folio-doc p", { hasText: "Some prose to click away to" })
      .click();
    await expect(pop).toBeHidden();
  });

  test("the player picks its density tier from the container width", async ({
    page,
  }) => {
    await loadDoc(page, `::: audio {#clip}\nsrc: ${wavDataUri(1)}\n:::`);
    const figure = page.locator("#the-doc figure.folio-audio");
    const player = figure.locator(".folio-audio-player");
    await expect(player).toHaveAttribute("data-density", "card");
    await figure.evaluate((el) => {
      (el as HTMLElement).style.width = "340px";
    });
    await expect(player).toHaveAttribute("data-density", "strip");
    await figure.evaluate((el) => {
      (el as HTMLElement).style.width = "176px";
    });
    await expect(player).toHaveAttribute("data-density", "chip");
  });

  test("Backspace on a focused player button does not remove the figure", async ({
    page,
  }) => {
    await loadDoc(page, `::: audio {#clip}\nsrc: ${wavDataUri(2)}\n:::`);
    const figure = page.locator("#the-doc figure.folio-audio");
    const play = figure.locator(".ap-play");
    await play.click();
    await expect(play).toBeFocused();
    await page.keyboard.press("Backspace");
    await expect(figure).toHaveCount(1);
    // Space on the focused button toggles playback (native button
    // behavior, not the figure's removal path).
    await page.keyboard.press("Space");
    await expect
      .poll(async () =>
        figure
          .locator("audio")
          .evaluate((el) => (el as HTMLAudioElement).paused),
      )
      .toBe(true);
  });

  test("print hides the player but keeps the label and caption", async ({
    page,
  }) => {
    await loadDoc(
      page,
      "::: audio {#clip}\n" +
        "src: https://example.com/a.mp3\n" +
        'alt: "the clip"\n' +
        'caption: "A caption"\n' +
        ":::",
    );
    const figure = page.locator("#the-doc figure.folio-audio");
    await page.emulateMedia({ media: "print" });
    await expect(figure.locator(".folio-audio-player")).toBeHidden();
    await expect(figure.locator(".folio-audio-label")).toBeVisible();
    await expect(figure.locator("figcaption")).toBeVisible();
    await page.emulateMedia({ media: "screen" });
    await expect(figure.locator(".folio-audio-player")).toBeVisible();
  });

  test("data-URI clips load with preload=none (no perpetual spinner on WebKitGTK)", async ({
    page,
  }) => {
    const wav = tinyWav().toString("base64");
    await loadDoc(
      page,
      "::: audio {#embed}\nsrc: data:audio/wav;base64," +
        wav +
        "\n:::\n\n" +
        "::: audio {#remote}\nsrc: https://example.com/interview.mp3\n:::\n",
    );
    const figs = page.locator("#the-doc figure.folio-audio");
    await expect(figs).toHaveCount(2);
    await expect(figs.nth(0).locator("audio")).toHaveAttribute(
      "preload",
      "none",
    );
    await expect(figs.nth(1).locator("audio")).toHaveAttribute(
      "preload",
      "metadata",
    );
  });

  test("an off-screen audio figure is pending and attaches when scrolled near", async ({
    page,
  }) => {
    const filler = Array.from(
      { length: 200 },
      (_, i) => `Paragraph ${String(i)} with some words to push it down.`,
    ).join("\n\n");
    const wav = tinyWav().toString("base64");
    await loadDoc(
      page,
      `# T\n\n${filler}\n\n::: audio {#far}\nsrc: data:audio/wav;base64,${wav}\nalt: "far clip"\n:::
`,
    );
    const figure = page.locator("#the-doc figure.folio-audio");
    await expect(figure).toHaveCount(1);
    // Below the fold: placeholder, no media widget yet.
    await expect(figure).toHaveAttribute("data-pending", "figure");
    await expect(figure.locator(".folio-audio-pending")).toBeVisible();
    await expect(figure.locator("audio")).toHaveCount(0);
    // The label strip is still the figure's identity.
    await expect(figure.locator(".folio-audio-label")).toHaveText("far clip");
    // Scroll it into view: the player attaches.
    await figure.scrollIntoViewIfNeeded();
    await expect(figure.locator("audio")).toHaveCount(1);
    await expect(figure).not.toHaveAttribute("data-pending", /.*/);
    await expect(figure.locator("audio")).toHaveAttribute("preload", "none");
  });

  test("the insert button embeds a picked file and reaches the source", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#audio-file").setInputFiles({
      name: "porch-chimes.wav",
      mimeType: "audio/wav",
      buffer: tinyWav(),
    });
    const figure = page.locator("#the-doc figure.folio-audio");
    await expect(figure).toHaveCount(1);
    // The file name became the alt text.
    await expect(figure.locator("audio")).toHaveAttribute(
      "title",
      "porch chimes",
    );
    await expect
      .poll(async () =>
        figure.locator("audio").evaluate((el) => (el as HTMLAudioElement).src),
      )
      .toMatch(/^data:audio\/wav;base64,/);
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("::: audio {#audio-1}");
    expect(md).toContain('alt: "porch chimes"');
    expect(md).toMatch(/^src: data:audio\/wav;base64,.*$/m);
  });

  test("the audio inspector edits alt and caption in place", async ({
    page,
  }) => {
    await loadDoc(
      page,
      "::: audio {#clip}\n" +
        "src: https://example.com/a.mp3\n" +
        'alt: "before"\n' +
        ":::",
    );
    const figure = page.locator("#the-doc figure.folio-audio");
    // The alt-text strip is the figure's clickable identity - the
    // native player swallows pointer events.
    await expect(figure.locator(".folio-audio-label")).toHaveText("before");
    await figure.locator(".folio-audio-label").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await insp.locator(".insp-alt").fill("the porch, April");
    await insp.locator(".insp-alt").press("Enter");
    await expect(figure.locator("audio")).toHaveAttribute(
      "title",
      "the porch, April",
    );
    await expect(figure.locator(".folio-audio-label")).toHaveText(
      "the porch, April",
    );
    await insp.locator(".insp-caption").fill("Wind chimes at dusk");
    await insp.locator(".insp-caption").press("Enter");
    await expect(figure.locator("figcaption")).toHaveText(
      "Wind chimes at dusk",
    );
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain('alt: "the porch, April"');
    expect(md).toContain('caption: "Wind chimes at dusk"');
  });

  test("the inspector replaces the audio file", async ({ page }) => {
    await loadDoc(
      page,
      "::: audio {#clip}\n" + "src: https://example.com/a.mp3\n" + ":::",
    );
    const figure = page.locator("#the-doc figure.folio-audio");
    await figure.locator(".folio-audio-label").click();
    const insp = figure.locator(".folio-inspector");
    await insp.locator(".insp-file").setInputFiles({
      name: "tone.wav",
      mimeType: "audio/wav",
      buffer: tinyWav(),
    });
    await expect
      .poll(async () =>
        figure.locator("audio").evaluate((el) => (el as HTMLAudioElement).src),
      )
      .toMatch(/^data:audio\/wav;base64,/);
  });

  test("the inspector follows the uniform dismissal contract", async ({
    page,
  }) => {
    await loadDoc(
      page,
      "# T\n\nSome prose to click away to.\n\n" +
        "::: audio {#clip}\n" +
        "src: https://example.com/a.mp3\n" +
        ":::",
    );
    const figure = page.locator("#the-doc figure.folio-audio");
    await figure.locator(".folio-audio-label").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await page
      .locator("folio-doc p", { hasText: "Some prose to click away to" })
      .click();
    await expect(insp).toBeHidden();
  });

  test("Backspace on a selected audio figure removes the block", async ({
    page,
  }) => {
    await loadDoc(
      page,
      "::: audio {#clip}\n" + "src: https://example.com/a.mp3\n" + ":::",
    );
    await page
      .locator("#the-doc figure.folio-audio .folio-audio-label")
      .click();
    await page.keyboard.press("Backspace");
    await expect(page.locator("#the-doc figure.folio-audio")).toHaveCount(0);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).not.toContain(
      "::: audio",
    );
  });

  test("an oversized sound file is refused with a visible message", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = await page.locator("#the-doc figure.folio-audio").count();
    await page.locator("#audio-file").setInputFiles({
      name: "huge.wav",
      mimeType: "audio/wav",
      buffer: Buffer.alloc(9 * 1024 * 1024, 1),
    });
    await expect(page.locator("#status")).toContainText("too large");
    await expect(page.locator("#the-doc figure.folio-audio")).toHaveCount(
      before,
    );
  });
});

test.describe("recording", () => {
  test("the mic button records from the microphone and embeds the clip", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await insertFrom(page, "btn-record");
    // The button pulses while capture runs, and the status counts.
    await expect(page.locator("#btn-record")).toHaveClass(/rec/);
    await expect(page.locator("#status")).toContainText("Recording 0:0");
    await page.waitForTimeout(1200);
    // The same button stops the capture.
    await insertFrom(page, "btn-record");
    await expect(page.locator("#btn-record")).not.toHaveClass(/rec/);
    const figure = page.locator("#the-doc figure.folio-audio");
    await expect(figure).toHaveCount(1);
    const src = await figure
      .locator("audio")
      .evaluate((el) => (el as HTMLAudioElement).src);
    expect(src).toMatch(/^data:audio\//);
    // The clip's alt seeds from the recording itself.
    await expect(figure.locator(".folio-audio-label")).toHaveText("Recording");
    await expect(page.locator("#status")).toContainText("Recorded 0:0");
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toMatch(/^src: data:audio\/.*$/m);
  });

  test("a denial shows a visible message instead of failing silently", async ({
    browser,
  }) => {
    // The launch flags auto-grant the mic, so this context stubs
    // getUserMedia to reject - the visible error path.
    const context = await browser.newContext();
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new Error("Permission denied"));
    });
    const page = await context.newPage();
    await page.goto("/?doc=demo/examples/field-operations.md");
    await expect(
      page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
    ).toBeVisible();
    await insertFrom(page, "btn-record");
    await expect(page.locator("#status")).toContainText(
      /Microphone unavailable|permission/,
    );
    await expect(page.locator("#btn-record")).not.toHaveClass(/rec/);
    await context.close();
  });
});
