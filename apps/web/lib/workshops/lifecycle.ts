// ─── apps/web/lib/workshops/lifecycle.ts ─────────────────────────────────────────
// Pure lifecycle derivation for public community workshops.
//
// Phases are derived from the event's canonical ISO-8601 timestamps, which
// carry explicit Europe/London UTC offsets (+01:00 BST / +00:00 GMT), so the
// comparisons below are exact regardless of the server's own timezone:
//
//   PHASE A  booking_open              now <  bookingClosesAt
//   PHASE B  booking_closed_upcoming   bookingClosesAt <= now < end
//   PHASE C  past                      now >= end
//
// `bookingState` is a MANUAL founder-set override only ('open' | 'full').
// It is not a capacity system: 'full' simply hides the booking CTA early.

export type EventPhase = 'booking_open' | 'booking_closed_upcoming' | 'past'

export type BookingState = 'open' | 'full'

export interface EventScheduling {
  /** Event start, ISO-8601 with explicit offset, e.g. 2026-10-07T10:30:00+01:00 */
  start: string
  /** Event end, ISO-8601 with explicit offset. */
  end: string
  /** IANA timezone the offsets were written in (informational). */
  timezone: 'Europe/London'
  /** Bookings close, ISO-8601 with explicit offset. At this instant, closed. */
  bookingClosesAt: string
  /** Manual override; 'full' hides the booking CTA before bookings close. */
  bookingState: BookingState
}

export function getEventPhase(scheduling: EventScheduling, now: Date = new Date()): EventPhase {
  const t = now.getTime()
  if (t >= new Date(scheduling.end).getTime()) return 'past'
  if (t < new Date(scheduling.bookingClosesAt).getTime()) return 'booking_open'
  return 'booking_closed_upcoming'
}

/** True only while the live booking CTA should render. */
export function isBookable(scheduling: EventScheduling, now: Date = new Date()): boolean {
  return getEventPhase(scheduling, now) === 'booking_open' && scheduling.bookingState !== 'full'
}

/** True while the event has not yet finished (phases A and B). */
export function isUpcoming(scheduling: EventScheduling, now: Date = new Date()): boolean {
  return getEventPhase(scheduling, now) !== 'past'
}
