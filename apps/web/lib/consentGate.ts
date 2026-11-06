// ─── lib/consentGate.ts ───────────────────────────────────────────────────────
// Mission 19 — which dashboard routes stay reachable while the foundational-
// consent gate is showing.
//
// Founder direction: "Do not block access to Privacy/Data Rights controls
// behind this gate." A member must never have to agree to something in order
// to read their privacy choices or exercise a data right. Extracted here so
// that rule is unit-tested rather than asserted in a layout.

export const CONSENT_GATE_EXEMPT_ROUTES = [
  '/dashboard/privacy',
  '/dashboard/requests',
] as const

/**
 * True when `pathname` must render normally even if the member holds no
 * foundational consent evidence.
 *
 * An unknown pathname is NOT exempt: the gate is the safe default, and the
 * exempt routes are reached by their own known paths.
 */
export function isConsentGateExempt(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return CONSENT_GATE_EXEMPT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}
