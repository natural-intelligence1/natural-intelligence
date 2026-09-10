// Barrel export for the practitioners helper module.

export type {
  PractitionerStatus,
  WorkType,
  WorkStatus,
  WorkDecision,
  AssignmentSource,
  AssignedWork,
  AssignWorkInput,
  CompleteWorkItemInput,
  ConnectionType,
  LinkRole,
  ControlLevel,
  CreationActor,
  EndReason,
  CreateClientPractitionerLinkInput,
  ClientTeamMember,
  InboxUrgency,
  InboxWorkItem,
  IntakeSummary,
  CaseEvent,
  BioHubSignal,
  PriorReview,
} from './types'

export { getPractitioner }               from './getPractitioner'
export { listAssignedWork }              from './listAssignedWork'
export { listAssignedCases }             from './listAssignedCases'
export { assignWork }                    from './assignWork'
export { assignCaseForReview }           from './assignCaseForReview'
export type { AssignCaseForReviewInput, AssignCaseForReviewResult } from './assignCaseForReview'
export { routeIntakeAssignment, isIntakeAssignmentEnabled } from './routeIntakeAssignment'
export type { RouteIntakeAssignmentResult } from './routeIntakeAssignment'
export { completeWorkItem }              from './completeWorkItem'
export { updatePractitionerStatus }      from './updatePractitionerStatus'
export { createClientPractitionerLink }  from './createClientPractitionerLink'
export { endClientPractitionerLink }     from './endClientPractitionerLink'
export { listClientLinksForPractitioner } from './listClientLinksForPractitioner'
export { getClientTeam }                 from './getClientTeam'
export { listWorkForInbox }              from './listWorkForInbox'
export { startWorkItem }                 from './startWorkItem'
export { getIntakeSummary }              from './getIntakeSummary'
export { getCaseEvents }                 from './getCaseEvents'
export { getBioHubSignals }              from './getBioHubSignals'
export { getPriorReviews }               from './getPriorReviews'

// ── Sprint 3 safety floor ─────────────────────────────────────────────────────
export { buildReviewPack, scrubIdentifiers, makePseudonym } from './reviewPack'
export type { ReviewPack } from './reviewPack'
export {
  PRACTITIONER_CATEGORIES, AGREEMENT_VERSION, AGREEMENT_TEXTS,
  isPractitionerCategory, getCurrentAgreement, hasAcceptedCurrentAgreement,
  acceptCurrentAgreementViaRpc, isAgreementGateEnabled,
} from './agreements'
export type { PractitionerCategory, AgreementRow } from './agreements'
