import { expect, test, type Page } from "@playwright/test";

/**
 * Strudel music blocks (ADR-0014, spec: docs/specs/
 * strudel-blocks.md): a ```strudel fence renders as a figure with
 * a player in its inspector; the block stays a plain fence in the
 * model, so round-trip identity holds.
 */
async function loadDoc(page: Page, markdown: string): Promise<void> {
  await page.goto("/");
  await expect(
    page.locator("folio-doc h1", { hasText: "Q3 Field Operations Review" }),
  ).toBeVisible();
  await page.locator("#btn-markdown").click();
  await page.locator("#editor").fill(markdown);
  await page.locator("#btn-view").click();
}

const SRC = '# T\n\n```strudel\nnote("c a f e")\n```\n';

test.describe("strudel music blocks", () => {
  test("a strudel fence renders a figure with the source and inspector", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await expect(figure).toBeVisible();
    await expect(figure.locator("pre.strudel-source")).toHaveText(
      'note("c a f e")',
    );
    await expect(figure.locator(".folio-inspector .strudel-play")).toBeHidden();
  });

  test("clicking the block reveals the code header set to Strudel with the player; a click outside hides it", async ({
    page,
  }) => {
    // The outside-click target is the paragraph, so the document
    // needs one (SRC alone has no <p> - the click hung forever).
    await loadDoc(
      page,
      `# T\n\nsome prose\n\n${"```"}strudel\nnote("c a f e")\n${"```"}\n`,
    );
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    const bar = figure.locator(".folio-inspector");
    await expect(bar).toBeVisible();
    await expect(bar.locator(".strudel-play")).toBeVisible();
    await expect(bar.locator(".strudel-stop")).toBeVisible();
    // The header is the code header: its language picker reads
    // Strudel, and there is no separate source textarea - the
    // body edits in place like every code block.
    await expect(bar.locator("select.code-lang")).toHaveValue("strudel");
    await expect(bar.locator("textarea")).toHaveCount(0);
    // One inspector contract: an outside click hides it.
    await page.locator("#the-doc p").first().click();
    await expect(bar).toBeHidden();
  });

  test("a strudel fence survives a full view round-trip", async ({ page }) => {
    await loadDoc(page, SRC);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toBe(SRC);
  });

  test("editing the strudel body in place updates the model", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.locator("pre.strudel-source").click();
    await page.keyboard.press("End");
    await page.keyboard.type('.s("sawtooth")');
    await expect(figure.locator("pre.strudel-source")).toHaveText(
      'note("c a f e").s("sawtooth")',
    );
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain(
      'note("c a f e").s("sawtooth")',
    );
  });

  test("editing prose around a strudel figure preserves it", async ({
    page,
  }) => {
    await loadDoc(
      page,
      '# T\n\nbefore\n\n```strudel\nnote("c a f e")\n```\n\nafter\n',
    );
    await page.locator("#the-doc p", { hasText: "before" }).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("middle");
    const doc = await page.evaluate(() =>
      (
        document.querySelector("folio-doc") as unknown as {
          getDoc: () => {
            blocks: { kind: string; lang?: string }[];
          };
        }
      ).getDoc(),
    );
    const strudel = doc.blocks.filter(
      (b) => b.kind === "code" && b.lang === "strudel",
    );
    expect(strudel.length).toBe(1);
  });

  test("Enter in a strudel body inserts a line, never splits the block", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.locator("pre.strudel-source").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("// next");
    await expect(page.locator("#the-doc figure.folio-strudel")).toHaveCount(1);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toBe(
      '# T\n\n```strudel\nnote("c a f e")\n// next\n```\n',
    );
  });

  test("Backspace in an emptied strudel body removes the block", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.locator("pre.strudel-source").click();
    await page.keyboard.press("End");
    for (let i = 0; i < 'note("c a f e")'.length; i++) {
      await page.keyboard.press("Backspace");
    }
    await expect(figure).toHaveCount(1);
    await page.keyboard.press("Backspace");
    await expect(figure).toHaveCount(0);
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toBe("# T\n");
  });

  test("the play button starts audio without a network fetch", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().startsWith("http") && !r.url().includes("localhost")) {
        requests.push(r.url());
      }
    });
    await figure.locator(".folio-inspector .strudel-play").click();
    await expect(
      figure.locator(".folio-inspector .strudel-error"),
    ).toBeHidden();
    await page.waitForTimeout(1000);
    expect(requests).toEqual([]);
  });

  test("drum names play from folio's bundled kit, preloaded, offline", async ({
    page,
  }) => {
    // bd/sd/hh/oh/cp/rim/lt/mt/ht/cr/rd/cb are sample sounds; with no
    // sample bank every hit failed "sound bd not found" - Caverave's
    // drums were silent everywhere. folio bundles a CC0 kit.
    const logs: string[] = [];
    page.on("console", (m) => logs.push(m.text()));
    const local: string[] = [];
    const remote: string[] = [];
    page.on("request", (r) => {
      const url = r.url();
      if (!url.startsWith("http")) return;
      if (url.includes("localhost")) local.push(url);
      else remote.push(url);
    });
    await loadDoc(
      page,
      '# T\n\n```strudel\ns("bd sd [hh hh] oh, cp rim lt mt ht cr rd cb")\n```\n',
    );
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    await figure.locator(".folio-inspector .strudel-play").click();
    await expect(figure.locator(".strudel-on").first()).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(2500);
    expect(logs.filter((l) => /not found|could not load/.test(l))).toEqual([]);
    // Preloaded before the first beat: no hit is skipped as late.
    expect(logs.filter((l) => l.includes("took too long"))).toEqual([]);
    expect(local.filter((u) => u.endsWith(".flac")).length).toBeGreaterThan(10);
    expect(remote).toEqual([]);
    await figure.locator(".folio-inspector .strudel-stop").click();
  });

  test("playback survives an engine reporting zero output channels", async ({
    page,
  }) => {
    // WebKitGTK (the Linux desktop webview) reports
    // destination.maxChannelCount as 0; strudel sizes its output
    // from it, so every note used to fail with "Channel count
    // cannot be 0" while the clock kept ticking - silent play.
    // Mimic WebKitGTK: maxChannelCount is 0 and, as its internal
    // limit is also 0, every channelCount assignment throws.
    await page.addInitScript(() => {
      const proto = AudioDestinationNode.prototype;
      const cc = Object.getOwnPropertyDescriptor(
        AudioNode.prototype,
        "channelCount",
      );
      Object.defineProperty(proto, "maxChannelCount", {
        configurable: true,
        get: () => 0,
      });
      Object.defineProperty(proto, "channelCount", {
        configurable: true,
        get(this: AudioNode) {
          return cc?.get?.call(this) as number;
        },
        set(v: number) {
          throw new DOMException(
            v === 0
              ? "Channel count cannot be 0"
              : "Channel count exceeds maximum limit",
            "NotSupportedError",
          );
        },
      });
    });
    const logs: string[] = [];
    page.on("console", (m) => logs.push(m.text()));
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    await figure.locator(".folio-inspector .strudel-play").click();
    await expect(
      figure.locator("pre.strudel-source .strudel-on").first(),
    ).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    expect(logs.filter((l) => l.includes("Channel count"))).toEqual([]);
  });

  test("playing lights the sounding atoms - no sweep line", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    const pre = figure.locator("pre.strudel-source");
    await figure.click();
    await figure.locator(".folio-inspector .strudel-play").click();
    // Every mini-notation atom gets an addressable span; the one
    // sounding now is lit.
    await expect(pre.locator(".strudel-atom")).toHaveCount(4, {
      timeout: 10_000,
    });
    await expect(pre.locator(".strudel-atom.strudel-on").first()).toBeVisible({
      timeout: 10_000,
    });
    // The lights move on: over two seconds at least two different
    // atoms are lit (c a f e step through the cycle).
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      for (const t of await pre.locator(".strudel-on").allTextContents()) {
        seen.add(t);
      }
      await page.waitForTimeout(100);
    }
    expect(seen.size).toBeGreaterThan(1);
    // No moving playhead line any more.
    await expect(pre.locator(".strudel-sweep")).toHaveCount(0);
    await expect(
      figure.locator(".folio-inspector .strudel-play"),
    ).toContainText("Playing");
    // Stop: lights out, atom spans gone, the text is untouched.
    await figure.locator(".folio-inspector .strudel-stop").click();
    await expect(figure.locator(".folio-inspector .strudel-play")).toHaveText(
      "\u25b6 Play",
    );
    await expect(pre.locator(".strudel-atom")).toHaveCount(0);
    await expect(pre).toHaveText('note("c a f e")');
  });

  test("a sounding note lights ALL its source locations", async ({ page }) => {
    // Each hap of note("c e").s("sawtooth") carries two locations:
    // its note atom and the "sawtooth" atom. The old flash lit only
    // the last one, which is why Caverave's notes rarely lit up.
    await loadDoc(page, '# T\n\n```strudel\nnote("c e").s("sawtooth")\n```\n');
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    await figure.locator(".folio-inspector .strudel-play").click();
    const lit = figure.locator("pre.strudel-source .strudel-on");
    await expect
      .poll(async () => (await lit.allTextContents()).sort().join(","), {
        timeout: 10_000,
      })
      .toMatch(/^(c|e),sawtooth$/);
    await figure.locator(".folio-inspector .strudel-stop").click();
  });

  test("an evaluation error shows in the header", async ({ page }) => {
    await loadDoc(page, '# T\n\n```strudel\nnote("c e"\n```\n');
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    await figure.locator(".folio-inspector .strudel-play").click();
    await expect(figure.locator(".folio-inspector .strudel-error")).toBeVisible(
      {
        timeout: 10_000,
      },
    );
    await expect(figure.locator(".folio-inspector .strudel-play")).toHaveText(
      "\u25b6 Play",
    );
  });

  test("editing while playing pauses the lights and offers Update", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    const pre = figure.locator("pre.strudel-source");
    await figure.click();
    await figure.locator(".folio-inspector .strudel-play").click();
    await expect(pre.locator(".strudel-on").first()).toBeVisible({
      timeout: 10_000,
    });
    await pre.click();
    await page.keyboard.press("End");
    await page.keyboard.type(".fast(2)");
    const play = figure.locator(".folio-inspector .strudel-play");
    await expect(play).toContainText("Update");
    await expect(pre.locator(".strudel-on")).toHaveCount(0);
    // Update re-evaluates the edited source and the lights resume.
    await play.click();
    await expect(play).toContainText("Playing");
    await expect(pre.locator(".strudel-on").first()).toBeVisible({
      timeout: 10_000,
    });
    await figure.locator(".folio-inspector .strudel-stop").click();
  });

  test("the Markdown view highlights the strudel fence with fence tokens", async ({
    page,
  }) => {
    await loadDoc(page, SRC);
    await page.locator("#btn-markdown").click();
    await expect(page.locator("#md-view .tk-fence").first()).toBeVisible();
  });

  test("the toolbar music button inserts a strudel block", async ({ page }) => {
    // The button needs an editable caret: give the doc a paragraph.
    await loadDoc(page, "# T\n\nsome prose\n");
    await page.locator("#the-doc p").first().click();
    await page.locator("#btn-strudel").click();
    await expect(page.locator("#the-doc figure.folio-strudel")).toBeVisible();
  });

  test("the command palette offers the Strudel insert", async ({ page }) => {
    await loadDoc(page, SRC);
    await page.locator("#btn-search").click();
    await page.locator("#palette-input").fill("strudel");
    await expect(
      page.locator("#palette-list button", { hasText: "Strudel" }),
    ).toBeVisible();
  });
});

test.describe("engine audio failure", () => {
  // An engine that cannot open an audio device leaves the
  // AudioContext suspended or "interrupted" - play can never
  // sound. The player must SAY so, not show a dead Playing label.
  test("an interrupted audio device shows a visible message", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const FakeCtx = class {
        state = "interrupted";
        sampleRate = 44100;
        currentTime = 0;
        resume(): Promise<void> {
          return new Promise(() => {
            /* never settles - no audio device */
          });
        }
      };
      Object.defineProperty(window, "AudioContext", {
        value: FakeCtx,
        configurable: true,
      });
    });
    await loadDoc(page, SRC);
    const figure = page.locator("#the-doc figure.folio-strudel");
    await figure.click();
    await figure.locator(".folio-inspector .strudel-play").click();
    const err = figure.locator(".folio-inspector .strudel-error");
    await expect(err).toBeVisible({ timeout: 10_000 });
    await expect(err).toContainText("no sound output");
    await expect(figure.locator(".folio-inspector .strudel-play")).toHaveText(
      "\u25b6 Play",
    );
    // The failed play is cleaned up: no lights left behind.
    await expect(
      figure.locator("pre.strudel-source .strudel-atom"),
    ).toHaveCount(0);
  });
});
