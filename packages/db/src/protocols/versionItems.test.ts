// Pure rules for Protocol version items. No database: these prove the
// decisions the application makes before it ever reaches one. The database
// enforcement of the same rules is proven in protocolVersionItems.live.test.ts.

import { describe, it, expect } from 'vitest'
import {
  DRAFTING_SOURCES, ITEM_TYPES, ITEM_VALIDATION_MESSAGES,
  validateItemInput, isEditable, isDailyPathEligible, selectDailyPathSource,
  assertUsableAsClientProtocol, assertEditable, copyItemsForward,
  ProtocolNotSignedError, ProtocolSignedError,
  type ProtocolVersionRef, type ProtocolVersionItem,
} from './versionItems'

const version = (over: Partial<ProtocolVersionRef> & { id: string; version: number }): ProtocolVersionRef => ({
  signed_at: null, signed_by: null, supersedes: null, ...over,
})

const item = (over: Partial<ProtocolVersionItem> & { id: string }): ProtocolVersionItem => ({
  protocol_id: 'p1', name: 'Magnesium glycinate', item_type: 'supplement',
  dose: '200mg', timing: 'evening', duration_weeks: 8,
  instructions: 'With the evening meal.', rationale: 'Sleep quality support.',
  display_order: 0, is_active: true,
  source_template_item_id: null, drafted_source: 'practitioner',
  drafted_by: null, last_edited_by: null,
  created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z',
  ...over,
})

describe('the model names the provenance NI actually has', () => {
  it('covers every drafting origin the founder rule distinguishes', () => {
    expect(DRAFTING_SOURCES).toEqual(['ni_tooling', 'ai_assisted', 'student', 'practitioner', 'template'])
  })

  it('item types match the live protocol_items check constraint', () => {
    expect(ITEM_TYPES).toEqual(['supplement', 'lifestyle', 'nutrition', 'test', 'practitioner'])
  })
})

describe('validation of practitioner-authored content', () => {
  it('accepts a complete item', () => {
    expect(validateItemInput({ name: 'Vitamin D3', item_type: 'supplement', duration_weeks: 12 })).toEqual([])
  })

  it('rejects a blank or whitespace-only name', () => {
    expect(validateItemInput({ name: '', item_type: 'supplement' })).toContain(ITEM_VALIDATION_MESSAGES.name_blank)
    expect(validateItemInput({ name: '   ', item_type: 'supplement' })).toContain(ITEM_VALIDATION_MESSAGES.name_blank)
  })

  it('rejects an unknown item type', () => {
    expect(validateItemInput({ name: 'X', item_type: 'medication' as never }))
      .toContain(ITEM_VALIDATION_MESSAGES.item_type_unknown)
  })

  it('rejects a non-positive or fractional duration but allows none at all', () => {
    expect(validateItemInput({ name: 'X', item_type: 'test', duration_weeks: 0 }))
      .toContain(ITEM_VALIDATION_MESSAGES.duration_not_positive)
    expect(validateItemInput({ name: 'X', item_type: 'test', duration_weeks: -4 }))
      .toContain(ITEM_VALIDATION_MESSAGES.duration_not_positive)
    expect(validateItemInput({ name: 'X', item_type: 'test', duration_weeks: 2.5 }))
      .toContain(ITEM_VALIDATION_MESSAGES.duration_not_positive)
    expect(validateItemInput({ name: 'X', item_type: 'test', duration_weeks: null })).toEqual([])
  })

  it('reports every problem at once, not just the first', () => {
    expect(validateItemInput({ name: '', item_type: 'nope' as never, duration_weeks: 0 })).toHaveLength(3)
  })
})

describe('editability follows the signature, nothing else', () => {
  it('an unsigned draft is editable', () => {
    expect(isEditable(version({ id: 'p1', version: 1 }))).toBe(true)
  })

  it('a signed version is not, and says why', () => {
    const signed = version({ id: 'p1', version: 2, signed_at: '2026-10-18T09:00:00Z', signed_by: 'prac-1' })
    expect(isEditable(signed)).toBe(false)
    expect(() => assertEditable(signed)).toThrow(ProtocolSignedError)
    expect(() => assertEditable(signed)).toThrow(/revise it to create the next draft/i)
  })
})

describe('DailyPath may only ever read a current signed version', () => {
  it('refuses an unsigned draft whatever drafted it', () => {
    expect(isDailyPathEligible(version({ id: 'p1', version: 1 }))).toBe(false)
  })

  it('accepts a signed version nothing supersedes', () => {
    const v1 = version({ id: 'p1', version: 1, signed_at: '2026-10-11T00:00:00Z', signed_by: 'prac-1' })
    expect(isDailyPathEligible(v1, [v1])).toBe(true)
  })

  it('refuses a signed version that a later version supersedes', () => {
    const v1 = version({ id: 'p1', version: 1, signed_at: '2026-10-11T00:00:00Z', signed_by: 'prac-1' })
    const v2 = version({ id: 'p2', version: 2, signed_at: '2026-10-18T00:00:00Z', signed_by: 'prac-1', supersedes: 'p1' })
    expect(isDailyPathEligible(v1, [v1, v2])).toBe(false)
    expect(isDailyPathEligible(v2, [v1, v2])).toBe(true)
  })

  it('a draft revision does NOT displace the signed version it will replace', () => {
    const v2 = version({ id: 'p2', version: 2, signed_at: '2026-10-18T00:00:00Z', signed_by: 'prac-1' })
    const v3draft = version({ id: 'p3', version: 3, supersedes: 'p2' })
    // The dangerous case. v3 points at v2 from the moment the practitioner
    // starts revising, but it is unsigned. If that counted as superseding,
    // the client would lose their current plan the instant editing began.
    expect(isDailyPathEligible(v3draft, [v2, v3draft])).toBe(false) // the draft is not usable
    expect(isDailyPathEligible(v2, [v2, v3draft])).toBe(true)       // ...and v2 stays in force
    expect(selectDailyPathSource([v2, v3draft])?.id).toBe('p2')
  })

  it('only a SIGNED successor displaces the version it supersedes', () => {
    const v2 = version({ id: 'p2', version: 2, signed_at: 'x', signed_by: 'prac-1' })
    const v3signed = version({ id: 'p3', version: 3, signed_at: 'y', signed_by: 'prac-1', supersedes: 'p2' })
    expect(isDailyPathEligible(v2, [v2, v3signed])).toBe(false)
    expect(selectDailyPathSource([v2, v3signed])?.id).toBe('p3')
  })

  it('returns null when the member has no signed Protocol at all', () => {
    expect(selectDailyPathSource([version({ id: 'p1', version: 1 })])).toBeNull()
    expect(selectDailyPathSource([])).toBeNull()
  })

  it('picks the highest signed version in a chain', () => {
    const v1 = version({ id: 'p1', version: 1, signed_at: 'x', signed_by: 'prac-1' })
    const v2 = version({ id: 'p2', version: 2, signed_at: 'y', signed_by: 'prac-1', supersedes: 'p1' })
    expect(selectDailyPathSource([v1, v2])?.id).toBe('p2')
  })
})

describe('the client boundary refuses before any content is returned', () => {
  it('throws for an unsigned draft, naming the reason', () => {
    const draft = version({ id: 'p1', version: 1 })
    expect(() => assertUsableAsClientProtocol(draft, [draft])).toThrow(ProtocolNotSignedError)
    expect(() => assertUsableAsClientProtocol(draft, [draft])).toThrow(/no clinical status/i)
  })

  it('throws for a superseded signed version', () => {
    const v1 = version({ id: 'p1', version: 1, signed_at: 'x', signed_by: 'prac-1' })
    const v2 = version({ id: 'p2', version: 2, signed_at: 'y', signed_by: 'prac-1', supersedes: 'p1' })
    expect(() => assertUsableAsClientProtocol(v1, [v1, v2])).toThrow(/superseded/i)
  })

  it('permits the current signed version', () => {
    const v1 = version({ id: 'p1', version: 1, signed_at: 'x', signed_by: 'prac-1' })
    expect(() => assertUsableAsClientProtocol(v1, [v1])).not.toThrow()
  })
})

describe('revision copies content forward without flattening its history', () => {
  const items = [
    item({ id: 'i1', display_order: 0, drafted_source: 'ai_assisted', drafted_by: 'u-ai', source_template_item_id: 't1' }),
    item({ id: 'i2', display_order: 1, drafted_source: 'student', drafted_by: 'u-student', name: 'Magnesium walk' }),
    item({ id: 'i3', display_order: 2, is_active: false, name: 'Removed by practitioner' }),
  ]

  it('carries every clinically substantive field', () => {
    const [first] = copyItemsForward(items, 'p-new', 'u-prac')
    expect(first).toMatchObject({
      protocol_id: 'p-new', name: 'Magnesium glycinate', item_type: 'supplement',
      dose: '200mg', timing: 'evening', duration_weeks: 8,
      instructions: 'With the evening meal.', rationale: 'Sleep quality support.',
      display_order: 0, is_active: true,
    })
  })

  it('preserves original drafting provenance rather than reattributing it', () => {
    const copied = copyItemsForward(items, 'p-new', 'u-prac')
    expect(copied[0]).toMatchObject({ drafted_source: 'ai_assisted', drafted_by: 'u-ai', source_template_item_id: 't1' })
    expect(copied[1]).toMatchObject({ drafted_source: 'student', drafted_by: 'u-student' })
  })

  it('records who performed the revision as the latest editor', () => {
    expect(copyItemsForward(items, 'p-new', 'u-prac').every((i) => i.last_edited_by === 'u-prac')).toBe(true)
  })

  it('does not carry forward items the practitioner removed', () => {
    const copied = copyItemsForward(items, 'p-new', 'u-prac')
    expect(copied).toHaveLength(2)
    expect(copied.map((i) => i.name)).not.toContain('Removed by practitioner')
  })

  it('produces rows with no id, so they are new records and not edits of signed ones', () => {
    for (const row of copyItemsForward(items, 'p-new', 'u-prac')) {
      expect(row).not.toHaveProperty('id')
      expect(row).not.toHaveProperty('created_at')
    }
  })
})
