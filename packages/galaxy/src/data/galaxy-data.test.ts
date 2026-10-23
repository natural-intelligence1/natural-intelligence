/* Content-model invariants. Runs under vitest or jest (describe/it/expect globals). */
import { buildGalaxyData, DISCIPLINES, LINKS, SYSTEMS, ORBITS, CATEGORIES, PHRASES, PATHWAYS, EXPERIENCES } from './galaxy-data';

describe('galaxy content model', () => {
  const D = buildGalaxyData();

  it('has 4 orbits and 26 systems (8 roots)', () => {
    expect(ORBITS).toHaveLength(4);
    expect(SYSTEMS).toHaveLength(26);
    expect(new Set(SYSTEMS.map((s) => s.id)).size).toBe(26);
    expect(SYSTEMS.filter((s) => s.orbit === 'o4')).toHaveLength(8);
  });

  it('names every orbit in tree language', () => {
    expect(ORBITS.map((o) => o.level)).toEqual(['Systems', 'Systems', 'Foundations', 'Roots']);
    ORBITS.forEach((o) => expect(o.tag.length).toBeGreaterThan(3));
  });

  it('has 45 canonical disciplines with unique ids and names', () => {
    expect(DISCIPLINES).toHaveLength(45);
    expect(new Set(DISCIPLINES.map((d) => d.id)).size).toBe(45);
    expect(new Set(DISCIPLINES.map((d) => d.name.toLowerCase())).size).toBe(45);
  });

  it('links every system, only to known disciplines, without duplicates', () => {
    const ids = new Set(DISCIPLINES.map((d) => d.id));
    let total = 0;
    for (const s of SYSTEMS) {
      const l = LINKS[s.id] || [];
      expect(l.length).toBeGreaterThan(0);
      expect(new Set(l).size).toBe(l.length);
      l.forEach((id) => expect(ids.has(id)).toBe(true));
      total += l.length;
    }
    expect(total).toBe(149);
  });

  it('moons reference the canonical discipline objects (no per-system copies)', () => {
    for (const n of D.nodes) for (const d of n.links) expect(D.discById[d.id]).toBe(d);
  });

  it('keeps coaches explicitly non-clinical', () => {
    const coaches = D.discs.filter((d) => d.coach);
    expect(coaches.length).toBeGreaterThan(0);
    expect(CATEGORIES.coach.scope).toMatch(/does not diagnose, treat or prescribe/i);
    for (const c of coaches) {
      expect(c.scope).toMatch(/does not diagnose/i);
      expect(c.reg).toMatch(/not a clinical register/i);
    }
  });

  it('pathways run root → foundation → system, without duplicates', () => {
    const orbitOf: Record<string, string> = {};
    SYSTEMS.forEach((s) => { orbitOf[s.id] = s.orbit; });
    expect(new Set(PATHWAYS.map((p) => p.join('>'))).size).toBe(PATHWAYS.length);
    for (const [r, p, s] of PATHWAYS) {
      expect(orbitOf[r]).toBe('o4');
      expect(orbitOf[p]).toBe('o3');
      expect(['o1', 'o2']).toContain(orbitOf[s]);
    }
    for (const root of SYSTEMS.filter((s) => s.orbit === 'o4')) expect(PATHWAYS.filter((p) => p[0] === root.id).length).toBeGreaterThanOrEqual(2);
  });

  it('experiences are educational, GP-first and signposted', () => {
    const D = buildGalaxyData();
    expect(EXPERIENCES).toHaveLength(8);
    for (const x of D.exps) {
      expect(x.paths.length).toBeGreaterThanOrEqual(3);
      expect(x.help[0].id).toBe('gp');
      expect(x.care).toMatch(/GP|999|NHS 111/);
      expect(x.desc).not.toMatch(/you (may )?have|diagnos/i);
      expect(x.help.every((d) => !d.coach || x.help[0].id === 'gp')).toBe(true);
    }
  });

  it('has the approved phrase set, starting with Uniquely You', () => {
    expect(PHRASES[0]).toBe('Uniquely You');
    expect(PHRASES).toHaveLength(7);
  });
});
