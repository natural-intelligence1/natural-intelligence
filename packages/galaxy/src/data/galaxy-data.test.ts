/* Content-model invariants. Runs under vitest or jest (describe/it/expect globals). */
import { buildGalaxyData, DISCIPLINES, LINKS, SYSTEMS, ORBITS, CATEGORIES, PHRASES } from './galaxy-data';

describe('galaxy content model', () => {
  const D = buildGalaxyData();

  it('has 4 orbits and 24 systems', () => {
    expect(ORBITS).toHaveLength(4);
    expect(SYSTEMS).toHaveLength(24);
    expect(new Set(SYSTEMS.map((s) => s.id)).size).toBe(24);
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
    expect(total).toBe(138);
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

  it('has the approved phrase set, starting with Uniquely You', () => {
    expect(PHRASES[0]).toBe('Uniquely You');
    expect(PHRASES).toHaveLength(7);
  });
});
