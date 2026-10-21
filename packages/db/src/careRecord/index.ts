// ─── Shared care record ──────────────────────────────────────────────────────
// One record, two windows: the client app and the practitioner app are views
// of the same case, never two copies kept in step by hand.
//
//   contract.ts         every client ↔ practitioner flow, its single source
//                       of truth, its shared identifier, and — honestly —
//                       whether it is actually wired yet
//   currentProtocol.ts  the one rule both apps must agree on: which Protocol
//                       version is the client's current plan
//
// Everything here resolves against tables that already exist. One schema
// change is pending: migration 0062 adds client authorship to case_events —
// written, tested against real Postgres, NOT APPLIED. Nothing in this package
// depends on it having been applied; the client writer reports the unapplied
// state rather than failing obscurely.

export {
  SHARED_IDENTIFIERS, CARE_RECORD_FLOWS, flowById, summariseContract,
  CASE_EVENT_VISIBILITY_DRIFT,
} from './contract'
export type { SharedIdentifier, WiringStatus, CareRecordFlow, ContractSummary } from './contract'

export {
  isSigned, isSupersededBySignedVersion, isCurrentPlan,
  selectCurrentPlan, supersededPlans, draftVersions, planState,
} from './currentProtocol'
export type { ProtocolVersionRow, PlanState } from './currentProtocol'

// Flow 1 WIRED: case_team_roles -> client My Team AND practitioner Team.
export {
  loadCaseTeam, clientVisibleTeam, practitionerTeamView, leadPractitioner,
  summariseCaseTeam, CLIENT_APPROVAL_UNRECORDED,
} from './caseTeamView'
export type { CaseTeamMember, CaseTeamSummary } from './caseTeamView'

// Client update -> practitioner "Since last review", over case_events.
// Read path live both sides of migration 0062; client write path written
// against the post-0062 contract and awaiting its apply — see
// CLIENT_UPDATE_WRITE_PATH. buildSinceLastReview is re-exported from the
// intakeV2 module it already lives in, never reimplemented here.
export {
  CLIENT_UPDATE_WRITE_PATH, CASE_EVENT_TYPES, ACTOR_CAPACITIES,
  loadCaseUpdates, eventToUpdate, recordClientUpdate, checkFactualStatement,
  provenanceLabel, isClientReported, isUnattributed,
  sinceLastReviewFor, buildSinceLastReviewView, UPDATE_KIND_LABELS,
} from './caseUpdates'
export type {
  CaseEventType, ActorCapacity, ClientUpdateDraft, ClientUpdateResult, StatementCheck,
  SinceLastReviewView, DatedUpdate, SinceLastReview, UpdateKind, UpdateAuthorRole,
} from './caseUpdates'
