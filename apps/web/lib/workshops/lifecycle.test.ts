// Boundary tests for the public event lifecycle, using the canonical
// From Stressed to Steady timestamps (Europe/London, BST +01:00).

import { describe, it, expect } from 'vitest'
import { getEventPhase, isBookable, isUpcoming, type EventScheduling } from './lifecycle'

const scheduling: EventScheduling = {
  start:           '2026-10-07T10:30:00+01:00',
  end:             '2026-10-07T12:45:00+01:00',
  timezone:        'Europe/London',
  bookingClosesAt: '2026-10-06T23:59:00+01:00',
  bookingState:    'open',
}

describe('getEventPhase — Europe/London boundary semantics', () => {
  it('immediately before booking close → booking_open', () => {
    const now = new Date('2026-10-06T23:58:59+01:00')
    expect(getEventPhase(scheduling, now)).toBe('booking_open')
    expect(isBookable(scheduling, now)).toBe(true)
  })

  it('exactly at booking close → booking_closed_upcoming', () => {
    const now = new Date('2026-10-06T23:59:00+01:00')
    expect(getEventPhase(scheduling, now)).toBe('booking_closed_upcoming')
    expect(isBookable(scheduling, now)).toBe(false)
  })

  it('after booking close but before the event → booking_closed_upcoming (not past)', () => {
    const now = new Date('2026-10-07T08:00:00+01:00')
    expect(getEventPhase(scheduling, now)).toBe('booking_closed_upcoming')
    expect(isUpcoming(scheduling, now)).toBe(true)
  })

  it('during the event → booking_closed_upcoming (still not past)', () => {
    const now = new Date('2026-10-07T11:30:00+01:00')
    expect(getEventPhase(scheduling, now)).toBe('booking_closed_upcoming')
    expect(isBookable(scheduling, now)).toBe(false)
  })

  it('exactly at event end → past', () => {
    const now = new Date('2026-10-07T12:45:00+01:00')
    expect(getEventPhase(scheduling, now)).toBe('past')
    expect(isUpcoming(scheduling, now)).toBe(false)
  })

  it('after event end → past', () => {
    const now = new Date('2026-10-08T09:00:00+01:00')
    expect(getEventPhase(scheduling, now)).toBe('past')
    expect(isBookable(scheduling, now)).toBe(false)
  })

  it('offsets are respected: 23:59 London is 22:59 UTC', () => {
    // One second before close, expressed in UTC.
    expect(getEventPhase(scheduling, new Date('2026-10-06T22:58:59Z'))).toBe('booking_open')
    // At close, expressed in UTC.
    expect(getEventPhase(scheduling, new Date('2026-10-06T22:59:00Z'))).toBe('booking_closed_upcoming')
  })
})

describe('manual fully-booked override', () => {
  const full: EventScheduling = { ...scheduling, bookingState: 'full' }

  it('while bookings would otherwise be open, full hides the CTA but the phase stays booking_open', () => {
    const now = new Date('2026-10-01T12:00:00+01:00')
    expect(getEventPhase(full, now)).toBe('booking_open')
    expect(isBookable(full, now)).toBe(false)
  })

  it('default state is bookable during phase A', () => {
    const now = new Date('2026-10-01T12:00:00+01:00')
    expect(isBookable(scheduling, now)).toBe(true)
  })
})
