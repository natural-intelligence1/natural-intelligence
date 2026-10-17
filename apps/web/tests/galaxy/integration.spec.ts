/*
 * Living Galaxy — integration with the homepage and the flag.
 *
 * These complement the ported galaxy.spec.ts (which proves the component
 * itself). They prove the things only integration can break:
 *   · the Galaxy sits at the intended point in the homepage narrative;
 *   · with the flag off nothing renders AND no gap is left;
 *   · /labs/galaxy 404s with the flag off;
 *   · the galaxy chunk is not eagerly loaded on the homepage;
 *   · the homepage links either side of the section still work.
 *
 * BASE_URL must point at a build made with the matching flag value.
 * FLAG tells the suite which build it is looking at.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const FLAG_ON = process.env.GALAXY_FLAG === '1';

test.describe('flag ON', () => {
  test.skip(!FLAG_ON, 'build has the flag off');

  test('galaxy sits after the proposition and before "What we offer"', async ({ page }) => {
    await page.goto(BASE + '/');
    const section = page.locator('section[aria-label="Living Galaxy"]');
    await expect(section).toHaveCount(1);

    // Order in the DOM is the order in the narrative.
    const order = await page.evaluate(() => {
      const all = [...document.querySelectorAll('h1, h2, section[aria-label="Living Galaxy"]')];
      return all.map((el) =>
        el.getAttribute('aria-label') === 'Living Galaxy'
          ? 'GALAXY'
          : (el.textContent || '').trim().slice(0, 40));
    });
    const gi = order.indexOf('GALAXY');
    expect(gi).toBeGreaterThan(-1);

    // The hero H1 (the proposition) comes before it.
    const heroIdx = order.findIndex((t) => /signs are within you/i.test(t));
    expect(heroIdx).toBeGreaterThan(-1);
    expect(heroIdx).toBeLessThan(gi);

    // Nothing that explains or sells comes before it.
    const offerIdx = order.findIndex((t, i) => i < gi && /what we offer|pricing|membership/i.test(t));
    expect(offerIdx).toBe(-1);
  });

  test('homepage CTAs either side of the section still work', async ({ page }) => {
    await page.goto(BASE + '/');
    for (const name of [/Explore The Library/i, /See workshops/i]) {
      const link = page.getByRole('link', { name }).first();
      await expect(link).toBeVisible();
      expect(await link.getAttribute('href')).toBeTruthy();
    }
  });

  test('/labs/galaxy is reachable', async ({ page }) => {
    const res = await page.goto(BASE + '/labs/galaxy');
    expect(res?.status()).toBe(200);
  });
});

test.describe('flag OFF', () => {
  test.skip(FLAG_ON, 'build has the flag on');

  test('homepage renders with no galaxy and no reserved gap', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('section[aria-label="Living Galaxy"]')).toHaveCount(0);
    // Nothing left behind that would show as blank space.
    const posters = await page.locator('[style*="radial-gradient(ellipse 80% 72%"]').count();
    expect(posters).toBe(0);
  });

  test('/labs/galaxy returns 404', async ({ page }) => {
    const res = await page.goto(BASE + '/labs/galaxy');
    expect(res?.status()).toBe(404);
  });

  test('no galaxy or three.js code is served to the homepage', async ({ page }) => {
    const scripts: string[] = [];
    page.on('response', (r) => { if (r.url().endsWith('.js')) scripts.push(r.url()); });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const bodies = await Promise.all(scripts.map(async (u) => {
      try { const r = await page.request.get(u); return await r.text(); } catch { return ''; }
    }));
    expect(bodies.some((b) => b.includes('WebGLRenderer'))).toBe(false);
    expect(bodies.some((b) => b.includes('Uniquely You'))).toBe(false);
  });
});

test.describe('lazy loading (flag ON)', () => {
  test.skip(!FLAG_ON, 'build has the flag off');

  test('three.js is not in the homepage initial payload', async ({ page }) => {
    const initial: string[] = [];
    page.on('response', (r) => { if (r.url().endsWith('.js')) initial.push(r.url()); });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const bodies = await Promise.all(initial.slice(0, 12).map(async (u) => {
      try { const r = await page.request.get(u); return await r.text(); } catch { return ''; }
    }));
    // The engine must arrive in a separate chunk, not the document's first scripts.
    expect(bodies.some((b) => b.includes('WebGLRenderer'))).toBe(false);
  });
});

/*
 * The payload test above is necessary but not sufficient: it inspects the
 * document's first scripts, so it stays green even when the page fetches
 * three.js milliseconds later. These tests assert actual dormancy and actual
 * waking, which is what the homepage performance requirement means.
 */
test.describe('galaxy stays dormant until the reader reaches it (flag ON)', () => {
  test.skip(!FLAG_ON, 'build has the flag off');

  for (const [label, width, height] of [
    ['412×823', 412, 823],
    ['390×844', 390, 844],
    ['360×640', 360, 640],
    ['1440×900', 1440, 900],
  ] as [string, number, number][]) {
    test(`${label}: nothing galaxy-related loads without scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(BASE + '/', { waitUntil: 'load' });
      await page.waitForTimeout(6000); // deliberately long: no scrolling at all

      const state = await page.evaluate(() => {
        const s = document.querySelector('section[aria-label="Living Galaxy"]');
        return {
          sectionPresent: !!s,
          canvas: !!s?.querySelector('canvas'),
          galaxyRequests: performance
            .getEntriesByType('resource')
            .map((r) => r.name)
            .filter((n) => /ni-mark-mask|three/i.test(n))
            .map((n) => n.split('/').pop()),
        };
      });

      expect(state.sectionPresent).toBe(true); // the space is reserved...
      expect(state.canvas).toBe(false);        // ...but nothing has started
      expect(state.galaxyRequests).toEqual([]);
    });
  }

  test('390×844: scrolling to the section wakes it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.locator('section[aria-label="Living Galaxy"]').scrollIntoViewIfNeeded();
    await expect(page.locator('section[aria-label="Living Galaxy"] canvas')).toBeVisible({ timeout: 30_000 });
  });
});
