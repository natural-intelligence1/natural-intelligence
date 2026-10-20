// ─── packages/db/src/careRecord/contract.ts ─────────────────────────────────
// THE SHARED CARE RECORD CONTRACT.
//
// One record, two windows. The client app and the practitioner app are
// different views of the same case — not two products that happen to show
// similar things, and never two copies kept in step by hand.
//
// WHY THIS FILE EXISTS
//
// The failure mode it prevents is cheap to fall into and expensive to undo:
// the client surface grows its own "my plan" table, the practitioner surface
// grows its own, and within a release they disagree about what was signed.
// Every flow below therefore names ONE source of truth and ONE shared
// identifier, and both apps are expected to read through it.
//
// It also records, honestly, which flows are actually wired today and which
// are only described. A contract that claims more than the code does is worse
// than none, so `status` is the part to read first.
//
// NO SCHEMA CHANGE. Everything here resolves against tables that already
// exist: member_protocols (with 0059's version/signed_at/signed_by/supersedes
// /case_id), case_team_roles, daily_adherence, client_cases, profiles.

/** The identifiers that make a thing the SAME thing in both apps. */
export const SHARED_IDENTIFIERS = {
  /** profiles.id — the person. Client sees themselves; practitioner sees a
   *  pseudonym over the same id. */
  member: 'profiles.id',
  /** client_cases.id — the episode of care both sides are looking at. */
  case: 'client_cases.id',
  /** member_protocols.id — one VERSION of a Protocol. Not the plan "as such":
   *  a plan is the chain of versions, and the current one is whichever signed
   *  version nothing signed supersedes. */
  protocolVersion: 'member_protocols.id',
  /** case_team_roles.id — one practitioner's role on one case, over a period. */
  teamRole: 'case_team_roles.id',
  /** daily_adherence.id — one client action on one day, derived from a
   *  signed Protocol. */
  dailyAction: 'daily_adherence.id',
} as const

export type SharedIdentifier = keyof typeof SHARED_IDENTIFIERS

/** How real a flow is today. The honest part of the contract. */
export type WiringStatus =
  /** Both ends read the same source through shipped code. */
  | 'wired'
  /** The domain module exists and is tested, but one or both surfaces do not
   *  call it yet. */
  | 'domain_ready_not_wired'
  /** Nothing exists yet. Named so the shape is fixed before it is built. */
  | 'absent'

export interface CareRecordFlow {
  id: string
  /** Where the information starts. */
  from: string
  /** Where it appears. */
  to: string
  /** The single source of truth. Both ends read THIS. */
  sourceOfTruth: string
  /** The shared identifier that makes it the same record on both sides. */
  via: SharedIdentifier
  status: WiringStatus
  /** The rule that must hold. Written so a test can assert it, and so a
   *  reviewer can tell whether an implementation honours it. */
  invariant: string
  /** What is missing, where status is not 'wired'. */
  gap?: string
}

/**
 * Every client ↔ practitioner flow, with its single source of truth.
 *
 * Read `status` before trusting any row: several are shapes agreed in advance
 * rather than working code, which is the point of writing them down now.
 */
export const CARE_RECORD_FLOWS: readonly CareRecordFlow[] = Object.freeze([
  {
    id: 'client_answer_to_case_record',
    from: 'Client intake answer',
    to: 'Practitioner case record',
    sourceOfTruth: 'intake_v2_answers, keyed by question_id',
    via: 'member',
    status: 'domain_ready_not_wired',
    invariant:
      'The practitioner reads the client\'s answer itself. No copy is taken at hand-off, so a ' +
      'later correction is visible on both sides rather than only on the one that was edited.',
    gap:
      'Intake V2 is client-facing and behind INTAKE_V2_ENABLED; no practitioner-side reader ' +
      'exists. The question↔field bridge is also unmapped (see questionGraph), so answers ' +
      'cannot yet be resolved onto canonical fields.',
  },
  {
    id: 'practitioner_clarification_preserves_client_answer',
    from: 'Practitioner clarification or correction',
    to: 'Case record, alongside the original',
    sourceOfTruth: 'case_contributions (append-only), attributed to the practitioner',
    via: 'case',
    status: 'domain_ready_not_wired',
    invariant:
      'A practitioner addition NEVER overwrites what the client said. The client\'s words and ' +
      'the practitioner\'s clarification both persist, each attributed, so the record shows who ' +
      'said what rather than a merged account with no author.',
    gap: 'case_contributions is live (0057) and append-only; no UI writes to it yet.',
  },
  {
    id: 'synopsis_as_shared_longitudinal_record',
    from: 'Factual Synopsis',
    to: 'Client My Health AND practitioner Synopsis',
    sourceOfTruth: 'synopsis.ts / synopsisMapping.ts over the canonical field registry',
    via: 'member',
    status: 'domain_ready_not_wired',
    invariant:
      'One synopsis, two renderings. The client view may show less than the practitioner view, ' +
      'but never something different: anything both can see is the same fact from the same place.',
    gap:
      'synopsis.ts and synopsisMapping.ts are complete and tested. The live /dashboard/synopsis ' +
      'page is a separate, older implementation that does not use them, and there is no ' +
      'practitioner rendering at all.',
  },
  {
    id: 'signed_protocol_to_client_plan',
    from: 'Signed / released Protocol version',
    to: 'Client My Plan',
    sourceOfTruth: 'member_protocols — the signed version nothing signed supersedes',
    via: 'protocolVersion',
    status: 'wired',
    invariant:
      'My Plan shows a SIGNED version or nothing. An unsigned draft has no clinical status and ' +
      'must never appear as the client\'s plan, whatever produced it. A draft revision does not ' +
      'displace the signed version it will replace — only a signed successor does.',
  },
  {
    id: 'signed_protocol_action_to_today',
    from: 'Action within the signed Protocol',
    to: 'Today / DailyPath',
    sourceOfTruth: 'daily_adherence rows derived from the current signed version',
    via: 'dailyAction',
    status: 'domain_ready_not_wired',
    invariant:
      'DailyPath may simplify presentation but must not alter clinical content, and every derived ' +
      'action keeps lineage to the Protocol version and the originating item.',
    gap:
      'Per-version Protocol items and the daily_adherence.protocol_version_item_id lineage column ' +
      'are both on the unmerged Protocol branch (migration 0061, unapplied). Until then DailyPath ' +
      'resolves items through the shared template and lineage cannot be recorded.',
  },
  {
    id: 'client_update_to_since_last_review',
    from: 'Client progress update or check-in',
    to: 'Practitioner "Since last review"',
    sourceOfTruth:
      'case_events, read through careRecord/caseUpdates.ts and grouped by ' +
      'intakeV2/updates.ts — buildSinceLastReview',
    via: 'case',
    status: 'domain_ready_not_wired',
    invariant:
      'Facts only, each dated and attributed to its source, and dated when the thing HAPPENED ' +
      'rather than when it was typed. The builder orders and groups; it does not rank, score, ' +
      'summarise or interpret. An event with no statement is skipped, never described in NI\'s ' +
      'own words.',
    gap:
      'READ PATH REAL: the practitioner Overview queries case_events under RLS through ' +
      'loadCaseUpdates. WRITE PATH BLOCKED: case_events has one insert-capable policy, ' +
      'case_events_service_all (service_role); there is no client INSERT policy, so a client ' +
      'cannot record an update on their own case. Two further gaps — case_events has no author ' +
      'column, so attribution rests on an unenforced event_payload convention, and append-only ' +
      'holds only by absence of a client UPDATE/DELETE policy rather than by a trigger. Also ' +
      'diverges from the case-team flow: practitioner read access here resolves through ' +
      'case_practitioner_work, not case_team_roles.',
  },
  {
    id: 'case_team_to_both_views',
    from: 'case_team_roles',
    to: 'Client My Team AND practitioner Team',
    sourceOfTruth: 'case_team_roles, read through careRecord/caseTeamView.ts',
    via: 'teamRole',
    status: 'wired',
    invariant:
      'Both sides read the same roles. The client sees members whose membership is visible to ' +
      'them; the practitioner sees the full team. Exactly one active Lead per case, enforced in ' +
      'the database by 0057 and 0060, not in either app.',
  },
  {
    id: 'safety_state_to_review_workflow',
    from: 'Safety-relevant answer recorded during intake',
    to: 'Practitioner safety review',
    sourceOfTruth: 'safetyWorkflow.ts over clinician-owned safety_capture metadata',
    via: 'case',
    status: 'domain_ready_not_wired',
    invariant:
      'Safety items are DERIVED from what the client reported and surfaced for a human to review. ' +
      'Nothing here triages, scores, prioritises or decides urgency — the practitioner does that.',
    gap: 'safetyWorkflow.ts is complete domain code with no UI and no test file. 14 intake questions already carry safetyOptions metadata.',
  },
])

export function flowById(id: string): CareRecordFlow | undefined {
  return CARE_RECORD_FLOWS.find((f) => f.id === id)
}

export interface ContractSummary {
  flows: number
  wired: number
  domainReadyNotWired: number
  absent: number
  /** Flows whose gap names the unmerged Protocol branch or 0061. */
  blockedOnProtocolIntegration: string[]
}

export function summariseContract(): ContractSummary {
  const by = (s: WiringStatus) => CARE_RECORD_FLOWS.filter((f) => f.status === s).length
  return {
    flows: CARE_RECORD_FLOWS.length,
    wired: by('wired'),
    domainReadyNotWired: by('domain_ready_not_wired'),
    absent: by('absent'),
    blockedOnProtocolIntegration: CARE_RECORD_FLOWS
      .filter((f) => /0061|Protocol branch/i.test(f.gap ?? ''))
      .map((f) => f.id),
  }
}
