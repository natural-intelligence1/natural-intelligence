// ─── catalogue.test.ts ───────────────────────────────────────────────────────
// The frozen public care architecture, asserted figure by figure.
//
// These numbers were ruled by the Founder. A test that merely checked the
// shape would let a wrong price through, so every one is pinned to its exact
// value: if someone changes a price, this fails and they have to mean it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CARE_PRICES,
  GUIDED_GROUPS,
  INITIAL_CARE_REVIEW,
  FOLLOW_UP_REVIEW,
  FOCUSED_CHECK_IN,
  SPECIALIST_CONTRIBUTION,
  MEMBERSHIP,
  MEMBERSHIP_HEADLINE,
  MEMBERSHIP_YEARLY_NOTE,
  FAMILY_MEMBERSHIP_PRICE,
  ONGOING_SUPPORT,
  PRICING_PREVIEW,
  standardLabel,
  memberLabel,
  inlinePriceLabel,
  formatPounds,
} from './catalogue'
import { PRACTITIONER_TIME_ALLOWANCES } from './catalogue'

const HERE = dirname(fileURLToPath(import.meta.url))

describe('the frozen public care architecture', () => {
  it('NI Guided Groups: from £199 · Members from £179', () => {
    expect(GUIDED_GROUPS).toEqual({ standard: 199, member: 179, from: true })
    expect(standardLabel(GUIDED_GROUPS)).toBe('from £199')
    expect(memberLabel(GUIDED_GROUPS)).toBe('Members from £179')
  })

  it('Initial NI Care Review: £249 · Members £225', () => {
    expect(INITIAL_CARE_REVIEW).toEqual({ standard: 249, member: 225, from: false })
    expect(standardLabel(INITIAL_CARE_REVIEW)).toBe('£249')
    expect(memberLabel(INITIAL_CARE_REVIEW)).toBe('Members £225')
  })

  it('Follow-up Review: £125 / Members £110', () => {
    expect(FOLLOW_UP_REVIEW).toEqual({ standard: 125, member: 110, from: false })
    expect(inlinePriceLabel(FOLLOW_UP_REVIEW)).toBe('£125 · members £110')
  })

  it('Focused Check-in: £70 / Members £60', () => {
    expect(FOCUSED_CHECK_IN).toEqual({ standard: 70, member: 60, from: false })
    expect(inlinePriceLabel(FOCUSED_CHECK_IN)).toBe('£70 · members £60')
  })

  it('Specialist Contribution: from £95 / Members from £85', () => {
    expect(SPECIALIST_CONTRIBUTION).toEqual({ standard: 95, member: 85, from: true })
    expect(inlinePriceLabel(SPECIALIST_CONTRIBUTION)).toBe('from £95 · members from £85')
  })

  it('Membership is £19 / month or £190 / year, saving £38, with no selector', () => {
    expect(MEMBERSHIP).toEqual({ monthly: 19, yearly: 190, yearlySaving: 38 })
    expect(MEMBERSHIP_HEADLINE).toBe('£19')
    expect(MEMBERSHIP_YEARLY_NOTE).toBe('or £190 / year — save £38')
    // The saving must be arithmetic, not decoration.
    expect(MEMBERSHIP.monthly * 12 - MEMBERSHIP.yearly).toBe(MEMBERSHIP.yearlySaving)
  })

  it('Family Membership has no price, declared rather than missing', () => {
    expect(FAMILY_MEMBERSHIP_PRICE).toBeNull()
  })

  it('every care price has a lower preferential member price', () => {
    for (const [key, price] of Object.entries(CARE_PRICES)) {
      expect(price.member, key).toBeLessThan(price.standard)
      expect(price.member, key).toBeGreaterThan(0)
      expect(Number.isInteger(price.standard), key).toBe(true)
      expect(Number.isInteger(price.member), key).toBe(true)
    }
  })

  it('the ongoing-support list is the three optional services, in order', () => {
    expect(ONGOING_SUPPORT.map((s) => s.name)).toEqual([
      'Follow-up Review',
      'Focused Check-in',
      'Specialist Contribution',
    ])
    // Each entry must resolve to a real price.
    for (const s of ONGOING_SUPPORT) expect(CARE_PRICES[s.key]).toBeDefined()
  })

  it('the entry points are not in the ongoing-support list', () => {
    // Guided Groups and the Initial Review are where care STARTS. Listing
    // either as "optional ongoing support" would misdescribe the product.
    const keys = ONGOING_SUPPORT.map((s) => s.key)
    expect(keys).not.toContain('guided_groups')
    expect(keys).not.toContain('initial_care_review')
  })

  it('formatPounds is the only place the symbol is spelled', () => {
    expect(formatPounds(249)).toBe('£249')
  })
})

describe('no retired pricing survives in the catalogue', () => {
  const source = readFileSync(join(HERE, 'catalogue.ts'), 'utf8')

  it('names none of the retired tiers or programmes', () => {
    for (const banned of [
      '12-Week', '12-week', 'Fully Supported', 'Seed', 'Growth', 'Flourish',
      'Your Health, Tracked',
    ]) {
      expect(source, banned).not.toContain(banned)
    }
  })

  it('carries none of the retired figures', () => {
    // The retired 19/49/69/119 self-serve ladder. 19 survives legitimately as
    // Membership, so only the three that were withdrawn are checked.
    const live = new Set(Object.values(CARE_PRICES).flatMap((p) => [p.standard, p.member]))
    for (const retired of [49, 69, 119]) expect(live.has(retired)).toBe(false)
  })
})

describe('the preview working-price tag', () => {
  it('is driven by one flag, so it can be switched off without a page edit', () => {
    expect(PRICING_PREVIEW.showWorkingPrices).toBe(true)
    expect(PRICING_PREVIEW.workingPriceLabel).toBe('Working price · preview')
  })
})

describe('PRACTITIONER_TIME_ALLOWANCES — internal, data only', () => {
  const { services, timer, phases } = PRACTITIONER_TIME_ALLOWANCES

  it('holds the four authorised professional-time allowances', () => {
    expect(services.initial_care_review.totalMinutes).toBe(120)
    expect(services.follow_up_review.totalMinutes).toBe(60)
    expect(services.focused_check_in.totalMinutes).toBe(30)
    expect(services.specialist_contribution).toEqual({
      minMinutes: 30, maxMinutes: 60, setBeforeAssignment: true,
    })
  })

  it('only the Specialist Contribution is set before assignment by scope', () => {
    expect(services.specialist_contribution.setBeforeAssignment).toBe(true)
    expect(services.initial_care_review.setBeforeAssignment).toBe(false)
    expect(services.follow_up_review.setBeforeAssignment).toBe(false)
    expect(services.focused_check_in.setBeforeAssignment).toBe(false)
  })

  it('holds the timer thresholds 50 / 58 / 60 / 65 with a 5-minute grace', () => {
    expect(timer.calmNoticeAtMinutes).toBe(50)
    expect(timer.strongNoticeAtMinutes).toBe(58)
    expect(timer.allowanceEndsAtMinutes).toBe(60)
    expect(timer.gracePeriodMinutes).toBe(5)
    expect(timer.exceptionRequiredAtMinutes).toBe(65)
  })

  it('states which allowance the thresholds were specified against', () => {
    // They are NOT generalised to the 120- and 30-minute services, because
    // how they scale has not been decided. Recording the basis stops the next
    // reader assuming 50/58/60 applies to a 120-minute review.
    expect(timer.specifiedForAllowanceMinutes).toBe(60)
    expect(timer.allowanceEndsAtMinutes).toBe(timer.specifiedForAllowanceMinutes)
    expect(timer.exceptionRequiredAtMinutes).toBe(
      timer.allowanceEndsAtMinutes + timer.gracePeriodMinutes,
    )
  })

  it('thresholds are strictly ordered', () => {
    expect(timer.calmNoticeAtMinutes).toBeLessThan(timer.strongNoticeAtMinutes)
    expect(timer.strongNoticeAtMinutes).toBeLessThan(timer.allowanceEndsAtMinutes)
    expect(timer.allowanceEndsAtMinutes).toBeLessThan(timer.exceptionRequiredAtMinutes)
  })

  it('logs time against the eight named phases', () => {
    expect([...phases]).toEqual([
      'preparation', 'consultation', 'protocol_write_up', 'safety_review',
      'signing', 'follow_up', 'coordination', 'other_approved_work',
    ])
  })

  it('is data only — it exposes no function', () => {
    // If this namespace ever gains behaviour it stops being config and
    // becomes an un-reviewed timer. The moratorium applies.
    const walk = (v: unknown): void => {
      expect(typeof v).not.toBe('function')
      if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    walk(PRACTITIONER_TIME_ALLOWANCES)
  })

  it('is NOT re-exported from the public barrel', () => {
    const barrel = readFileSync(join(HERE, 'index.ts'), 'utf8')
    // [\s\S] rather than the s flag: the db package targets below es2018.
    expect(barrel).not.toMatch(/export[\s\S]*\{[^}]*PRACTITIONER_TIME_ALLOWANCES/)
    expect(barrel).not.toMatch(/export\s+\*\s+from/)
  })
})
