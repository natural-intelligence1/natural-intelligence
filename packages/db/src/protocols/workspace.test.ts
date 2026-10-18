// Rules the practitioner workspace renders. The UI is a thin renderer of
// deriveWorkspace, so these are the tests that prove the screen cannot show
// an editable signed Protocol, a client-ready draft, or a sign button to
// someone who may not sign.

import { describe, it, expect } from 'vitest'
import {
  SIGNING_CONFIRMATION, DRAFT_BANNER, SIGN_BLOCKED_MESSAGES,
  deriveWorkspace, reorderItems, applyItemEdit, removeItem, restoreItem,
  addItem, beginRevision, type Viewer,
} from './workspace'
import type { ProtocolVersionItem, ProtocolVersionRef } from './versionItems'

const LEAD_VIEWER: Viewer = { practitionerId: 'prac-1', isLeadForCase: true, isEligible: true }

const ver = (o: Partial<ProtocolVersionRef> & { id: string; version: number }): ProtocolVersionRef =>
  ({ signed_at: null, signed_by: null, supersedes: null, ...o })

const it_ = (o: Partial<ProtocolVersionItem> & { id: string }): ProtocolVersionItem => ({
  protocol_id: 'p1', name: 'Magnesium glycinate', item_type: 'supplement',
  dose: '200mg', timing: 'evening', duration_weeks: 8,
  instructions: 'With the evening meal.', rationale: 'Sleep support.',
  display_order: 0, is_active: true, source_template_item_id: null,
  drafted_source: 'practitioner', drafted_by: null, last_edited_by: null,
  created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z', ...o,
})

const ITEMS = [it_({ id: 'i1', display_order: 0 }), it_({ id: 'i2', display_order: 1, name: 'Evening walk', item_type: 'lifestyle' })]

describe('the signing confirmation is the founder-approved wording', () => {
  it('reads exactly as approved', () => {
    expect(SIGNING_CONFIRMATION).toBe(
      'By signing, I confirm that I have reviewed this Protocol in full, made any changes ' +
      'I consider necessary, and adopt the final Protocol as my own professional work to ' +
      'the same standard as if I had authored it from the outset.')
  })

  it('states adoption as the practitioner\'s own work, not mere approval', () => {
    expect(SIGNING_CONFIRMATION).toMatch(/adopt the final Protocol as my own professional work/)
    expect(SIGNING_CONFIRMATION).toMatch(/as if I had authored it from the outset/)
    expect(SIGNING_CONFIRMATION).not.toMatch(/approve|sign off|generated/i)
  })
})

describe('a draft', () => {
  const draft = ver({ id: 'p1', version: 1 })
  const view = deriveWorkspace(draft, ITEMS, [draft], LEAD_VIEWER)

  it('is editable and labelled as not for client use', () => {
    expect(view.canEdit).toBe(true)
    expect(view.phase).toBe('draft')
    expect(view.stateLabel).toBe(DRAFT_BANNER)
    expect(DRAFT_BANNER).toMatch(/not for client use/i)
  })

  it('is never client-ready and never DailyPath eligible', () => {
    expect(view.isClientReady).toBe(false)
    expect(view.dailyPathEligible).toBe(false)
  })

  it('offers no revise action — there is nothing signed to revise', () => {
    expect(view.canRevise).toBe(false)
  })

  it('can be signed by an eligible Lead with at least one item', () => {
    expect(view.canSign).toBe(true)
    expect(view.signBlockedReason).toBeNull()
  })
})

describe('the sign action is unavailable when the practitioner may not sign', () => {
  const draft = ver({ id: 'p1', version: 1 })

  it('refuses a practitioner who is not the Lead', () => {
    const v = deriveWorkspace(draft, ITEMS, [draft], { ...LEAD_VIEWER, isLeadForCase: false })
    expect(v.canSign).toBe(false)
    expect(v.signBlockedReason).toBe('not_lead')
    expect(v.signBlockedMessage).toBe(SIGN_BLOCKED_MESSAGES.not_lead)
  })

  it('refuses an ineligible Lead', () => {
    const v = deriveWorkspace(draft, ITEMS, [draft], { ...LEAD_VIEWER, isEligible: false })
    expect(v.canSign).toBe(false)
    expect(v.signBlockedReason).toBe('not_eligible')
  })

  it('refuses an empty Protocol', () => {
    const v = deriveWorkspace(draft, [], [draft], LEAD_VIEWER)
    expect(v.canSign).toBe(false)
    expect(v.signBlockedReason).toBe('no_items')
  })

  it('refuses while any item is incomplete', () => {
    const v = deriveWorkspace(draft, ITEMS, [draft], LEAD_VIEWER, { invalidItemIds: ['i1'] })
    expect(v.canSign).toBe(false)
    expect(v.signBlockedReason).toBe('unsaved_invalid_items')
  })

  it('refuses a Protocol whose only items have been removed', () => {
    const v = deriveWorkspace(draft, ITEMS.map((i) => ({ ...i, is_active: false })), [draft], LEAD_VIEWER)
    expect(v.signBlockedReason).toBe('no_items')
  })
})

describe('a signed version', () => {
  const signed = ver({ id: 'p1', version: 2, signed_at: '2026-10-18T09:00:00Z', signed_by: 'prac-1' })
  const view = deriveWorkspace(signed, ITEMS, [signed], LEAD_VIEWER)

  it('is read-only: no edit controls, no sign action', () => {
    expect(view.canEdit).toBe(false)
    expect(view.canSign).toBe(false)
    expect(view.signBlockedReason).toBe('already_signed')
  })

  it('shows version and current state unmistakably', () => {
    expect(view.phase).toBe('signed')
    expect(view.stateLabel).toBe('Signed · v2 · Current')
  })

  it('is client-ready and DailyPath eligible', () => {
    expect(view.isClientReady).toBe(true)
    expect(view.dailyPathEligible).toBe(true)
  })

  it('offers revision as the only way forward', () => {
    expect(view.canRevise).toBe(true)
  })
})

describe('a superseded signed version', () => {
  const v2 = ver({ id: 'p2', version: 2, signed_at: 'x', signed_by: 'prac-1' })
  const v3 = ver({ id: 'p3', version: 3, signed_at: 'y', signed_by: 'prac-1', supersedes: 'p2' })
  const view = deriveWorkspace(v2, ITEMS, [v2, v3], LEAD_VIEWER)

  it('is labelled superseded, not current', () => {
    expect(view.isSuperseded).toBe(true)
    expect(view.stateLabel).toBe('Signed · v2 · Superseded')
  })

  it('stops being client-ready and DailyPath eligible', () => {
    expect(view.isClientReady).toBe(false)
    expect(view.dailyPathEligible).toBe(false)
  })
})

describe('an unsigned revision does not displace the signed version it will replace', () => {
  const v2 = ver({ id: 'p2', version: 2, signed_at: 'x', signed_by: 'prac-1' })
  const v3draft = ver({ id: 'p3', version: 3, supersedes: 'p2' })

  it('the signed v2 stays current while v3 is only a draft', () => {
    const view2 = deriveWorkspace(v2, ITEMS, [v2, v3draft], LEAD_VIEWER)
    expect(view2.isSuperseded).toBe(false)
    expect(view2.stateLabel).toBe('Signed · v2 · Current')
    expect(view2.isClientReady).toBe(true)
  })

  it('and the v3 draft is neither client-ready nor DailyPath eligible', () => {
    const view3 = deriveWorkspace(v3draft, ITEMS, [v2, v3draft], LEAD_VIEWER)
    expect(view3.isClientReady).toBe(false)
    expect(view3.dailyPathEligible).toBe(false)
    expect(view3.stateLabel).toBe(DRAFT_BANNER)
  })
})

describe('provenance keeps draft origin and professional ownership apart', () => {
  const mixed = [
    it_({ id: 'i1', drafted_source: 'ai_assisted', drafted_by: 'u-ni', last_edited_by: 'prac-1' }),
    it_({ id: 'i2', drafted_source: 'student', drafted_by: 'u-student', last_edited_by: 'prac-1' }),
    it_({ id: 'i3', drafted_source: 'practitioner', drafted_by: 'prac-1', last_edited_by: 'prac-1' }),
  ]
  const signed = ver({ id: 'p1', version: 2, signed_at: '2026-10-18T09:00:00Z', signed_by: 'prac-1' })
  const p = deriveWorkspace(signed, mixed, [signed], LEAD_VIEWER).provenance

  it('records every drafting origin present', () => {
    expect(p.draftOrigins.sort()).toEqual(['ai_assisted', 'practitioner', 'student'])
  })

  it('records original contributors separately from the signer', () => {
    expect(p.originalContributors.sort()).toEqual(['prac-1', 'u-ni', 'u-student'])
    expect(p.signedBy).toBe('prac-1')
    expect(p.signedAt).toBe('2026-10-18T09:00:00Z')
  })

  it('exposes origin and signature as distinct fields, so neither can describe the other', () => {
    expect(p).toHaveProperty('draftOrigins')
    expect(p).toHaveProperty('signedBy')
    expect(Object.keys(p)).not.toContain('generatedByApprovedBy')
  })
})

describe('draft editing operations', () => {
  it('reorders and renumbers so display_order stays contiguous', () => {
    const moved = reorderItems(ITEMS, 'i2', 'up')
    expect(moved.map((i) => i.id)).toEqual(['i2', 'i1'])
    expect(moved.map((i) => i.display_order)).toEqual([0, 1])
  })

  it('ignores a move beyond either end', () => {
    expect(reorderItems(ITEMS, 'i1', 'up').map((i) => i.id)).toEqual(['i1', 'i2'])
    expect(reorderItems(ITEMS, 'i2', 'down').map((i) => i.id)).toEqual(['i1', 'i2'])
  })

  it('records the editor on every edit', () => {
    const edited = applyItemEdit(ITEMS, 'i1', { dose: '400mg' }, 'prac-1')
    expect(edited[0]).toMatchObject({ dose: '400mg', last_edited_by: 'prac-1' })
  })

  it('removes by deactivating, so the decision is kept', () => {
    const after = removeItem(ITEMS, 'i1', 'prac-1')
    expect(after.find((i) => i.id === 'i1')).toMatchObject({ is_active: false })
    expect(after).toHaveLength(2)
    expect(restoreItem(after, 'i1', 'prac-1').find((i) => i.id === 'i1')).toMatchObject({ is_active: true })
  })

  it('adds a new item attributed to the practitioner who wrote it', () => {
    const after = addItem(ITEMS, 'p1', 'prac-1', { name: 'Vitamin D3' })
    expect(after).toHaveLength(3)
    expect(after[2]).toMatchObject({
      name: 'Vitamin D3', drafted_source: 'practitioner', drafted_by: 'prac-1', display_order: 2, is_active: true,
    })
  })
})

describe('revision produces the next editable draft', () => {
  const signed = ver({ id: 'p2', version: 2, signed_at: 'x', signed_by: 'prac-1', member_id: 'm1', case_id: 'c1' })
  const withRemoved = [...ITEMS, it_({ id: 'i3', is_active: false, name: 'Dropped' })]
  const { draft, items } = beginRevision(signed, withRemoved, 'prac-1')

  it('is unsigned, one version higher, and supersedes its predecessor', () => {
    expect(draft).toMatchObject({ version: 3, signed_at: null, signed_by: null, supersedes: 'p2' })
  })

  it('carries forward only the items that remained active', () => {
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.name)).not.toContain('Dropped')
  })

  it('gives the copies new identities so the signed originals are untouched', () => {
    expect(items.every((i) => i.protocol_id === draft.id)).toBe(true)
    expect(items.map((i) => i.id)).not.toContain('i1')
  })

  it('leaves the predecessor exactly as it was', () => {
    expect(signed).toMatchObject({ id: 'p2', version: 2, signed_at: 'x', signed_by: 'prac-1' })
    expect(withRemoved[0]).toMatchObject({ id: 'i1', protocol_id: 'p1' })
  })

  it('and the new draft is editable again', () => {
    const view = deriveWorkspace(draft, items, [signed, draft], LEAD_VIEWER)
    expect(view.canEdit).toBe(true)
    expect(view.phase).toBe('draft')
    expect(view.isClientReady).toBe(false)
  })
})
