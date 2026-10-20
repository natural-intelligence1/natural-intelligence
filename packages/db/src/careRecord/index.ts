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
// No schema change. Everything resolves against tables that already exist.

export { SHARED_IDENTIFIERS, CARE_RECORD_FLOWS, flowById, summariseContract } from './contract'
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
