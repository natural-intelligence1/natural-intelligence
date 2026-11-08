// ─── packages/db/src/pricing/catalogue.ts ────────────────────────────────────
// THE one typed source of every NI price.
//
// Components render from here and hold no £ literals of their own — a
// structural test (previewPageBoundary.test.ts) fails if a price string
// appears in the preview page source, because a figure written into markup is
// a figure nobody can find again when it changes.
//
// TWO NAMESPACES, ONE FILE, DELIBERATELY SEPARATE EXPORTS
//
//   · the public catalogue      — what a client may see
//   · PRACTITIONER_TIME_ALLOWANCES — internal; MUST NOT reach any render path
//
// The internal namespace is NOT re-exported from ./index.ts. The only way to
// reach it is this module's deep path, and a test asserts that nothing under
// apps/ takes it. That is the enforcement: not a comment asking people to be
// careful, but a failing test if they are not.
//
// Prices are WORKING PRICES pending final Founder sign-off. On the preview
// surface they carry a visible tag, driven by PRICING_PREVIEW below so the tag
// can be switched off for production without editing a page.

/** A price with its preferential member equivalent. */
export interface ServicePrice {
  /** Full price in whole pounds. */
  readonly standard: number
  /** Preferential member price in whole pounds. */
  readonly member: number
  /** True where the figure is a floor ("from £199"), not a fixed price. */
  readonly from: boolean
}

export const CURRENCY_SYMBOL = '£' as const

/**
 * Render a price. The symbol lives here so no component spells it.
 * `from` prefixes are the caller's business — the label helpers below carry
 * them, because "from" is copy and not part of the number.
 */
export function formatPounds(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount}`
}

/** "£199" or "from £199". */
export function standardLabel(p: ServicePrice): string {
  return p.from ? `from ${formatPounds(p.standard)}` : formatPounds(p.standard)
}

/** "Members £225" or "Members from £179". */
export function memberLabel(p: ServicePrice): string {
  return p.from
    ? `Members from ${formatPounds(p.member)}`
    : `Members ${formatPounds(p.member)}`
}

/** "£125 · members £110" — the inline form used in the ongoing-support list. */
export function inlinePriceLabel(p: ServicePrice): string {
  return p.from
    ? `from ${formatPounds(p.standard)} · members from ${formatPounds(p.member)}`
    : `${formatPounds(p.standard)} · members ${formatPounds(p.member)}`
}

// ─── Membership ──────────────────────────────────────────────────────────────
// No Monthly/Yearly selector. Both figures are stated together, with the
// saving, because a toggle hides half the price from someone comparing.

export const MEMBERSHIP = {
  monthly: 19,
  yearly: 190,
  /** 12 × 19 − 190. Stated, not computed in markup. */
  yearlySaving: 38,
} as const

/** "£19" — the headline figure on the Membership card. */
export const MEMBERSHIP_HEADLINE = formatPounds(MEMBERSHIP.monthly)

/** "or £190 / year — save £38" */
export const MEMBERSHIP_YEARLY_NOTE =
  `or ${formatPounds(MEMBERSHIP.yearly)} / year — save ${formatPounds(MEMBERSHIP.yearlySaving)}`

/**
 * NI Family Membership has no price yet. It is a declared absence, not a
 * missing value: the card says so and the FAQ repeats it.
 */
export const FAMILY_MEMBERSHIP_PRICE: null = null
export const FAMILY_MEMBERSHIP_NOTE = 'Pricing to be confirmed' as const

// ─── Professional care ───────────────────────────────────────────────────────
// The frozen architecture. Guided Groups and the Initial Review are entry
// points; the three ongoing services are optional and individually agreed.

export const GUIDED_GROUPS: ServicePrice = { standard: 199, member: 179, from: true }

export const INITIAL_CARE_REVIEW: ServicePrice = { standard: 249, member: 225, from: false }

export const FOLLOW_UP_REVIEW: ServicePrice = { standard: 125, member: 110, from: false }

export const FOCUSED_CHECK_IN: ServicePrice = { standard: 70, member: 60, from: false }

export const SPECIALIST_CONTRIBUTION: ServicePrice = { standard: 95, member: 85, from: true }

/** Every care price, for iteration and for the guard tests. */
export const CARE_PRICES = {
  guided_groups: GUIDED_GROUPS,
  initial_care_review: INITIAL_CARE_REVIEW,
  follow_up_review: FOLLOW_UP_REVIEW,
  focused_check_in: FOCUSED_CHECK_IN,
  specialist_contribution: SPECIALIST_CONTRIBUTION,
} as const

export type CareServiceKey = keyof typeof CARE_PRICES

/**
 * The optional ongoing services, in the order the page lists them. One
 * "Working price · preview" tag covers the whole list, so the list is data
 * rather than three tagged blocks.
 */
export const ONGOING_SUPPORT: readonly {
  readonly key: CareServiceKey
  readonly name: string
  readonly note: string
}[] = [
  { key: 'follow_up_review', name: 'Follow-up Review', note: 'A further review of your progress' },
  { key: 'focused_check_in', name: 'Focused Check-in', note: 'One defined matter' },
  {
    key: 'specialist_contribution',
    name: 'Specialist Contribution',
    note: 'Input from another NI specialist, scoped first',
  },
] as const

// ─── Preview presentation ────────────────────────────────────────────────────

export const PRICING_PREVIEW = {
  /**
   * Drives <WorkingPrice>. Set false and every working-price tag disappears
   * with no page edit — which is what makes this safe to hand to production
   * later. Placed once per care price block: Guided Groups, the Initial
   * Review, and the ongoing-support list as a whole. Never on Membership.
   */
  showWorkingPrices: true,
  workingPriceLabel: 'Working price · preview',
} as const

// ─── INTERNAL — practitioner time. NOT PUBLIC. ───────────────────────────────
//
// Total authorised professional time per service, and the consultation-timer
// thresholds. DATA ONLY: no timer, no logging and no finance engine is built
// from this, and nothing here is rendered on /pricing or on the preview page.
//
// Not re-exported from ./index.ts. Importing this into anything under apps/
// fails previewPageBoundary.test.ts.
//
// On the thresholds: they are specified against a SIXTY-minute allowance
// (calm notice 50, stronger 58, allowance ends 60, grace 5, exception
// required at 65). How they should scale for the 120-minute Initial Review or
// the 30-minute Check-in is NOT decided, so it is not encoded here — deriving
// it would be inventing policy. The timer design has to settle that.

export const PRACTITIONER_TIME_ALLOWANCES = {
  /** Total authorised professional time, in minutes. */
  services: {
    initial_care_review: { totalMinutes: 120, setBeforeAssignment: false },
    follow_up_review: { totalMinutes: 60, setBeforeAssignment: false },
    focused_check_in: { totalMinutes: 30, setBeforeAssignment: false },
    /** 30–60, set before assignment by scope — hence the range. */
    specialist_contribution: {
      minMinutes: 30,
      maxMinutes: 60,
      setBeforeAssignment: true,
    },
  },

  /** Consultation-timer thresholds, in minutes, for a 60-minute allowance. */
  timer: {
    specifiedForAllowanceMinutes: 60,
    calmNoticeAtMinutes: 50,
    strongNoticeAtMinutes: 58,
    allowanceEndsAtMinutes: 60,
    gracePeriodMinutes: 5,
    /**
     * Past this point chargeable time must not continue silently: the
     * practitioner ends the consultation, requests additional authorised
     * time, or records a justified exception.
     */
    exceptionRequiredAtMinutes: 65,
  },

  /**
   * The phases time is logged against. A practitioner is never forced to
   * stop — a safety exception is flagged, needs a reason, goes to the
   * admin/Founder exception queue and is recorded separately.
   */
  phases: [
    'preparation',
    'consultation',
    'protocol_write_up',
    'safety_review',
    'signing',
    'follow_up',
    'coordination',
    'other_approved_work',
  ],
} as const

export type PractitionerTimePhase = (typeof PRACTITIONER_TIME_ALLOWANCES.phases)[number]
