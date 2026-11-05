// ─── Progressive client navigation ──────────────────────────────────────────
//
// The client sees five destinations describing what they HAVE. Everything NI
// has built is still reachable, but a module only appears once there is a
// reason for it to exist in this person's account.
//
// WHY THIS IS A MODULE AND NOT JSX
//
// "Reveal it when relevant" is a rule, and a rule that lives inside a
// component cannot be read or tested. Put it here and the question "why can
// this person not see BioHub yet" has one answer with one test beside it.
//
// WHAT THIS IS NOT
//
// It is not deletion. Every /dashboard route still exists and still works;
// nothing is removed and no link is broken. This decides what is OFFERED on a
// first visit, not what is permitted.
//
// TWO MODULES ARE NEVER HIDDEN
//
// Privacy & Data Controls and My requests are how a person exercises their
// data rights. Hiding a rights channel until NI considers it "relevant" would
// make the exercise of a right conditional on our judgement of whether they
// need it. They are always listed. This is a legal floor, not a design
// preference, so it is asserted by test.

/** The five primary destinations. Fixed — these are the client's shell. */
export const PRIMARY_DESTINATIONS = [
  { href: '/my', label: 'Today', exact: true },
  { href: '/my/health', label: 'My Health' },
  { href: '/my/plan', label: 'My Plan' },
  { href: '/my/progress', label: 'My Progress' },
  { href: '/my/team', label: 'My Team' },
] as const

/** Everything else NI has built, with the condition that surfaces it. */
export const DEEPER_MODULE_IDS = [
  'story', 'synopsis', 'biohub', 'rootfinder', 'dailypath',
  'trajectory', 'lifetracker', 'workshops', 'requests', 'privacy',
] as const
export type DeeperModuleId = (typeof DEEPER_MODULE_IDS)[number]

/**
 * What NI knows about this person, reduced to the few facts the reveal rule
 * actually depends on. Deliberately small: a nav rule that needs the whole
 * record is a nav rule nobody can reason about.
 */
export interface ClientContext {
  /** Their health story has been submitted for practitioner review. */
  intakeSubmitted: boolean
  /** A practitioner has SIGNED a plan. A draft is not a plan. */
  hasSignedPlan: boolean
  /** They have uploaded at least one lab report. */
  hasLabReports: boolean
  /** They have recorded at least one day of their plan. */
  hasCheckins: boolean
  /** They hold at least one workshop booking. */
  hasWorkshopBookings: boolean
}

export interface DeeperModule {
  id: DeeperModuleId
  label: string
  href: string
  /** One line in the client's language: what this is for. */
  blurb: string
  /** Shown now, or held back until its condition is met. */
  available: boolean
  /** When held back, what would make it appear. Never a scolding. */
  waitingFor: string | null
  /** Always listed regardless of context — a rights channel. */
  alwaysAvailable?: true
}

/**
 * The deeper modules, in the order a person meets them, each with the
 * condition that reveals it.
 *
 * Order follows the care journey rather than the product map: your story
 * first, then what came back from it, then the tools that act on it.
 */
export function deeperModules(ctx: ClientContext): DeeperModule[] {
  return [
    {
      id: 'story',
      label: "My body's story",
      href: '/dashboard/story',
      blurb: 'The account of your health in your own words, read back to you.',
      available: ctx.intakeSubmitted,
      waitingFor: ctx.intakeSubmitted ? null : 'Appears once you have shared your health story.',
    },
    {
      id: 'synopsis',
      label: 'My synopsis',
      href: '/dashboard/synopsis',
      blurb: 'The organised summary your practitioner works from.',
      available: ctx.intakeSubmitted,
      waitingFor: ctx.intakeSubmitted ? null : 'Appears once you have shared your health story.',
    },
    {
      id: 'biohub',
      label: 'BioHub',
      href: '/dashboard/biohub',
      blurb: 'Your lab reports, kept together and explained in plain terms.',
      // Offered as soon as the story exists, because uploading is how it
      // starts — a module you can only see after using it is unreachable.
      available: ctx.intakeSubmitted || ctx.hasLabReports,
      waitingFor: (ctx.intakeSubmitted || ctx.hasLabReports)
        ? null
        : 'Appears once you have shared your health story.',
    },
    {
      id: 'rootfinder',
      label: 'RootFinder',
      href: '/dashboard/rootfinder',
      blurb: 'Explore the broad themes that may be shaping how you feel.',
      available: ctx.intakeSubmitted,
      waitingFor: ctx.intakeSubmitted ? null : 'Appears once you have shared your health story.',
    },
    {
      id: 'dailypath',
      label: 'DailyPath',
      href: '/dashboard/dailypath',
      blurb: 'Your plan, a day at a time.',
      available: ctx.hasSignedPlan,
      waitingFor: ctx.hasSignedPlan ? null : 'Appears once your practitioner has signed a plan with you.',
    },
    {
      id: 'trajectory',
      label: 'Trajectory',
      href: '/dashboard/trajectory',
      blurb: 'How things have moved since you started.',
      available: ctx.hasCheckins,
      waitingFor: ctx.hasCheckins ? null : 'Appears once you have recorded a few days.',
    },
    {
      id: 'lifetracker',
      label: 'LifeTracker',
      href: '/dashboard/lifetracker',
      blurb: 'The goals you set yourself, and how they are going.',
      available: ctx.hasSignedPlan,
      waitingFor: ctx.hasSignedPlan ? null : 'Appears once your practitioner has signed a plan with you.',
    },
    {
      id: 'workshops',
      label: 'My workshops',
      href: '/dashboard/workshops',
      blurb: 'The sessions you have booked.',
      available: ctx.hasWorkshopBookings,
      waitingFor: ctx.hasWorkshopBookings ? null : 'Appears once you have booked a workshop.',
    },
    // ── Rights channels. Never conditional. ──────────────────────────────────
    {
      id: 'requests',
      label: 'My requests',
      href: '/dashboard/requests',
      blurb: 'Ask us for a copy of your data, a correction, or deletion.',
      available: true,
      waitingFor: null,
      alwaysAvailable: true,
    },
    {
      id: 'privacy',
      label: 'Privacy & Data Controls',
      href: '/dashboard/privacy',
      blurb: 'What you have agreed to, and how to change it.',
      available: true,
      waitingFor: null,
      alwaysAvailable: true,
    },
  ]
}

/** Modules offered now. */
export function availableModules(ctx: ClientContext): DeeperModule[] {
  return deeperModules(ctx).filter((m) => m.available)
}

/** Modules held back, with the reason each is waiting. */
export function heldBackModules(ctx: ClientContext): DeeperModule[] {
  return deeperModules(ctx).filter((m) => !m.available)
}

/** A person at the very beginning: nothing shared, nothing signed. */
export const NEW_CLIENT_CONTEXT: ClientContext = {
  intakeSubmitted: false,
  hasSignedPlan: false,
  hasLabReports: false,
  hasCheckins: false,
  hasWorkshopBookings: false,
}
