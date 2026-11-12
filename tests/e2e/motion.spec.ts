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
  test("a mermaid diagram with flow=@roads animates the packets inside the diagram; print shows trails", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/flow.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-diagram-id="net"]');
    await fig.scrollIntoViewIfNeeded();
    // Mermaid renders async, then the frames play INSIDE the diagram's
    // own SVG (the base carries class flowchart); 60 synthetic ticks.
    await expect(fig.locator(".motion-view svg.flowchart .mframe")).toHaveCount(
      60,
      { timeout: 20000 },
    );
    // ONE figure: the diagram itself hosts the flow (no separate
    // motion figure in the doc).
    await expect(page.locator("#the-doc figure.folio-motion")).toHaveCount(1);
    // The mermaid nodes are the underlay; our qty-weighted edge lines
    // overlay the diagram's own (hidden) edges.
    await expect(fig.locator(".motion-view svg.flowchart g.node")).toHaveCount(
      5,
    );
    await expect(fig.locator(".motion-view svg.flowchart > line")).toHaveCount(
      10,
    );
    await expect(fig).toHaveAttribute("data-playing", "1");
    await expect(fig.locator(".motion-view .mframe:visible")).toHaveCount(1);
    const f0 = await fig.getAttribute("data-frame");
    await expect.poll(() => fig.getAttribute("data-frame")).not.toBe(f0 ?? "");
    // ...and the packets themselves move, not just the frame counter.
    const pkt = () =>
      fig.evaluate((f) => {
        const g = Array.from(f.querySelectorAll(".motion-view .mframe")).find(
          (g) => (g as HTMLElement).style.display !== "none",
        );
        return g?.querySelector(".mpoint")?.getAttribute("transform") ?? "";
      });
    const p0 = await pkt();
    await expect.poll(() => pkt()).not.toBe(p0);
    // No transport controls.
    await expect(fig.locator(".motion-play")).toHaveCount(0);
    // Print shows trails over the diagram (a still cannot play).
    await page.emulateMedia({ media: "print" });
    await expect(
      fig.locator(".motion-print-static svg.flowchart .mtrail").first(),
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
    const fig = page.locator('#the-doc figure[data-diagram-id="net"]');
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator(".motion-view .mframe")).toHaveCount(60, {
      timeout: 20000,
    });
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
    // The diagram redraws async (mermaid re-renders): poll until the
    // packet count drops.
    await expect
      .poll(async () =>
        fig.locator('.motion-view .mframe[data-i="0"] .mpoint').count(),
      )
      .toBeLessThan(packets0);
  });

  test("the palette inserts a swarm figure; an unknown rendition is a visible error", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/flow.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    // The flow diagram gets its folio-motion class once mermaid has
    // rendered - wait for it before counting figures.
    await expect(
      page.locator("#the-doc figure.folio-diagram.folio-motion"),
    ).toHaveCount(1, { timeout: 20000 });
    await page.locator("#the-doc h1").click();
    await page.keyboard.press("Control+k");
    await page.locator("#palette-input").fill("insert a swarm figure");
    await page.keyboard.press("Enter");
    const figs = page.locator("#the-doc figure.folio-motion");
    await expect(figs).toHaveCount(2);
    // The inserted swarm is the figure without a source.
    const swarm = page.locator(
      "#the-doc figure.folio-motion:not([data-diagram-id])",
    );
    await expect(swarm).toHaveCount(1);
    await expect(swarm.locator(".motion-view")).toBeVisible();
    await expect(swarm.locator(".motion-view .mframe:visible")).toHaveCount(1);
    await expect(swarm).toHaveAttribute("data-playing", "1");
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
    // The flow diagram gets its folio-motion class once mermaid has
    // rendered - wait for it before counting figures.
    await expect(
      page.locator("#the-doc figure.folio-diagram.folio-motion"),
    ).toHaveCount(1, { timeout: 20000 });
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

  test("qty visibly scales the flow: 9 vs 90 vehicles differ in packets and edge width", async ({
    page,
  }) => {
    await page.goto("/?doc=demo/examples/flow.md");
    await expect(page.locator("#the-doc h1").first()).toBeVisible();
    const fig = page.locator('#the-doc figure[data-diagram-id="net"]');
    await fig.scrollIntoViewIfNeeded();
    await expect(fig.locator(".motion-view svg.flowchart .mframe")).toHaveCount(
      60,
      { timeout: 20000 },
    );
    const counts = () =>
      fig.evaluate((f) => {
        const g = f.querySelector(".motion-view .mframe");
        // our qty-weighted overlay line (a direct child of the base svg;
        // the diagram's own edges are hidden in the player)
        const edge0 = f.querySelector(".motion-view svg.flowchart > line");
        return {
          packets: g?.querySelectorAll(".mpoint").length ?? 0,
          edgeWidth: Number(edge0?.getAttribute("stroke-width") ?? 0),
        };
      });
    const before = await counts();
    // Market -> Square qty 9 -> 90 in the edge table
    await page
      .locator(
        '#the-doc figure[data-table-id="roads"] td[data-row-index="0"][data-col-index="2"]',
      )
      .click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("90");
    await page.keyboard.press("Tab");
    await expect
      .poll(async () => (await counts()).packets)
      .toBeGreaterThan(before.packets);
    await expect
      .poll(async () => (await counts()).edgeWidth)
      .toBeGreaterThan(before.edgeWidth);
  });
});

test("motion figures play while their slide is up", async ({ page }) => {
  await page.goto("/?doc=demo/examples/swarm.md");
  await expect(page.locator("#the-doc h1").first()).toBeVisible();
  const fig = page.locator('#the-doc figure[data-motion-id="birds"]');
  await expect(fig.locator(".motion-view .mframe")).toHaveCount(18);
  await page.locator("#btn-play").click();
  await page.locator("#mi-play").click();
  await expect(page.locator("#btn-play")).toHaveClass(/active/);
  const f0 = await fig.getAttribute("data-frame");
  await expect.poll(() => fig.getAttribute("data-frame")).not.toBe(f0 ?? "");
});
