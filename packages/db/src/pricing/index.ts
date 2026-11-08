// ─── NI pricing — the PUBLIC surface ─────────────────────────────────────────
//
// This barrel exposes only what a client may see. PRACTITIONER_TIME_ALLOWANCES
// is deliberately NOT re-exported: internal professional-time allowances and
// the consultation-timer thresholds must never reach a render path, and
// leaving them off this barrel is what makes that true rather than hoped for.
//
// Anything under apps/ imports from '@natural-intelligence/db/pricing'. The
// internal namespace is reachable only through this module's sibling deep
// path, and previewPageBoundary.test.ts fails if an app takes it.

export type { ServicePrice, CareServiceKey } from './catalogue'

export {
  CURRENCY_SYMBOL,
  formatPounds,
  standardLabel,
  memberLabel,
  inlinePriceLabel,
  MEMBERSHIP,
  MEMBERSHIP_HEADLINE,
  MEMBERSHIP_YEARLY_NOTE,
  FAMILY_MEMBERSHIP_PRICE,
  FAMILY_MEMBERSHIP_NOTE,
  GUIDED_GROUPS,
  INITIAL_CARE_REVIEW,
  FOLLOW_UP_REVIEW,
  FOCUSED_CHECK_IN,
  SPECIALIST_CONTRIBUTION,
  CARE_PRICES,
  ONGOING_SUPPORT,
  PRICING_PREVIEW,
} from './catalogue'
