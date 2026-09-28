// Acceptance tests for the single public workshop source of truth.
//
// The defect these guard against: the homepage and /workshops each had their
// own workshop data source (the legacy `events` table), so the homepage said
// "No workshops are currently scheduled" while a real workshop was published.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { communityWorkshops } from '../communityWorkshops'
import type { CommunityWorkshop } from '../communityWorkshops'
import { getNextWorkshop, getUpcomingWorkshops, getPastWorkshops, getUndatedWorkshops } from './selectors'
import { getEventPhase, isBookable } from './lifecycle'
import type { BookingState } from './lifecycle'

// Minimal synthetic registry entry.
function mk(
  slug: string,
  scheduling?: { start: string; end: string; closes: string; bookingState?: BookingState },
): CommunityWorkshop {
  return {
    slug,
    title: slug,
    presentedBy: 'Natural Intelligence',
    tagline: 'The Signs Are Within You',
    theme: 'Test',
    audience: 'Ladies only',
    cost: 'Free',
    date: 'Test date',
    time: 'Test time',
    venueLines: ['Test venue'],
    status: 'open',
    intro: 'Test intro',
    practitioners: [],
    ...(scheduling
      ? {
          scheduling: {
            start: scheduling.start,
            end: scheduling.end,
            timezone: 'Europe/London' as const,
            bookingClosesAt: scheduling.closes,
            bookingState: scheduling.bookingState ?? 'open',
          },
        }
      : {}),
  }
}

const NOW = new Date('2026-10-01T09:00:00+01:00')

const upcomingOpen = mk('upcoming-open', {
  start: '2026-10-07T10:30:00+01:00', end: '2026-10-07T12:45:00+01:00', closes: '2026-10-06T23:59:00+01:00',
})
const upcomingClosed = mk('upcoming-closed', {
  start: '2026-10-03T10:30:00+01:00', end: '2026-10-03T12:45:00+01:00', closes: '2026-09-30T23:59:00+01:00',
})
const upcomingFull = mk('upcoming-full', {
  start: '2026-10-05T10:30:00+01:00', end: '2026-10-05T12:45:00+01:00', closes: '2026-10-04T23:59:00+01:00',
  bookingState: 'full',
})
const pastWorkshop = mk('past-workshop', {
  start: '2026-09-02T11:00:00+01:00', end: '2026-09-02T13:00:00+01:00', closes: '2026-09-01T23:59:00+01:00',
})
const undated = mk('undated-concept')

describe('A: a canonical upcoming workshop is what the homepage shows', () => {
  it('returns the soonest upcoming dated workshop', () => {
    const next = getNextWorkshop(NOW, [pastWorkshop, upcomingOpen, upcomingClosed])
    expect(next?.slug).toBe('upcoming-closed') // 3 Oct is sooner than 7 Oct
  })
})

describe('B: no upcoming dated workshop → homepage empty state', () => {
  it('returns undefined when the registry holds only past and undated entries', () => {
    expect(getNextWorkshop(NOW, [pastWorkshop, undated])).toBeUndefined()
  })

  it('returns undefined for an empty registry', () => {
    expect(getNextWorkshop(NOW, [])).toBeUndefined()
  })
})

describe('C: past workshops never appear as upcoming', () => {
  it('excludes finished workshops from upcoming and lists them as past', () => {
    expect(getUpcomingWorkshops(NOW, [pastWorkshop]).map((w) => w.slug)).toEqual([])
    expect(getPastWorkshops(NOW, [pastWorkshop]).map((w) => w.slug)).toEqual(['past-workshop'])
  })

  it('undated concepts are neither upcoming nor past', () => {
    expect(getUpcomingWorkshops(NOW, [undated])).toHaveLength(0)
    expect(getPastWorkshops(NOW, [undated])).toHaveLength(0)
    expect(getUndatedWorkshops([undated]).map((w) => w.slug)).toEqual(['undated-concept'])
  })
})

describe('D: booking closed but the workshop is still upcoming', () => {
  it('still appears, with the booking-closed status and no live CTA', () => {
    const next = getNextWorkshop(NOW, [upcomingClosed])
    expect(next?.slug).toBe('upcoming-closed')
    expect(getEventPhase(next!.scheduling, NOW)).toBe('booking_closed_upcoming')
    expect(isBookable(next!.scheduling, NOW)).toBe(false)
  })
})

describe('E: manually full but still upcoming', () => {
  it('still appears, still phase booking_open, but not bookable', () => {
    const next = getNextWorkshop(NOW, [upcomingFull])
    expect(next?.slug).toBe('upcoming-full')
    expect(getEventPhase(next!.scheduling, NOW)).toBe('booking_open')
    expect(isBookable(next!.scheduling, NOW)).toBe(false)
  })
})

describe('F: the homepage and /workshops read the same source', () => {
  const homepage = readFileSync('app/page.tsx', 'utf8')
  const workshopsPage = readFileSync('app/workshops/page.tsx', 'utf8')

  it('both derive workshops from the shared selectors', () => {
    expect(homepage).toContain("from '@/lib/workshops/selectors'")
    expect(workshopsPage).toContain("from '@/lib/workshops/selectors'")
  })

  it('neither public page queries the legacy events tables', () => {
    for (const source of [homepage, workshopsPage]) {
      expect(source).not.toContain("from('events')")
      expect(source).not.toContain("from('event_registrations')")
    }
  })

  it('the homepage does not hard-code a workshop', () => {
    expect(homepage).not.toContain('from-stressed-to-steady')
    expect(homepage).not.toContain('Ilford')
  })

  it('both pages render per-request so lifecycle cannot freeze at build time', () => {
    for (const source of [homepage, workshopsPage]) {
      expect(source).toContain("export const dynamic = 'force-dynamic'")
    }
  })
})

describe('G: the stale "Online sessions & member events" block is gone', () => {
  const workshopsPage = readFileSync('app/workshops/page.tsx', 'utf8')

  it('the second empty events system is absent from /workshops', () => {
    expect(workshopsPage).not.toContain('Online sessions')
    expect(workshopsPage).not.toContain('RegisterButton')
    expect(workshopsPage).not.toContain('copy.workshops.empty')
    expect(workshopsPage).not.toContain('copy.workshops.filters')
  })

  it('genuine community content and the health notice remain', () => {
    expect(workshopsPage).toContain('CommunityWorkshopCard')
    expect(workshopsPage).toContain('workshopBoundaryNotice')
  })

  it('no form or registration capture remains on the public workshops page', () => {
    expect(workshopsPage).not.toContain('<form')
    expect(workshopsPage).not.toContain('registerForEvent')
  })
})

describe('the real canonical registry (October workshop)', () => {
  // Fixed instant before the event so the assertion stays true over time.
  const before = new Date('2026-09-25T10:00:00+01:00')

  it('returns From Stressed to Steady as the next upcoming workshop', () => {
    const next = getNextWorkshop(before, communityWorkshops)
    expect(next?.slug).toBe('from-stressed-to-steady-oct-2026')
    expect(next?.title).toBe('From Stressed to Steady')
  })

  it('places the September workshop in past, not upcoming', () => {
    expect(getUpcomingWorkshops(before, communityWorkshops).map((w) => w.slug))
      .not.toContain('thriving-naturally-living-well')
    expect(getPastWorkshops(before, communityWorkshops).map((w) => w.slug))
      .toContain('thriving-naturally-living-well')
  })

  it('sorts upcoming soonest-first and past most-recent-first', () => {
    const upcomingStarts = getUpcomingWorkshops(before, communityWorkshops)
      .map((w) => new Date(w.scheduling.start).getTime())
    expect([...upcomingStarts].sort((a, b) => a - b)).toEqual(upcomingStarts)

    const pastStarts = getPastWorkshops(before, communityWorkshops)
      .map((w) => new Date(w.scheduling.start).getTime())
    expect([...pastStarts].sort((a, b) => b - a)).toEqual(pastStarts)
  })
})
