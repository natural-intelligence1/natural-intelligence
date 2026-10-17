/*
 * NI Living Galaxy — smoke & regression tests (Playwright).
 * Target: the feature-flagged preview route. Run against `pnpm dev` or a Vercel Preview URL:
 *   GALAXY_URL=http://localhost:3000/labs/galaxy npx playwright test tests/galaxy.spec.ts
 * The ?galaxyDebug=1 query exposes window.__niGalaxy (the component instance) for inspection only.
 */
import { test, expect, Page } from '@playwright/test';

const URL = (process.env.GALAXY_URL || 'http://localhost:3000/labs/galaxy') + '?galaxyDebug=1';

async function open(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => (window as any).__niGalaxy?.E?.planets?.length === 24, null, { timeout: 30_000 });
}

test('renders WebGL galaxy with the canonical model and no errors', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  const s = await page.evaluate(() => {
    const g = (window as any).__niGalaxy, D = g.nidata();
    return { fallback: g.state.fallback, discs: D.discs.length, nodes: D.nodes.length, links: D.nodes.reduce((a: number, n: any) => a + n.links.length, 0) };
  });
  expect(s).toEqual({ fallback: false, discs: 45, nodes: 24, links: 138 });
  await expect(page.getByRole('img', { name: /Interactive 3D galaxy/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('bodies never collide (moons, planets, centre)', async ({ page }) => {
  await open(page, []);
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(1500);
    const c = await page.evaluate(() => {
      const E = (window as any).__niGalaxy.E, out = { mm: 1e9, mp: 1e9, pp: 1e9 };
      const ms = E.moons.filter((m: any) => m.s > 0.98 && Math.abs(m.r - m.rT) < 0.005);
      for (let a = 0; a < ms.length; a++) {
        for (let b = a + 1; b < ms.length; b++) out.mm = Math.min(out.mm, ms[a].pos.distanceTo(ms[b].pos) - ms[a].size - ms[b].size);
        for (const p of E.planets) out.mp = Math.min(out.mp, ms[a].pos.distanceTo(p.g.position) - p.size - ms[a].size);
      }
      for (let a = 0; a < E.planets.length; a++) for (let b = a + 1; b < E.planets.length; b++)
        out.pp = Math.min(out.pp, E.planets[a].g.position.distanceTo(E.planets[b].g.position) - E.planets[a].size - E.planets[b].size);
      return out;
    });
    expect(c.mm).toBeGreaterThan(0); expect(c.mp).toBeGreaterThan(0); expect(c.pp).toBeGreaterThan(0);
  }
});

test('centre phrase never overlaps a planet', async ({ page }) => {
  await open(page, []);
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1200);
    const hit = await page.evaluate(() => {
      const g = (window as any).__niGalaxy, E = g.E, r = g.phraseEl.getBoundingClientRect(), root = g.rootEl.getBoundingClientRect();
      const cam = E.camera, right = E.v1.clone().setFromMatrixColumn(cam.matrixWorld, 0);
      return E.planets.some((p: any) => {
        const c = p.g.position.clone().project(cam), e = p.g.position.clone().addScaledVector(right, p.size).project(cam);
        const x = root.left + (c.x + 1) / 2 * root.width, y = root.top + (1 - c.y) / 2 * root.height;
        const pr = Math.abs((e.x - c.x) / 2 * root.width);
        const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
        return Math.hypot(dx, dy) < pr;
      });
    });
    expect(hit).toBe(false);
  }
});

test('render loop stops when paused', async ({ page }) => {
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    (window as any).__rafCount = 0;
    window.requestAnimationFrame = (cb) => { (window as any).__rafCount++; return raf(cb); };
  });
  await open(page, []);
  await page.getByRole('button', { name: /pause/i }).first().click();
  // the one-off intro (mark particles gathering) and camera easing may finish first; then the loop must be idle
  await page.waitForFunction(() => (window as any).__niGalaxy.E.gather === 0, null, { timeout: 30_000 });
  await page.waitForTimeout(2500);
  const a = await page.evaluate(() => (window as any).__rafCount);
  await page.waitForTimeout(1500);
  const b = await page.evaluate(() => (window as any).__rafCount);
  expect(b - a).toBeLessThanOrEqual(2);
});

test('coaches are never labelled as specialists', async ({ page }) => {
  await open(page, []);
  await page.evaluate(() => (window as any).__niGalaxy.onEngineHover({ kind: 'moon', id: 'healthcoach', planet: 'cardio' }, 500, 400));
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText('Coaching support for Cardiovascular');
  await expect(tip).not.toContainText('Specialist in');
  await page.evaluate(() => (window as any).__niGalaxy.onEngineHover({ kind: 'moon', id: 'cardiologist', planet: 'cardio' }, 500, 400));
  await expect(tip).toContainText('Specialist in Cardiovascular');
  await page.evaluate(() => (window as any).__niGalaxy.pickDisc('healthcoach'));
  await expect(page.getByText('Non-clinical role · does not diagnose or treat')).toBeVisible();
});

test('keyboard: system list selects, Escape returns', async ({ page }) => {
  await open(page, []);
  await page.getByRole('button', { name: /Cardiovascular/ }).first().click();
  await expect(page.getByRole('complementary', { name: 'Details' })).toContainText('Cardiovascular');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Details' })).toHaveCount(0);
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('starts paused with a static phrase', async ({ page }) => {
    await open(page, []);
    const s = await page.evaluate(() => (window as any).__niGalaxy.state.paused);
    expect(s).toBe(true);
    const t1 = await page.evaluate(() => (window as any).__niGalaxy.phraseEl.textContent);
    await page.waitForTimeout(7000);
    expect(await page.evaluate(() => (window as any).__niGalaxy.phraseEl.textContent)).toBe(t1);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('fits the viewport with the bottom toolbar', async ({ page }) => {
    await open(page, []);
    await expect(page.getByRole('toolbar', { name: 'Galaxy controls' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
