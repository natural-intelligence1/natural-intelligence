/*
 * Living Galaxy — responsive fidelity. The brief requires 390×844, a second
 * common narrow phone width, and desktop 1440×900, with no horizontal
 * overflow and usable touch targets. Runs against a flag-ON build.
 */
import { test, expect } from '@playwright/test';

const URL = (process.env.GALAXY_URL || 'http://localhost:3100/labs/galaxy') + '?galaxyDebug=1';

const WIDTHS: [string, number, number][] = [
  ['iPhone 12/13/14 (390×844)', 390, 844],
  ['narrow Android (360×800)', 360, 800],
  ['desktop (1440×900)', 1440, 900],
];

for (const [name, width, height] of WIDTHS) {
  test(`${name}: renders, no horizontal overflow`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.setViewportSize({ width, height });
    await page.goto(URL);
    await page.waitForFunction(
      () => (window as any).__niGalaxy?.E?.planets?.length === 24, null, { timeout: 30_000 });

    const overflow = await page.evaluate(() => ({
      docScroll: document.documentElement.scrollWidth,
      docClient: document.documentElement.clientWidth,
      wide: [...document.querySelectorAll('*')]
        .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 5)
        .map((el) => el.tagName + '.' + String((el as HTMLElement).className).slice(0, 40)),
    }));

    expect(overflow.docScroll).toBeLessThanOrEqual(overflow.docClient + 1);
    expect(overflow.wide).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('mobile touch targets are at least 40px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await page.waitForFunction(
    () => (window as any).__niGalaxy?.E?.planets?.length === 24, null, { timeout: 30_000 });

  // Scoped to the galaxy itself. The surrounding site header/footer are
  // pre-existing chrome and out of scope for this mission.
  const small = await page.evaluate(() => {
    const root = document.querySelector('section[aria-label="Living Galaxy"]') || document.body;
    return [...root.querySelectorAll('button, [role="button"], a[href]')]
      .map((el) => ({ t: (el.textContent || '').trim().slice(0, 24), r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.height > 0 && x.r.height < 40)
      .map((x) => `${x.t} (${Math.round(x.r.height)}px)`);
  });

  expect(small).toEqual([]);
});

/*
 * The approved mobile design puts the control toolbar at the bottom of the
 * galaxy. A fixed 900px height plus the site header pushed it ~64px below a
 * 390×844 fold, so the standalone route now sizes itself to the space
 * available (GalaxySection fitViewport). This guards that.
 */
for (const [name, width, height] of [
  ['390×844', 390, 844],
  ['360×800', 360, 800],
] as [string, number, number][]) {
  test(`mobile ${name}: galaxy controls stay within the viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(URL);
    await page.waitForFunction(
      () => (window as any).__niGalaxy?.E?.planets?.length === 24, null, { timeout: 30_000 });
    await page.waitForTimeout(500); // let the fit measurement + ResizeObserver settle

    const fit = await page.evaluate(() => {
      const root = document.querySelector('section[aria-label="Living Galaxy"]')!;
      const controls = [...root.querySelectorAll('button, [role="button"]')]
        .map((el) => ({ t: (el.textContent || '').trim().slice(0, 24), r: el.getBoundingClientRect() }))
        .filter((x) => x.r.width > 0 && x.r.height > 0);
      return {
        viewportH: window.innerHeight,
        sectionH: Math.round(root.getBoundingClientRect().height),
        belowFold: controls
          .filter((x) => x.r.bottom > window.innerHeight + 1)
          .map((x) => `${x.t} (bottom ${Math.round(x.r.bottom)} > ${window.innerHeight})`),
        count: controls.length,
      };
    });

    expect(fit.count).toBeGreaterThan(0);          // controls actually rendered
    expect(fit.belowFold).toEqual([]);             // ...and all of them are reachable
    expect(fit.sectionH).toBeLessThanOrEqual(height);
  });
}
