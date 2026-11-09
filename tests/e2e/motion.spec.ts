import { expect, test } from "@playwright/test";

/**
 * Motion figures (spec: docs/specs/motion-figures.md): a frame
 * sequence as SVG groups, autoplaying in a loop while the document is
 * open (no transport controls); the inspector bar (reveal on click,
 * hide on outside click, Esc) holds the controls - source, display
 * and print renditions, caption. Print shows the block's print
 * rendition (filmstrip / flowmap). Frames are table rows - the time
 * axis is a column.
 */

test.describe("motion figures", () => {
  test("a flow figure autoplays in a loop; its bar has source and rendition controls; print shows the flow map", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/flow.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-motion-id="traffic"]');
    await fig.scrollIntoViewIfNeeded();
    // 48 frames as groups; the player shows exactly one - and it
    // advances on its own, no Play button.
    await expect(fig.locator(".motion-view .mframe")).toHaveCount(48);
    await expect(fig).toHaveAttribute("data-playing", "1");
    await expect(fig.locator(".motion-view .mframe:visible")).toHaveCount(1);
    const f0 = await fig.getAttribute("data-frame");
    await expect.poll(() => fig.getAttribute("data-frame")).not.toBe(f0 ?? "");
    // No transport controls.
    await expect(fig.locator(".motion-play")).toHaveCount(0);
    // Clicking the figure reveals the inspector bar with its controls.
    await expect(fig.locator(".folio-inspector")).toBeHidden();
    await fig.locator(".motion-view").click();
    const bar = fig.locator(".folio-inspector");
    await expect(bar).toBeVisible();
    await expect(bar.locator(".insp-source")).toHaveValue("roads");
    await expect(bar.locator(".insp-display")).toHaveValue("");
    await expect(bar.locator(".insp-print")).toHaveValue("");
    // A flow figure's rendition selects do offer flowmap.
    await expect(
      bar.locator('.insp-display option[value="flowmap"]'),
    ).toHaveCount(1);
    // Display: filmstrip shows the thumbnails in the document itself -
    // and the thumbnails are not blank (playback must not hide their
    // frame groups: only the player view's groups are swapped).
    await bar.locator(".insp-display").selectOption("filmstrip");
    await expect(
      fig.locator(".motion-filmstrip .motion-thumb").first(),
    ).toBeVisible();
    await expect(
      fig.locator(".motion-filmstrip .motion-thumb .mpoint:visible"),
    ).not.toHaveCount(0);
    await expect(fig.locator(".motion-view")).toBeHidden();
    // Poster shows one frame, also not blank.
    await bar.locator(".insp-display").selectOption("poster");
    await expect(fig.locator(".motion-static .mpoint:visible")).not.toHaveCount(
      0,
    );
    await bar.locator(".insp-display").selectOption("");
    await expect(fig.locator(".motion-view")).toBeVisible();
    // Print can be trails too: one path per packet over the graph.
    await bar.locator(".insp-print").selectOption("trails");
    await page.emulateMedia({ media: "print" });
    await expect(
      fig.locator(".motion-print-static svg.motion-trails"),
    ).toBeVisible();
    await expect(
      fig.locator(".motion-print-static .mtrail").first(),
    ).toBeVisible();
    await page.emulateMedia({ media: "screen" });
    await bar.locator(".insp-print").selectOption("");
    // Clicking outside hides the bar (the one inspector contract).
    await page.locator("#the-doc h1").click();
    await expect(bar).toBeHidden();
    // Print shows the flow map (the flow type's print default).
    await page.emulateMedia({ media: "print" });
    await expect(
      fig.locator(".motion-print-static svg.motion-flowmap"),
    ).toBeVisible();
    await expect(fig.locator(".motion-view")).toBeHidden();
    await page.emulateMedia({ media: "screen" });
  });

  test("a swarm figure plays a dataset of frames; its source control switches to the built-in sim", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/swarm.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const birds = page.locator('#the-doc figure[data-motion-id="birds"]');
    await birds.scrollIntoViewIfNeeded();
    // The Python-published @frames table drives the figure:
    // 18 frames x 24 birds, autoplaying.
    await expect(birds.locator(".motion-view .mframe")).toHaveCount(18);
    expect(
      await birds.locator('.motion-view .mframe[data-i="0"] .mpoint').count(),
    ).toBe(24);
    await expect(birds).toHaveAttribute("data-playing", "1");
    // Switch the source to the built-in simulation from the bar.
    await birds.locator(".motion-view").click();
    const bar = birds.locator(".folio-inspector");
    await expect(bar).toBeVisible();
    await expect(bar.locator(".insp-source")).toHaveValue("frames");
    // flowmap needs edges: a swarm's rendition selects don't offer it.
    await expect(
      bar.locator('.insp-display option[value="flowmap"]'),
    ).toHaveCount(0);
    await expect(
      bar.locator('.insp-print option[value="flowmap"]'),
    ).toHaveCount(0);
    // Trails: one line per bird through all frames, dots at the
    // intermediate locations, a bold marker at each final one.
    await bar.locator(".insp-display").selectOption("trails");
    await expect(
      birds.locator(".motion-static svg.motion-trails"),
    ).toBeVisible();
    await expect(birds.locator(".motion-static .mtrail")).toHaveCount(24);
    await expect(birds.locator(".motion-static .mstep")).toHaveCount(24 * 17);
    await expect(birds.locator(".motion-static .mend")).toHaveCount(24);
    await expect(birds.locator(".motion-view")).toBeHidden();
    await bar.locator(".insp-display").selectOption("");
    await expect(birds.locator(".motion-view")).toBeVisible();
    await bar.locator(".insp-source").selectOption("");
    await expect(birds.locator(".motion-view .mframe")).toHaveCount(90);
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    // The motion block lost its source line (the chart's source stays).
    expect(md).not.toContain("source: @frames\ntime: frame");
    await page.locator("#btn-view").click();
    // Print of a swarm defaults to the filmstrip - with visible points.
    await page.emulateMedia({ media: "print" });
    await expect(
      birds.locator(".motion-filmstrip .motion-thumb").first(),
    ).toBeVisible();
    await expect(
      birds.locator(".motion-filmstrip .motion-thumb .mpoint:visible"),
    ).not.toHaveCount(0);
    await expect(birds.locator(".motion-view")).toBeHidden();
    await page.emulateMedia({ media: "screen" });
  });

  test("editing the edge table redraws the flow figure in place", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/flow.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-motion-id="traffic"]');
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator(".motion-view .mframe")).toHaveCount(48);
    const packets0 = await fig
      .locator('.motion-view .mframe[data-i="0"] .mpoint')
      .count();
    // Market -> Square qty 9 -> 1: fewer packets on that edge.
    await page
      .locator(
        '#the-doc figure[data-table-id="roads"] td[data-row-index="0"][data-col-index="2"]',
      )
      .click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("1");
    await page.keyboard.press("Tab");
    await expect(fig.locator(".motion-view .mframe")).toHaveCount(48);
    const packets1 = await fig
      .locator('.motion-view .mframe[data-i="0"] .mpoint')
      .count();
    expect(packets1).toBeLessThan(packets0);
  });

  test("the palette inserts a swarm figure; an unknown rendition is a visible error", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/flow.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    await page.locator("#the-doc h1").click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("insert a swarm figure");
    await page.keyboard.press("Enter");
    const figs = page.locator("#the-doc figure.folio-motion");
    await expect(figs).toHaveCount(2);
    await expect(figs.last().locator(".motion-view")).toBeVisible();
    await expect(
      figs.last().locator(".motion-view .mframe:visible"),
    ).toHaveCount(1);
    await expect(figs.last()).toHaveAttribute("data-playing", "1");
    await page.locator("#btn-markdown").click();
    expect(await page.locator("#editor").inputValue()).toContain("type: swarm");
    // A bad rendition value is the figure's error text, not a crash.
    await page.locator("#btn-view").click();
    await page.locator("#btn-markdown").click();
    await page
      .locator("#editor")
      .fill(
        (await page.locator("#editor").inputValue()).replace(
          "type: swarm",
          "type: swarm\ndisplay: bogus",
        ),
      );
    await page.locator("#btn-view").click();
    await expect(
      page.locator("#the-doc .motion-stage", { hasText: "unknown rendition" }),
    ).toHaveCount(1);
    await expect(
      page.locator("#the-doc .motion-stage", { hasText: "unknown rendition" }),
    ).toContainText(/Motion error: Motion figure: unknown rendition 'bogus'/);
  });

  test("flowmap on a swarm figure is a visible error, not a blank figure", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/flow.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    await page.locator("#the-doc h1").click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("insert a swarm figure");
    await page.keyboard.press("Enter");
    await expect(page.locator("#the-doc figure.folio-motion")).toHaveCount(2);
    await page.locator("#btn-markdown").click();
    const md = await page.locator("#editor").inputValue();
    const swarmId = /::: motion \{#([\w-]+)\}\s*\ntype: swarm/.exec(md)?.[1];
    expect(swarmId).toBeTruthy();
    await page
      .locator("#editor")
      .fill(md.replace("type: swarm", "type: swarm\ndisplay: flowmap"));
    await page.locator("#btn-view").click();
    const swarm = page.locator(
      `#the-doc figure[data-motion-id="${swarmId ?? ""}"]`,
    );
    await expect(swarm.locator(".motion-stage")).toContainText(
      "flowmap is a flow-figure rendition - a swarm has no edges",
    );
    // No blank player: the error replaces the stage content.
    await expect(swarm.locator(".motion-view")).toHaveCount(0);
  });
});
