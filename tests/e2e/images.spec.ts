import { expect, test, type Page } from "@playwright/test";

/**
 * Image blocks (spec: docs/specs/images.md): images embed as data
 * URIs in an image directive, render as generated figures, and are
 * edited through the image inspector - never in place.
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

// A real 1x1 red PNG - the smallest valid file the picker accepts.
const RED_DOT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ" +
    "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("image blocks", () => {
  test("the sample document ships an image figure", async ({ page }) => {
    await waitForDocument(page);
    const figure = page.locator("#the-doc figure.folio-image");
    await expect(figure.locator("img")).toBeVisible();
    await expect(figure.locator("img")).toHaveAttribute(
      "alt",
      "Q3 Field Operations cover slide",
    );
    await expect(figure.locator("figcaption")).toContainText(
      "review deck cover",
    );
    // Generated output: the figure is never an editable surface.
    const editable = await figure.evaluate(
      (el) => (el as HTMLElement).isContentEditable,
    );
    expect(editable).toBe(false);
  });

  test("the insert button embeds a picked file and reaches the source", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await page.locator("#image-file").setInputFiles({
      name: "red-dot.png",
      mimeType: "image/png",
      buffer: RED_DOT_PNG,
    });
    // The caret was in the intro paragraph, so the new image
    // lands BEFORE the sample's own image - find it by its alt.
    const img = page.locator('#the-doc figure.folio-image img[alt="red dot"]');
    await expect(img).toHaveCount(1);
    const src = await img.getAttribute("src", { timeout: 5000 });
    expect(src).toMatch(/^data:image\/png;base64,/);
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    // a basic insert is standard Markdown, not a directive (the
    // sample doc's own captioned image stays a directive)
    expect(md).toContain("![red dot](data:image/png;base64,");
    expect(md).not.toContain('alt: "red dot"');
  });

  test("a photo-sized image does not lock the markdown source view", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    // ~4 MB of high-entropy bytes that do NOT decode as an image (no
    // PNG header), so they embed raw: the base64 splits into >100k
    // "words" at every +/= - spell-marking that line pegged the tab
    // (it locked up before the token cap). Valid photos take the
    // downscale path instead - see the test below.
    const photoBytes = Buffer.alloc(4_000_000);
    for (let i = 0; i < photoBytes.length; i++) photoBytes[i] = i % 251;
    const bigPng = photoBytes;
    await page.locator("#image-file").setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: bigPng,
    });
    const img = page.locator('#the-doc figure.folio-image img[alt="photo"]');
    await expect(img).toHaveCount(1);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#md-wrap")).toBeVisible({ timeout: 10_000 });
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("](data:image/png;base64,");
    // the spell pass runs debounced after the switch - the page must
    // still answer afterwards, and the image line must carry no marks
    // (it locked up before the word/token caps)
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => 1 + 1)).toBe(2);
    await expect(page.locator("#md-wrap")).toBeVisible();
    const marksOnImageLine = await page.evaluate(() => {
      // the data URI renders as a chip; find the row by the chip
      const ln = Array.from(document.querySelectorAll("#md-view .ln")).find(
        (l) => l.querySelector(".tk-data"),
      );
      return ln
        ? ln.querySelectorAll(".folio-misspelled, .folio-grammar").length
        : -1;
    });
    expect(marksOnImageLine).toBe(0);
  });

  test("a large photo is downscaled on insert so the source stays small", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    // build a realistic multi-MB photo (4000x3000, gradient + noise)
    const bigB64 = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 4000;
      c.height = 3000;
      const ctx = c.getContext("2d");
      if (!ctx) return "";
      const img = ctx.createImageData(4000, 3000);
      const d = img.data;
      for (let y = 0; y < 3000; y++) {
        for (let x = 0; x < 4000; x++) {
          const i = (y * 4000 + x) * 4;
          d[i] = (x / 16 + ((x * y) % 97)) % 256;
          d[i + 1] = (y / 12 + ((x ^ y) % 89)) % 256;
          d[i + 2] = ((x + y) % 211) % 256;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const blob = await new Promise<Blob | null>((r) =>
        c.toBlob(r, "image/jpeg", 0.95),
      );
      if (!blob) return "";
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) {
        bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      return btoa(bin);
    });
    expect(bigB64.length).toBeGreaterThan(2_000_000); // multi-MB photo
    await page.locator("#image-file").setInputFiles({
      name: "big-photo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(bigB64, "base64"),
    });
    const img = page.locator(
      '#the-doc figure.folio-image img[alt="big photo"]',
    );
    await expect(img).toHaveCount(1);
    const src = await img.getAttribute("src", { timeout: 15_000 });
    // re-encoded as JPEG and shrunk far below the original bytes
    expect(src).toMatch(/^data:image\/jpeg;base64,/);
    expect((src ?? "").length).toBeLessThan(bigB64.length / 3);
    expect((src ?? "").length).toBeLessThan(1_500_000);
    const w = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    expect(w).toBeLessThanOrEqual(2048);
    // and the markdown source holds the small line, not the photo
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("](data:image/jpeg;base64,");
    expect(md.length).toBeLessThan(bigB64.length / 2);
  });

  test("'Keep original image quality' disables downscaling", async ({
    page,
  }) => {
    await waitForDocument(page);
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    // a photo-like JPEG over the 400 KB target
    const bigB64 = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 3000;
      c.height = 2200;
      const ctx = c.getContext("2d");
      if (!ctx) return "";
      const img = ctx.createImageData(3000, 2200);
      const d = img.data;
      for (let y = 0; y < 2200; y++) {
        for (let x = 0; x < 3000; x++) {
          const i = (y * 3000 + x) * 4;
          d[i] = (x / 16 + ((x * y) % 97)) % 256;
          d[i + 1] = (y / 12 + ((x ^ y) % 89)) % 256;
          d[i + 2] = ((x + y) % 211) % 256;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const blob = await new Promise<Blob | null>((r) =>
        c.toBlob(r, "image/jpeg", 0.95),
      );
      if (!blob) return "";
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) {
        bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      return btoa(bin);
    });
    expect(bigB64.length).toBeGreaterThan(600_000); // over the 400 KB target
    // toggle the opt-out via the palette
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("original image");
    await expect(
      page.locator("#palette-list .palette-item").first(),
    ).toContainText("Keep original image quality");
    await page.keyboard.press("Enter");
    await expect(page.locator("#palette-modal")).toBeHidden();
    await page.locator("#image-file").setInputFiles({
      name: "big-photo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(bigB64, "base64"),
    });
    const img = page.locator(
      '#the-doc figure.folio-image img[alt="big photo"]',
    );
    await expect(img).toHaveCount(1);
    const src = await img.getAttribute("src", { timeout: 15_000 });
    // original bytes embedded: the data URL is as long as the file,
    // not shrunk
    expect((src ?? "").length).toBeGreaterThan(bigB64.length - 64);
  });

  test("content can be added below a trailing image without the source view", async ({
    page,
  }) => {
    const TRAILING =
      '# T\n\nPara text\n\n::: image {#image-1}\nsrc: https://example.com/x.png\nalt: "x"\n:::\n';
    const md = () =>
      page.evaluate(() => {
        const el = document.querySelector("#the-doc") as unknown as {
          getMarkdown: () => string | null;
        };
        return el.getMarkdown() ?? "";
      });

    // ArrowDown from the end of the paragraph above the trailing image
    await loadDoc(page, TRAILING);
    await page.locator("#the-doc p", { hasText: "Para text" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.type("hello");
    await expect.poll(async () => await md()).toContain(":::\n\nhello");

    // ArrowDown while the image itself is selected
    await loadDoc(page, TRAILING);
    await page.locator("#the-doc figure.folio-image img").click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.type("world");
    await expect.poll(async () => await md()).toContain(":::\n\nworld");

    // clicking the empty space below the trailing image
    await loadDoc(page, TRAILING);
    const art = await page.locator("#the-doc article").boundingBox();
    const fig = await page.locator("#the-doc figure.folio-image").boundingBox();
    if (!art || !fig) throw new Error("layout missing");
    await page.mouse.click(art.x + art.width / 2, fig.y + fig.height + 60);
    await page.keyboard.type("below");
    await expect.poll(async () => await md()).toContain(":::\n\nbelow");
  });

  test("the inspector's crop tool crops the image (drag + zoom + apply)", async ({
    page,
  }) => {
    // a 200x100 image with four distinct quadrants
    const quadB64 = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 100;
      const ctx = c.getContext("2d");
      if (!ctx) return "";
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, 100, 50);
      ctx.fillStyle = "#00ff00";
      ctx.fillRect(100, 0, 100, 50);
      ctx.fillStyle = "#0000ff";
      ctx.fillRect(0, 50, 100, 50);
      ctx.fillStyle = "#ffff00";
      ctx.fillRect(100, 50, 100, 50);
      const blob = await new Promise<Blob | null>((r) =>
        c.toBlob(r, "image/png"),
      );
      if (!blob) return "";
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) {
        bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      return btoa(bin);
    });
    await loadDoc(page, `# T\n\n![quads](data:image/png;base64,${quadB64})`);
    const figure = page.locator("#the-doc figure.folio-image");
    const img = figure.locator("img");
    await expect(img).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect
      .poll(
        async () =>
          await img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
      )
      .toBe(200);

    await img.click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await insp.locator(".insp-crop").click();
    await expect(figure.locator(".folio-crop-overlay")).toBeVisible();

    // zoom to 2x: the displayed image doubles
    const w1 = await img.boundingBox();
    await insp.locator(".insp-zoom").evaluate((el) => {
      (el as HTMLInputElement).value = "2";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const w2 = await img.boundingBox();
    if (!w1 || !w2) throw new Error("no img box");
    expect(w2.width).toBeCloseTo(w1.width * 2, 0);

    // drag a rect over the top-left quadrant (fractions 0.1..0.5)
    const box = await img.boundingBox();
    if (!box) throw new Error("no img box");
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, {
      steps: 5,
    });
    await page.mouse.up();
    await expect(figure.locator(".folio-crop-rect")).toBeVisible();

    await insp.locator(".insp-apply").click();
    // the crop applied: 40% of 200x100 at natural resolution
    await expect
      .poll(
        async () =>
          await img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
      )
      .toBe(80);
    await expect
      .poll(
        async () =>
          await img.evaluate((el) => (el as HTMLImageElement).naturalHeight),
      )
      .toBe(40);
    await expect(img).toHaveAttribute("src", /^data:image\//);
    // crop mode exited, source holds the cropped data URI
    await expect(figure.locator(".folio-crop-overlay")).toHaveCount(0);
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toMatch(/!\[quads\]\(data:image\//);
  });

  test("crop drag held at the stage edge auto-scrolls, extending the selection past the viewport", async ({
    page,
  }) => {
    // a 2000x80 image - wider than the article, so the crop stage
    // scrolls horizontally
    const wideB64 = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 2000;
      c.height = 80;
      const ctx = c.getContext("2d");
      if (!ctx) return "";
      ctx.fillStyle = "#3366cc";
      ctx.fillRect(0, 0, 2000, 80);
      const blob = await new Promise<Blob | null>((r) =>
        c.toBlob(r, "image/png"),
      );
      if (!blob) return "";
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) {
        bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      return btoa(bin);
    });
    await loadDoc(page, `# T\n\n![wide](data:image/png;base64,${wideB64})`);
    const figure = page.locator("#the-doc figure.folio-image");
    const img = figure.locator("img");
    await expect
      .poll(
        async () =>
          await img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
      )
      .toBe(2000);

    await img.click();
    const insp = figure.locator(".folio-inspector");
    await insp.locator(".insp-crop").click();
    const stage = figure.locator(".folio-crop-stage");
    await expect(stage).toBeVisible();
    const sb = await stage.boundingBox();
    const ib = await img.boundingBox();
    if (!sb || !ib) throw new Error("no boxes");
    // the image is wider than the visible stage
    expect(ib.width).toBeGreaterThan(sb.width + 200);

    // drag from near the left edge and hold the pointer at the
    // stage's right edge: the stage must auto-scroll and the
    // selection must grow past the visible width
    const y0 = ib.y + ib.height * 0.1;
    const y1 = ib.y + ib.height * 0.9;
    await page.mouse.move(sb.x + 40, y0);
    await page.mouse.down();
    await page.mouse.move(sb.x + sb.width - 4, y1, { steps: 5 });
    await expect
      .poll(async () => await stage.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(50);
    await expect
      .poll(async () => {
        const r = await figure
          .locator(".folio-crop-rect")
          .evaluate((el) => Number(el.style.width.replace("px", "")));
        return r > sb.width;
      })
      .toBe(true);
    await page.mouse.up();

    // applying crops to the full dragged region - wider than the
    // initially visible stage (poll: re-encode + re-render is async)
    await insp.locator(".insp-apply").click();
    await expect
      .poll(async () => {
        const w = await img.evaluate(
          (el) => (el as HTMLImageElement).naturalWidth,
        );
        return w > sb.width && w < 2000; // past the viewport, not all
      })
      .toBe(true);
  });

  test("crop rect handles resize and move the selection; the bar wraps so Apply stays visible", async ({
    page,
  }) => {
    const quadB64 = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 100;
      const ctx = c.getContext("2d");
      if (!ctx) return "";
      ctx.fillStyle = "#3366cc";
      ctx.fillRect(0, 0, 200, 100);
      const blob = await new Promise<Blob | null>((r) =>
        c.toBlob(r, "image/png"),
      );
      if (!blob) return "";
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) {
        bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      return btoa(bin);
    });

    await loadDoc(page, `# T\n\n![q](data:image/png;base64,${quadB64})`);
    const figure = page.locator("#the-doc figure.folio-image");
    const img = figure.locator("img");
    await img.click();
    const insp = figure.locator(".folio-inspector");
    await insp.locator(".insp-crop").click();
    await expect(figure.locator(".folio-crop-overlay")).toBeVisible();
    // crop mode makes the bar wrap, so the appended controls stay inside it
    await expect(insp).toHaveClass(/cropping/);

    // draw a selection over fractions 0.2..0.6
    const box = await img.boundingBox();
    if (!box) throw new Error("no img box");
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, {
      steps: 4,
    });
    await page.mouse.up();
    const rect = figure.locator(".folio-crop-rect");
    await expect(rect).toBeVisible();
    // four corner handles plus a centre handle
    await expect(rect.locator(".folio-crop-handle")).toHaveCount(5);
    const r1 = await rect.boundingBox();
    if (!r1) throw new Error("no rect box");

    // grab the SE corner handle and drag it out to 0.9: the rect grows
    const se = rect.locator(".folio-crop-h-se");
    const sh = await se.boundingBox();
    if (!sh) throw new Error("no handle box");
    await page.mouse.move(sh.x + sh.width / 2, sh.y + sh.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.9, {
      steps: 4,
    });
    await page.mouse.up();
    const r2 = await rect.boundingBox();
    if (!r2) throw new Error("no rect box");
    expect(r2.width).toBeGreaterThan(r1.width + 20);
    expect(r2.height).toBeGreaterThan(r1.height + 20);

    // grab the centre handle and drag left/up: the rect moves, same size
    const mv = rect.locator(".folio-crop-h-move");
    const mh = await mv.boundingBox();
    if (!mh) throw new Error("no move handle box");
    await page.mouse.move(mh.x + mh.width / 2, mh.y + mh.height / 2);
    await page.mouse.down();
    await page.mouse.move(mh.x - 30, mh.y - 20, { steps: 4 });
    await page.mouse.up();
    const r3 = await rect.boundingBox();
    if (!r3) throw new Error("no rect box");
    expect(r3.x).toBeLessThan(r2.x - 10);
    expect(r3.y).toBeLessThan(r2.y - 5);
    expect(r3.width).toBeCloseTo(r2.width, 0);

    // Apply/Cancel sit inside the bar's visible box (the bar wrapped)
    const barBox = await insp.boundingBox();
    const applyBox = await insp.locator(".insp-apply").boundingBox();
    const cancelBox = await insp.locator(".insp-cancel").boundingBox();
    if (!barBox || !applyBox || !cancelBox) throw new Error("no bar boxes");
    expect(applyBox.x + applyBox.width).toBeLessThanOrEqual(
      barBox.x + barBox.width + 1,
    );
    expect(cancelBox.x + cancelBox.width).toBeLessThanOrEqual(
      barBox.x + barBox.width + 1,
    );

    // applying crops to the handled region (smaller than the image)
    await insp.locator(".insp-apply").click();
    await expect
      .poll(async () => {
        const w = await img.evaluate(
          (el) => (el as HTMLImageElement).naturalWidth,
        );
        return w > 60 && w < 200;
      })
      .toBe(true);
  });

  test("theme figure.image.* keys lay out images document-wide (float wraps text)", async ({
    page,
  }) => {
    // a 200x100 image so the figure has a real box

    const quadB64 = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 100;
      const ctx = c.getContext("2d");
      if (!ctx) return "";
      ctx.fillStyle = "#3366cc";
      ctx.fillRect(0, 0, 200, 100);
      const blob = await new Promise<Blob | null>((r) =>
        c.toBlob(r, "image/png"),
      );
      if (!blob) return "";
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) {
        bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      return btoa(bin);
    });

    const md = [
      "---",
      "style:",
      "  figure.image.layout: float-left",
      "  figure.image.width: 40%",
      "---",
      "",
      "# T",
      "",
      `![box](data:image/png;base64,${quadB64})`,
      "",
      "Wrap text ".repeat(60),
    ].join("\n");
    await loadDoc(page, md);
    const figure = page.locator("#the-doc figure.folio-image");
    const cs = await figure.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        float: s.cssFloat,
        maxWidth: s.maxWidth,
        marginTop: parseFloat(s.marginTop),
      };
    });
    expect(cs.float).toBe("left");
    // the paragraph flows BESIDE the floated figure, not below it
    const fr = await figure.boundingBox();
    const pr = await page.locator("#the-doc p").last().boundingBox();
    if (!fr || !pr) throw new Error("no boxes");
    expect(pr.y).toBeLessThan(fr.y + fr.height);
    // starts at the float's top edge (boundingBox excludes the float's
    // own top margin, which sits above it)
    expect(pr.y).toBeGreaterThanOrEqual(fr.y - cs.marginTop - 2);

    // block + align right instead: no float, auto left margin
    const md2 = md
      .replace("figure.image.layout: float-left", "figure.image.layout: block")
      .replace(
        "figure.image.width: 40%",
        "figure.image.align: right\n  figure.image.width: 40%",
      );
    await loadDoc(page, md2);
    const cs2 = await page
      .locator("#the-doc figure.folio-image")
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          float: s.cssFloat,
          marginLeft: s.marginLeft,
          marginRight: s.marginRight,
        };
      });
    expect(cs2.float).toBe("none");
    expect(cs2.marginLeft).not.toBe("0px");
    expect(cs2.marginRight).toBe("0px");
  });

  test("a hand-typed Markdown image renders and stays standard in the source", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n![A cat](https://example.com/cat.png)");
    const figure = page.locator("#the-doc figure.folio-image");
    await expect(figure.locator("img")).toHaveAttribute("alt", "A cat");
    await expect(figure.locator("img")).toHaveAttribute(
      "src",
      "https://example.com/cat.png",
    );
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    // standard form round-trips unchanged - no directive upgrade
    expect(md).toContain("![A cat](https://example.com/cat.png)");
    expect(md).not.toContain("::: image");
  });

  test("the image inspector edits alt and caption in place", async ({
    page,
  }) => {
    await waitForDocument(page);
    const figure = page.locator("#the-doc figure.folio-image").first();
    await figure.locator("img").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await insp.locator(".insp-alt").fill("The all-hands cover");
    await insp.locator(".insp-alt").press("Enter");
    await expect(figure.locator("img")).toHaveAttribute(
      "alt",
      "The all-hands cover",
    );
    await insp.locator(".insp-caption").fill("A new caption");
    await insp.locator(".insp-caption").press("Enter");
    await expect(figure.locator("figcaption")).toHaveText("A new caption");
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain('alt: "The all-hands cover"');
    expect(md).toContain('caption: "A new caption"');
  });

  test("adding a caption upgrades a standard image to the directive", async ({
    page,
  }) => {
    await loadDoc(page, "# T\n\n![A cat](https://example.com/cat.png)");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      "![A cat](https://example.com/cat.png)",
    );
    await page.locator("#btn-view").click();
    const figure = page.locator("#the-doc figure.folio-image");
    await figure.locator("img").click();
    const insp = figure.locator(".folio-inspector");
    await insp.locator(".insp-caption").fill("My cat");
    await insp.locator(".insp-caption").press("Enter");
    await expect(figure.locator("figcaption")).toHaveText("My cat");
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    // caption needs the directive form: id assigned, directive emitted
    expect(md).toContain("::: image {#image-1}");
    expect(md).toContain("src: https://example.com/cat.png");
    expect(md).toContain('caption: "My cat"');
  });

  test("'Download and embed' inlines an external image on explicit action", async ({
    page,
  }) => {
    await page.route("https://example.com/pic.png", (route) =>
      route.fulfill({ contentType: "image/png", body: RED_DOT_PNG }),
    );
    await loadDoc(page, "# T\n\n![A pic](https://example.com/pic.png)");
    const figure = page.locator("#the-doc figure.folio-image");
    await expect(figure.locator("img")).toHaveAttribute(
      "src",
      "https://example.com/pic.png",
    );
    // nothing is fetched until the user asks
    await page.waitForTimeout(500);
    await expect(figure.locator("img")).toHaveAttribute(
      "src",
      "https://example.com/pic.png",
    );
    await figure.locator("img").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp.locator(".insp-embed")).toBeVisible();
    await insp.locator(".insp-embed").click();
    await expect(figure.locator("img")).toHaveAttribute(
      "src",
      /^data:image\/png;base64,/,
    );
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    expect(md).toContain("![A pic](data:image/png;base64,");
  });

  test("the inspector replaces the image file", async ({ page }) => {
    await waitForDocument(page);
    const figure = page.locator("#the-doc figure.folio-image").first();
    await figure.locator("img").click();
    const insp = figure.locator(".folio-inspector");
    await insp.locator(".insp-file").setInputFiles({
      name: "dot.png",
      mimeType: "image/png",
      buffer: RED_DOT_PNG,
    });
    await expect
      .poll(async () =>
        figure.locator("img").evaluate((el) => (el as HTMLImageElement).src),
      )
      .toMatch(/^data:image\/png;base64,/);
  });

  test("Backspace on a selected image removes the block", async ({ page }) => {
    await waitForDocument(page);
    const count = await page.locator("#the-doc figure.folio-image").count();
    expect(count).toBeGreaterThan(0);
    await page.locator("#the-doc figure.folio-image img").first().click();
    await page.keyboard.press("Backspace");
    await expect(page.locator("#the-doc figure.folio-image")).toHaveCount(
      count - 1,
    );
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).not.toContain(
      "::: image",
    );
  });

  test("the inspector follows the uniform dismissal contract", async ({
    page,
  }) => {
    await waitForDocument(page);
    const figure = page.locator("#the-doc figure.folio-image").first();
    await figure.locator("img").click();
    const insp = figure.locator(".folio-inspector");
    await expect(insp).toBeVisible();
    await page.locator("folio-doc p", { hasText: "Revenue recovered" }).click();
    await expect(insp).toBeHidden();
  });

  test("an oversized image is refused with a visible message", async ({
    page,
  }) => {
    await waitForDocument(page);
    const before = await page.locator("#the-doc figure.folio-image").count();
    await page.locator("#image-file").setInputFiles({
      name: "huge.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(9 * 1024 * 1024, 1),
    });
    await expect(page.locator("#status")).toContainText("too large");
    await expect(page.locator("#the-doc figure.folio-image")).toHaveCount(
      before,
    );
  });
});
