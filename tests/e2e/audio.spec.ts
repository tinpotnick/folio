import { expect, test, type Page } from "@playwright/test";
import { insertFrom } from "./toolbar-helpers";

/**
 * Audio embeds (spec: docs/specs/audio-embeds.md): a recorded sound
 * is media, the temporal sibling of an image - a `::: audio`
 * directive, played by the native <audio> element, embedded as a
 * data URI or rendered opportunistically from a URL. No execution,
 * no styling: the document stays semantic.
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

/** A real 20 ms mono 8 kHz PCM WAV - the picker accepts it and the
 * native element can load its metadata. */
function tinyWav(): Buffer {
  const sampleRate = 8000;
  const n = 160;
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

test.describe("audio blocks", () => {
  test("a hand-typed audio directive renders the native element", async ({
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
    const audio = figure.locator("audio");
    await expect(audio).toHaveCount(1);
    await expect(audio).toHaveAttribute(
      "src",
      "https://example.com/interview.mp3",
    );
    await expect(audio).toHaveAttribute("controls");
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
