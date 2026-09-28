// ─── apps/web/lib/workshops/selectors.ts ──────────────────────────────────────
// The ONE way any public surface asks "what workshops are on?".
//
// There is a single canonical registry (lib/communityWorkshops.ts) and a
// single lifecycle rule set (./lifecycle.ts). The homepage preview, the
// /workshops listing and the detail pages all derive from these selectors, so
// they can never disagree about what is upcoming, closed, full or past.
// Do not add a second workshop/event array anywhere.

import { communityWorkshops } from '../communityWorkshops'
import type { CommunityWorkshop } from '../communityWorkshops'
import { isUpcoming, type EventScheduling } from './lifecycle'

/** A registry entry with canonical dates — the only kind that can be
 *  "upcoming" or "past". Undated announcements (date TBC) are neither. */
export type ScheduledWorkshop = CommunityWorkshop & { scheduling: EventScheduling }

export function isScheduled(workshop: CommunityWorkshop): workshop is ScheduledWorkshop {
  return !!workshop.scheduling
}

const byStartAscending = (a: ScheduledWorkshop, b: ScheduledWorkshop) =>
  new Date(a.scheduling.start).getTime() - new Date(b.scheduling.start).getTime()

/** Dated workshops that have not yet finished, soonest first. A workshop whose
 *  bookings have closed — or that is manually marked full — is still upcoming;
 *  only the event END moves it to past. */
export function getUpcomingWorkshops(
  now: Date = new Date(),
  registry: CommunityWorkshop[] = communityWorkshops,
): ScheduledWorkshop[] {
  return registry.filter(isScheduled).filter((w) => isUpcoming(w.scheduling, now)).sort(byStartAscending)
}

/** Dated workshops that have finished, most recent first. */
export function getPastWorkshops(
  now: Date = new Date(),
  registry: CommunityWorkshop[] = communityWorkshops,
): ScheduledWorkshop[] {
  return registry.filter(isScheduled).filter((w) => !isUpcoming(w.scheduling, now)).sort((a, b) => -byStartAscending(a, b))
}

/** Announced but undated entries (date TBC). Never counted as upcoming, and
 *  never used as the homepage preview — there is nothing to attend yet. */
export function getUndatedWorkshops(
  registry: CommunityWorkshop[] = communityWorkshops,
): CommunityWorkshop[] {
  return registry.filter((w) => !w.scheduling)
}

/** The single workshop a preview surface (e.g. the homepage) should show, or
 *  undefined when there is genuinely no upcoming dated workshop. */
export function getNextWorkshop(
  now: Date = new Date(),
  registry: CommunityWorkshop[] = communityWorkshops,
): ScheduledWorkshop | undefined {
  return getUpcomingWorkshops(now, registry)[0]
}
