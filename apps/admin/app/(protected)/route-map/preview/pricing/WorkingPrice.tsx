// ─── WorkingPrice ────────────────────────────────────────────────────────────
// The "Working price · preview" tag.
//
// Driven entirely by PRICING_PREVIEW.showWorkingPrices in the catalogue, so
// the tag can be switched off before production WITHOUT touching this page or
// any panel. That is the point of the flag: the change that makes these
// prices final should be one line in the config, not a hunt through markup.
//
// Placed ONCE PER CARE PRICE BLOCK, per the Founder's ruling. Since v14 there
// are two, not three:
//   1. the Initial NI Care Review price
//   2. the Optional ongoing support list — one tag covering all three services
//
// The third was Guided Groups, withdrawn in v14. NI Circles replaced it inside
// Membership and carry NO price, so there is nothing to tag: a working-price
// label beside "Included" would imply a figure still to be settled.
//
// Never on Membership either: the monthly and yearly figures are settled, not
// working prices.

import { PRICING_PREVIEW } from '@natural-intelligence/db/pricing'
import { C } from './theme'

export function WorkingPrice() {
  if (!PRICING_PREVIEW.showWorkingPrices) return null

  return (
    <span
      className="inline-block mt-2 font-semibold uppercase"
      style={{
        fontSize: 12,
        letterSpacing: '0.08em',
        color: '#7A5E33',
        border: `1px solid ${C.goldLine}`,
        borderRadius: 4,
        padding: '3px 8px',
      }}
    >
      {PRICING_PREVIEW.workingPriceLabel}
    </span>
  )
}
