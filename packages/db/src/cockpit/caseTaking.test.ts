import { describe, it, expect } from 'vitest'
import {
  CASE_ROLES, CASE_TAKING_STATES, CASE_TAKING_STATE_LABELS,
  isCaseRole, isEditable, isLead, roleLabel,
  completionOffer, newCaseTakingRecord,
  submitToLead, beginLeadReview, markReadyForSignOff, signOff, amendAfterSignOff,
  applyCompletion,
  type CaseTakingActor, type CaseTakingRecord, type CaseTakingState,
} from './caseTaking'
import type { CaseTakingActorIdentity as CaptureActor } from './caseTakingActor'

const AT = '2026-11-04T10:00:00.000Z'
const LATER = '2026-11-04T11:00:00.000Z'

const prac = (id: string, name: string, role: CaptureActor['role'] = 'practitioner'): CaptureActor =>
  ({ id, displayName: name, role, ...(role === 'student' ? { supervisorId: 'sup-1' } : {}) })

const LEAD: CaseTakingActor      = { actor: prac('p-lead', 'Amara Okafor'), caseRole: 'lead' }
const MEMBER: CaseTakingActor    = { actor: prac('p-care', 'Elin Marsh'), caseRole: 'care_team' }
const SUPERVISED: CaseTakingActor = { actor: prac('p-stu', 'T. Reyes', 'student'), caseRole: 'student' }

const at = (record: CaseTakingRecord, actor: CaseTakingActor, captured = 3, open = 0) =>
  ({ record, actor, at: AT, capturedAnswers: captured, openSafetyReviews: open })

// ─── Vocabulary ──────────────────────────────────────────────────────────────

describe('the case-role vocabulary', () => {
  it('is case_team_roles.team_role and nothing else', () => {
    expect([...CASE_ROLES]).toEqual(['lead', 'care_team', 'student'])
  })

  it('rejects client_practitioner_links.role values, including its own "lead"', () => {
    // 0064's ruling: the shared word does not make the concepts equivalent.
    // A link role must never arrive here as if it were case authority.
    expect(isCaseRole('specialist')).toBe(false)
    expect(isCaseRole('reviewer')).toBe(false)
    expect(isCaseRole('temporary')).toBe(false)
    // 'lead' is accepted as a STRING because the case vocabulary also has a
    // 'lead' — which is exactly why the caller must pass a team_role, not a
    // link role. The type system is the boundary; this asserts the set.
    expect(isCaseRole('lead')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isCaseRole('')).toBe(false)
    expect(isCaseRole('admin')).toBe(false)
    expect(isCaseRole('LEAD')).toBe(false)
  })
})

describe('how a practitioner is presented', () => {
  it('presents a supervised practitioner as a practitioner, qualified — not as a student mode', () => {
    expect(roleLabel(SUPERVISED)).toBe('Practitioner · Supervised')
    expect(roleLabel(SUPERVISED)).not.toMatch(/student/i)
    expect(roleLabel(SUPERVISED)).not.toMatch(/mode/i)
  })

  it('names the Lead, and leaves an ordinary team member plain', () => {
    expect(roleLabel(LEAD)).toBe('Practitioner · Lead')
    expect(roleLabel(MEMBER)).toBe('Practitioner')
  })

  it('knows who the Lead is', () => {
    expect(isLead(LEAD)).toBe(true)
    expect(isLead(MEMBER)).toBe(false)
    expect(isLead(SUPERVISED)).toBe(false)
  })
})

// ─── Editability ─────────────────────────────────────────────────────────────

describe('editable until sign-off, immutable after', () => {
  it('is editable in every state but signed off', () => {
    for (const s of CASE_TAKING_STATES) {
      expect(isEditable(s)).toBe(s !== 'signed_off')
    }
  })

  it('labels every state', () => {
    for (const s of CASE_TAKING_STATES) {
      expect(CASE_TAKING_STATE_LABELS[s]).toBeTruthy()
    }
  })
})

// ─── The one meaningful action ───────────────────────────────────────────────

describe('what the practitioner is offered', () => {
  it('offers a non-Lead exactly one action: submit to Lead', () => {
    const offer = completionOffer(MEMBER, 'in_progress', 0)
    expect(offer.action).toBe('submit_to_lead')
    expect(offer.label).toBe('Submit to Lead')
    expect(offer.blockedReason).toBeNull()
  })

  it('offers a supervised practitioner the SAME action — the difference is sign-off, not capture', () => {
    expect(completionOffer(SUPERVISED, 'in_progress', 0)).toEqual(
      completionOffer(MEMBER, 'in_progress', 0),
    )
  })

  it('offers the Lead "Ready for sign-off" while they are still taking the case', () => {
    const offer = completionOffer(LEAD, 'in_progress', 0)
    expect(offer.action).toBe('mark_ready_for_sign_off')
    expect(offer.label).toBe('Ready for sign-off')
  })

  it('offers the Lead "Sign off" once it is ready or submitted', () => {
    for (const s of ['submitted_to_lead', 'lead_review', 'ready_for_sign_off'] as CaseTakingState[]) {
      expect(completionOffer(LEAD, s, 0).action).toBe('sign_off')
    }
  })

  it('tells a non-Lead why they cannot act, instead of hiding the button', () => {
    const offer = completionOffer(MEMBER, 'lead_review', 0)
    expect(offer.action).toBe('none')
    expect(offer.blockedReason).toContain('Lead')
    // And says what they CAN still do.
    expect(offer.blockedReason).toMatch(/still add/i)
  })

  it('offers only the Lead an amendment after sign-off', () => {
    expect(completionOffer(LEAD, 'signed_off', 0).action).toBe('amend')
    expect(completionOffer(MEMBER, 'signed_off', 0).action).toBe('none')
    expect(completionOffer(SUPERVISED, 'signed_off', 0).action).toBe('none')
  })
})

describe('state-aware wording', () => {
  it('says plainly that a review remains open, rather than claiming completeness', () => {
    // The specific failure this guards: a primary action that reads as "all
    // done" while a red flag is unresolved.
    expect(completionOffer(MEMBER, 'in_progress', 2).label).toBe('Submit to Lead · review remains open')
    expect(completionOffer(LEAD, 'in_progress', 1).label).toBe('Ready for sign-off · review remains open')
    expect(completionOffer(LEAD, 'ready_for_sign_off', 1).label).toBe('Sign off · review remains open')
  })

  it('drops the qualifier when nothing is open', () => {
    expect(completionOffer(LEAD, 'ready_for_sign_off', 0).label).toBe('Sign off')
  })

  it('never BLOCKS on an open review — it changes the words, not the permission', () => {
    const blocked = completionOffer(LEAD, 'ready_for_sign_off', 5)
    expect(blocked.action).toBe('sign_off')
    expect(blocked.blockedReason).toBeNull()
    expect(blocked.leavesReviewOpen).toBe(true)
  })
})

// ─── Transitions ─────────────────────────────────────────────────────────────

describe('a non-Lead submitting to the Lead', () => {
  it('moves to submitted, attributed and dated', () => {
    const r = submitToLead(at(newCaseTakingRecord('c1'), MEMBER))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.record.state).toBe('submitted_to_lead')
    expect(r.record.submittedBy).toBe('p-care')
    expect(r.record.submittedAt).toBe(AT)
  })

  it('is available to a supervised practitioner', () => {
    const r = submitToLead(at(newCaseTakingRecord('c1'), SUPERVISED))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.record.history[0]!.caseRole).toBe('student')
  })

  it('refuses when nothing has been captured', () => {
    const r = submitToLead(at(newCaseTakingRecord('c1'), MEMBER, 0))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('nothing_captured')
  })

  it('refuses from the Lead — the Lead does not submit to themselves', () => {
    const r = submitToLead(at(newCaseTakingRecord('c1'), LEAD))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('wrong_state')
  })

  it('refuses twice', () => {
    const first = submitToLead(at(newCaseTakingRecord('c1'), MEMBER))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = submitToLead(at(first.record, MEMBER))
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe('wrong_state')
  })

  it('records the open-review count at the moment of handover', () => {
    const r = submitToLead(at(newCaseTakingRecord('c1'), MEMBER, 3, 2))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.record.history[0]!.openSafetyReviews).toBe(2)
  })
})

describe('only the Lead may sign off', () => {
  function readyByLead(): CaseTakingRecord {
    const r = markReadyForSignOff(at(newCaseTakingRecord('c1'), LEAD))
    if (!r.ok) throw new Error('setup failed')
    return r.record
  }

  it('refuses an ordinary team member', () => {
    const r = signOff({ ...at(readyByLead(), MEMBER), signedBy: 'p-care' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('not_the_lead')
  })

  it('refuses a supervised practitioner', () => {
    const r = signOff({ ...at(readyByLead(), SUPERVISED), signedBy: 'p-stu' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('not_the_lead')
  })

  it('refuses an unattributed signature', () => {
    const r = signOff({ ...at(readyByLead(), LEAD), signedBy: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('signer_not_attributed')
  })

  it('refuses a signature attributed to someone other than the actor', () => {
    const r = signOff({ ...at(readyByLead(), LEAD), signedBy: 'p-care' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('signer_not_attributed')
  })

  it('refuses straight out of in-progress — signing is not a side effect of typing', () => {
    const r = signOff({ ...at(newCaseTakingRecord('c1'), LEAD), signedBy: 'p-lead' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('wrong_state')
  })

  it('succeeds for the Lead from ready, and stamps who and when', () => {
    const r = signOff({ ...at(readyByLead(), LEAD), at: LATER, signedBy: 'p-lead' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.record.state).toBe('signed_off')
    expect(r.record.signedOffBy).toBe('p-lead')
    expect(r.record.signedOffAt).toBe(LATER)
    expect(isEditable(r.record.state)).toBe(false)
  })

  it('refuses a second sign-off', () => {
    const first = signOff({ ...at(readyByLead(), LEAD), signedBy: 'p-lead' })
    if (!first.ok) throw new Error('setup')
    const again = signOff({ ...at(first.record, LEAD), signedBy: 'p-lead' })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.code).toBe('already_signed_off')
  })
})

describe('the Lead review step', () => {
  it('is recorded, so "did the Lead look at this" is answerable', () => {
    const submitted = submitToLead(at(newCaseTakingRecord('c1'), MEMBER))
    if (!submitted.ok) throw new Error('setup')
    const reviewed = beginLeadReview(at(submitted.record, LEAD))
    expect(reviewed.ok).toBe(true)
    if (!reviewed.ok) return
    expect(reviewed.record.state).toBe('lead_review')
    expect(reviewed.record.history.map((h) => h.to)).toEqual(['submitted_to_lead', 'lead_review'])
  })

  it('is refused to anyone but the Lead', () => {
    const submitted = submitToLead(at(newCaseTakingRecord('c1'), MEMBER))
    if (!submitted.ok) throw new Error('setup')
    const r = beginLeadReview(at(submitted.record, MEMBER))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('not_the_lead')
  })
})

describe('amending after sign-off', () => {
  function signed(): CaseTakingRecord {
    const ready = markReadyForSignOff(at(newCaseTakingRecord('c1'), LEAD))
    if (!ready.ok) throw new Error('setup')
    const done = signOff({ ...at(ready.record, LEAD), signedBy: 'p-lead' })
    if (!done.ok) throw new Error('setup')
    return done.record
  }

  it('is a new revision, not an overwrite', () => {
    const before = signed()
    expect(before.revision).toBe(1)
    const r = amendAfterSignOff(at(before, LEAD))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.record.revision).toBe(2)
    expect(r.record.state).toBe('in_progress')
  })

  it('does not carry the old signature forward — the new version needs its own', () => {
    const r = amendAfterSignOff(at(signed(), LEAD))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.record.signedOffBy).toBeNull()
    expect(r.record.signedOffAt).toBeNull()
  })

  it('keeps the whole history — nothing is deleted', () => {
    const r = amendAfterSignOff(at(signed(), LEAD))
    if (!r.ok) throw new Error('unexpected')
    expect(r.record.history.map((h) => h.to)).toEqual(['ready_for_sign_off', 'signed_off', 'in_progress'])
  })

  it('is refused to a non-Lead', () => {
    for (const actor of [MEMBER, SUPERVISED]) {
      const r = amendAfterSignOff(at(signed(), actor))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('not_the_lead')
    }
  })

  it('is refused before sign-off', () => {
    const r = amendAfterSignOff(at(newCaseTakingRecord('c1'), LEAD))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('wrong_state')
  })
})

// ─── The two end-to-end paths the Founder specified ──────────────────────────

describe('the full non-Lead path', () => {
  it('IN PROGRESS → SUBMITTED TO LEAD → LEAD REVIEW → SIGNED OFF', () => {
    let record = newCaseTakingRecord('c1')
    expect(record.state).toBe('in_progress')

    const submitted = submitToLead(at(record, MEMBER))
    if (!submitted.ok) throw new Error('submit failed')
    record = submitted.record
    expect(record.state).toBe('submitted_to_lead')

    const reviewing = beginLeadReview(at(record, LEAD))
    if (!reviewing.ok) throw new Error('review failed')
    record = reviewing.record
    expect(record.state).toBe('lead_review')

    const done = signOff({ ...at(record, LEAD), signedBy: 'p-lead' })
    if (!done.ok) throw new Error('sign-off failed')
    record = done.record
    expect(record.state).toBe('signed_off')
    expect(isEditable(record.state)).toBe(false)
  })
})

describe('the full Lead path', () => {
  it('IN PROGRESS → READY FOR SIGN-OFF → SIGNED OFF, with no intermediate state invented', () => {
    let record = newCaseTakingRecord('c1')

    const ready = markReadyForSignOff(at(record, LEAD))
    if (!ready.ok) throw new Error('ready failed')
    record = ready.record
    expect(record.state).toBe('ready_for_sign_off')

    const done = signOff({ ...at(record, LEAD), signedBy: 'p-lead' })
    if (!done.ok) throw new Error('sign-off failed')
    record = done.record
    expect(record.state).toBe('signed_off')

    // Two transitions, not four. The Lead never passes through
    // "submitted to Lead" or "Lead review" for their own case-taking.
    expect(record.history).toHaveLength(2)
    expect(record.history.map((h) => h.to)).toEqual(['ready_for_sign_off', 'signed_off'])
  })
})

describe('applyCompletion drives whatever the offer named', () => {
  it('carries out the offered action for each actor', () => {
    const record = newCaseTakingRecord('c1')

    const memberOffer = completionOffer(MEMBER, record.state, 0)
    const memberResult = applyCompletion(memberOffer.action, at(record, MEMBER))
    expect(memberResult.ok).toBe(true)
    if (memberResult.ok) expect(memberResult.record.state).toBe('submitted_to_lead')

    const leadOffer = completionOffer(LEAD, record.state, 0)
    const leadResult = applyCompletion(leadOffer.action, at(record, LEAD))
    expect(leadResult.ok).toBe(true)
    if (leadResult.ok) expect(leadResult.record.state).toBe('ready_for_sign_off')
  })

  it('refuses the no-op action rather than silently succeeding', () => {
    const r = applyCompletion('none', at(newCaseTakingRecord('c1'), MEMBER))
    expect(r.ok).toBe(false)
  })

  it('defaults the signature to the acting practitioner', () => {
    const ready = markReadyForSignOff(at(newCaseTakingRecord('c1'), LEAD))
    if (!ready.ok) throw new Error('setup')
    const r = applyCompletion('sign_off', at(ready.record, LEAD))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.record.signedOffBy).toBe('p-lead')
  })
})

describe('history is append-only', () => {
  it('every transition is attributed, dated and keeps its from/to', () => {
    const submitted = submitToLead(at(newCaseTakingRecord('c1'), MEMBER))
    if (!submitted.ok) throw new Error('setup')
    const [event] = submitted.record.history
    expect(event).toMatchObject({
      at: AT,
      action: 'submit_to_lead',
      from: 'in_progress',
      to: 'submitted_to_lead',
      actorId: 'p-care',
      actorDisplayName: 'Elin Marsh',
      caseRole: 'care_team',
    })
  })

  it('never shortens', () => {
    let record = newCaseTakingRecord('c1')
    const steps: number[] = []
    const s1 = submitToLead(at(record, MEMBER)); if (!s1.ok) throw new Error('x')
    record = s1.record; steps.push(record.history.length)
    const s2 = beginLeadReview(at(record, LEAD)); if (!s2.ok) throw new Error('x')
    record = s2.record; steps.push(record.history.length)
    const s3 = signOff({ ...at(record, LEAD), signedBy: 'p-lead' }); if (!s3.ok) throw new Error('x')
    record = s3.record; steps.push(record.history.length)
    expect(steps).toEqual([1, 2, 3])
  })
})
