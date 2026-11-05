import { describe, it, expect } from 'vitest'
import {
  PRIMARY_DESTINATIONS, DEEPER_MODULE_IDS, NEW_CLIENT_CONTEXT,
  deeperModules, availableModules, heldBackModules,
  type ClientContext,
} from './progressiveNav'

const ctx = (over: Partial<ClientContext> = {}): ClientContext => ({ ...NEW_CLIENT_CONTEXT, ...over })

describe('primary destinations', () => {
  it('offers five, not fourteen', () => {
    expect(PRIMARY_DESTINATIONS).toHaveLength(5)
  })

  it('only Today matches exactly, so the others stay active on child routes', () => {
    const exact = PRIMARY_DESTINATIONS.filter((d) => 'exact' in d && d.exact)
    expect(exact.map((d) => d.href)).toEqual(['/my'])
  })
})

describe('a brand-new client', () => {
  it('is offered only the two rights channels', () => {
    expect(availableModules(ctx()).map((m) => m.id)).toEqual(['requests', 'privacy'])
  })

  it('is told what would reveal each held-back module, never told off', () => {
    for (const m of heldBackModules(ctx())) {
      expect(m.waitingFor).toBeTruthy()
      expect(m.waitingFor!).toMatch(/^Appears once/)
    }
  })

  it('does not meet the full product map on day one', () => {
    // The complaint that started this: fourteen items at once.
    expect(availableModules(ctx()).length).toBeLessThan(DEEPER_MODULE_IDS.length)
  })
})

describe('rights channels are never conditional', () => {
  const RIGHTS = ['requests', 'privacy']

  it('are available in every context, including the emptiest', () => {
    const contexts: ClientContext[] = [
      ctx(),
      ctx({ intakeSubmitted: true }),
      ctx({ hasSignedPlan: true, hasCheckins: true, hasLabReports: true, hasWorkshopBookings: true }),
    ]
    for (const c of contexts) {
      const ids = availableModules(c).map((m) => m.id)
      for (const r of RIGHTS) expect(ids).toContain(r)
    }
  })

  it('carry the alwaysAvailable marker, so the intent is explicit in the data', () => {
    const marked = deeperModules(ctx()).filter((m) => m.alwaysAvailable).map((m) => m.id)
    expect(marked.sort()).toEqual([...RIGHTS].sort())
  })

  it('never state a waitingFor reason', () => {
    for (const m of deeperModules(ctx()).filter((x) => RIGHTS.includes(x.id))) {
      expect(m.waitingFor).toBeNull()
    }
  })
})

describe('reveal conditions', () => {
  it('sharing the health story opens the story, synopsis, BioHub and RootFinder', () => {
    const ids = availableModules(ctx({ intakeSubmitted: true })).map((m) => m.id)
    expect(ids).toContain('story')
    expect(ids).toContain('synopsis')
    expect(ids).toContain('biohub')
    expect(ids).toContain('rootfinder')
  })

  it('does not open plan tools merely because the story was shared', () => {
    const ids = availableModules(ctx({ intakeSubmitted: true })).map((m) => m.id)
    expect(ids).not.toContain('dailypath')
    expect(ids).not.toContain('lifetracker')
  })

  it('a SIGNED plan opens DailyPath and LifeTracker', () => {
    const ids = availableModules(ctx({ hasSignedPlan: true })).map((m) => m.id)
    expect(ids).toContain('dailypath')
    expect(ids).toContain('lifetracker')
  })

  it('BioHub is reachable before any upload exists — otherwise you could never start', () => {
    // A module gated on having already used it is unreachable. The condition
    // is the story, not the upload.
    const ids = availableModules(ctx({ intakeSubmitted: true, hasLabReports: false })).map((m) => m.id)
    expect(ids).toContain('biohub')
  })

  it('an uploaded report alone also reveals BioHub', () => {
    const ids = availableModules(ctx({ hasLabReports: true })).map((m) => m.id)
    expect(ids).toContain('biohub')
  })

  it('Trajectory waits for recorded days, not for the plan', () => {
    expect(availableModules(ctx({ hasSignedPlan: true })).map((m) => m.id)).not.toContain('trajectory')
    expect(availableModules(ctx({ hasCheckins: true })).map((m) => m.id)).toContain('trajectory')
  })

  it('workshops appear only with a booking', () => {
    expect(availableModules(ctx()).map((m) => m.id)).not.toContain('workshops')
    expect(availableModules(ctx({ hasWorkshopBookings: true })).map((m) => m.id)).toContain('workshops')
  })
})

describe('nothing is deleted', () => {
  it('every declared module is always present in the list, available or not', () => {
    const all = deeperModules(ctx()).map((m) => m.id).sort()
    expect(all).toEqual([...DEEPER_MODULE_IDS].sort())
  })

  it('a fully-active client is offered every module', () => {
    const full = ctx({
      intakeSubmitted: true, hasSignedPlan: true, hasLabReports: true,
      hasCheckins: true, hasWorkshopBookings: true,
    })
    expect(availableModules(full)).toHaveLength(DEEPER_MODULE_IDS.length)
    expect(heldBackModules(full)).toHaveLength(0)
  })

  it('every module keeps a real href, so no route is orphaned', () => {
    for (const m of deeperModules(ctx())) {
      expect(m.href).toMatch(/^\/dashboard\//)
    }
  })

  it('every module has a client-language blurb', () => {
    for (const m of deeperModules(ctx())) {
      expect(m.blurb.length).toBeGreaterThan(10)
      // No internal vocabulary leaking into the client's shell.
      expect(m.blurb).not.toMatch(/\bL[123]\b|provenance|canonical|fixture/i)
    }
  })
})
