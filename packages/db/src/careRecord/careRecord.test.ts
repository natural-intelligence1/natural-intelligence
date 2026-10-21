// The shared care record contract, and the plan rule both apps must agree on.
// Pure — no database, no network.

import { describe, it, expect } from 'vitest'
import {
  CARE_RECORD_FLOWS, SHARED_IDENTIFIERS, flowById, summariseContract,
  isSigned, isCurrentPlan, selectCurrentPlan, supersededPlans, draftVersions, planState,
  CASE_EVENT_VISIBILITY_DRIFT,
  type ProtocolVersionRow,
} from './index'

const v = (o: Partial<ProtocolVersionRow> & { id: string; version: number }): ProtocolVersionRow =>
  ({ signed_at: null, signed_by: null, supersedes: null, ...o })

const signed = (id: string, version: number, supersedes: string | null = null): ProtocolVersionRow =>
  v({ id, version, supersedes, signed_at: '2026-10-18T09:00:00Z', signed_by: 'prac-1' })

describe('the contract names one source of truth per flow', () => {
  it('every flow has a source of truth, a shared identifier and an invariant', () => {
    for (const f of CARE_RECORD_FLOWS) {
      expect(f.sourceOfTruth.trim().length).toBeGreaterThan(0)
      expect(Object.keys(SHARED_IDENTIFIERS)).toContain(f.via)
      expect(f.invariant.trim().length).toBeGreaterThan(0)
    }
  })

  it('every flow id is unique', () => {
    const ids = CARE_RECORD_FLOWS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('anything not wired explains what is missing', () => {
    // A contract that claims more than the code does is worse than none.
    for (const f of CARE_RECORD_FLOWS) {
      if (f.status !== 'wired') expect(f.gap?.trim().length ?? 0).toBeGreaterThan(0)
    }
  })

  it('covers every flow the wiring brief named', () => {
    for (const id of [
      'client_answer_to_case_record',
      'practitioner_clarification_preserves_client_answer',
      'synopsis_as_shared_longitudinal_record',
      'signed_protocol_to_client_plan',
      'signed_protocol_action_to_today',
      'client_update_to_since_last_review',
      'case_team_to_both_views',
      'safety_state_to_review_workflow',
    ]) expect(flowById(id)).toBeDefined()
  })

  it('records honestly how little is wired today', () => {
    // POSITION TEST. Designed to fail as flows get wired, so closing a gap
    // forces an explicit acknowledgement here rather than drifting.
    //
    // Updated when Flow 1 (case team -> both views) was wired through
    // caseTeamView.ts: 1 -> 2 wired, 7 -> 6 domain-ready.
    //
    // NOT updated when the client-update read path was built over case_events:
    // the practitioner end reads the real source, but a client still cannot
    // write one, so the flow is half a flow and the count stays 2.
    const s = summariseContract()
    expect(s.flows).toBe(8)
    expect(s.wired).toBe(2)
    expect(s.domainReadyNotWired).toBe(6)
    expect(s.blockedOnProtocolIntegration).toContain('signed_protocol_action_to_today')
  })

  it('does not call the client-update flow wired while 0062 is unapplied', () => {
    // The specific over-claim this slice could have made. A practitioner
    // surface reading real data, plus a writer and a tested migration, is
    // still NOT the flow working: until 0062 is applied the client end
    // cannot store anything.
    const f = flowById('client_update_to_since_last_review')!
    expect(f.status).not.toBe('wired')
    expect(f.sourceOfTruth).toContain('case_events')
    expect(f.gap).toMatch(/AWAITING MIGRATION/)
    expect(f.gap).toMatch(/0062_case_events_client_authorship\.sql is NOT APPLIED/)
  })
})

describe('which version is the client\'s current plan', () => {
  it('an unsigned draft is never the plan', () => {
    const d = v({ id: 'p1', version: 1 })
    expect(isSigned(d)).toBe(false)
    expect(isCurrentPlan(d, [d])).toBe(false)
    expect(selectCurrentPlan([d])).toBeNull()
  })

  it('a lone signed version is the plan', () => {
    const s = signed('p1', 1)
    expect(selectCurrentPlan([s])?.id).toBe('p1')
  })

  it('a SIGNED successor displaces its predecessor', () => {
    const v1 = signed('p1', 1)
    const v2 = signed('p2', 2, 'p1')
    expect(selectCurrentPlan([v1, v2])?.id).toBe('p2')
    expect(isCurrentPlan(v1, [v1, v2])).toBe(false)
    expect(supersededPlans([v1, v2]).map((x) => x.id)).toEqual(['p1'])
  })

  it('an UNSIGNED revision does NOT displace the plan the client still has', () => {
    // The rule that matters most. If this were wrong, a practitioner clicking
    // "revise" would strip the client of their plan until the new one is signed.
    const v2 = signed('p2', 2)
    const v3draft = v({ id: 'p3', version: 3, supersedes: 'p2' })
    expect(isCurrentPlan(v2, [v2, v3draft])).toBe(true)
    expect(selectCurrentPlan([v2, v3draft])?.id).toBe('p2')
    expect(isCurrentPlan(v3draft, [v2, v3draft])).toBe(false)
  })

  it('"no signed plan yet" is a real answer, not an error', () => {
    expect(selectCurrentPlan([])).toBeNull()
    expect(planState([])).toEqual({ kind: 'none' })
  })

  it('tells the client a revision is in progress without withdrawing their plan', () => {
    const v2 = signed('p2', 2)
    const v3draft = v({ id: 'p3', version: 3, supersedes: 'p2' })
    const state = planState([v2, v3draft])
    expect(state.kind).toBe('current')
    if (state.kind === 'current') {
      expect(state.version.id).toBe('p2')
      expect(state.revisionInProgress).toBe(true)
    }
  })

  it('reports no revision in progress when there is none', () => {
    const state = planState([signed('p1', 1)])
    if (state.kind === 'current') expect(state.revisionInProgress).toBe(false)
  })

  it('keeps drafts out of anything client-facing', () => {
    const v1 = signed('p1', 1)
    const d = v({ id: 'p2', version: 2, supersedes: 'p1' })
    expect(draftVersions([v1, d]).map((x) => x.id)).toEqual(['p2'])
    expect(selectCurrentPlan([v1, d])?.id).toBe('p1')
    expect(supersededPlans([v1, d])).toEqual([])   // not superseded: successor unsigned
  })

  it('picks the highest signed version in a longer chain', () => {
    const chain = [signed('p1', 1), signed('p2', 2, 'p1'), signed('p3', 3, 'p2')]
    expect(selectCurrentPlan(chain)?.id).toBe('p3')
    expect(supersededPlans(chain).map((x) => x.id)).toEqual(['p2', 'p1'])
  })

  it('treats a half-written signature as unsigned', () => {
    // member_protocols has a CHECK that signed_at and signed_by are set
    // together, so this should be unreachable — the guard is here because a
    // plan shown on a half-signature would be worse than one not shown.
    const half = v({ id: 'p1', version: 1, signed_at: '2026-10-18T09:00:00Z' })
    expect(isSigned(half)).toBe(false)
    expect(selectCurrentPlan([half])).toBeNull()
  })
})

describe('case event visibility drift', () => {
  it('names the canonical chain and refuses to be silently fixed', () => {
    // Recorded, not fixed: narrowing a live read policy is its own migration.
    // This test exists so the finding cannot be deleted without a decision.
    expect(CASE_EVENT_VISIBILITY_DRIFT.policy).toBe('case_events_practitioner_select')
    expect(CASE_EVENT_VISIBILITY_DRIFT.resolvesThrough).toBe('case_practitioner_work')
    expect(CASE_EVENT_VISIBILITY_DRIFT.shouldResolveThrough).toMatch(/can_access_case_care_profile/)
    expect(CASE_EVENT_VISIBILITY_DRIFT.tooWide).toMatch(/consent/)
    expect(CASE_EVENT_VISIBILITY_DRIFT.requiresMigration).toBe(true)
    expect(CASE_EVENT_VISIBILITY_DRIFT.requiresFounderApproval).toBe(true)
  })
})
