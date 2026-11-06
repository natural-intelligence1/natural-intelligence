// ─── Case-taking persistence — BACKEND FOUNDATION ───────────────────────────
//
// This barrel deliberately exposes ONLY the case-taking domain, its sign-off
// authority and the single write path. The Consultation Cockpit pilot modules
// (pilot, mappingPack, diggingEdges, capture, safetyLinks, annex1, guidance,
// sectionStatus, studentMode, worklog, synopsisContribution) live on
// ux/calm-client-and-cockpit and are NOT part of this release.
//
// STATUS: LIVE / DORMANT. Migration 0066 creates the tables and the
// authority, immutability and revision triggers. Nothing in the practitioner
// interface is wired to them yet — no autosave, no answer persistence, no
// observations, no safety answers, no section progress, no UI sign-off, no
// Lead submission. That wiring is a later, separate decision.
//
//   caseTakingActor.ts     who is acting, and the display name for attribution
//   caseTaking.ts          the state machine and the completion offer. Persists
//                          NOTHING — in-memory only, and a structural test
//                          enforces that it gains no database write
//   caseTakingSignOff.ts   THE authority guard and THE only supported writer
//                          of signed_off_at / signed_off_by

export {
  CASE_TAKING_ACTOR_ROLES, isCaseTakingActorRole,
} from './caseTakingActor'
export type {
  CaseTakingActorRole, CaseTakingActorIdentity,
} from './caseTakingActor'

export {
  CASE_ROLES, CASE_TAKING_STATES, CASE_TAKING_STATE_LABELS,
  CASE_TAKING_REFUSALS, CASE_TAKING_REFUSAL_MESSAGES,
  isCaseRole, isEditable, isLead, roleLabel, completionOffer,
  newCaseTakingRecord, submitToLead, beginLeadReview, markReadyForSignOff,
  signOff, amendAfterSignOff, applyCompletion,
} from './caseTaking'
export type {
  CaseRole, CaseTakingState, CaseTakingActor, CaseTakingAction, CompletionOffer,
  CaseTakingRecord, CaseTakingEvent, CaseTakingResult, CaseTakingRefusalCode,
  TransitionInput,
} from './caseTaking'

// THE canonical authority guard and the single write path for case-taking
// sign-off. caseTaking.ts above is the in-memory state machine and persists
// nothing; anything that actually signs a stored session goes through here,
// because the 0066 database trigger cannot gate a service-role caller.
export {
  CASE_TAKING_SIGNOFF_GUARD_VERSION, SIGNABLE_CASE_TAKING_STATES,
  SIGNING_CASE_ROLE, CASE_TAKING_SIGNOFF_REFUSALS,
  CASE_TAKING_SIGNOFF_REFUSAL_MESSAGES,
  authoriseCaseTakingSignOff, assertCaseTakingSignOffAuthorised,
  CaseTakingSignOffRefused, signOffCaseTakingSession,
  caseTeamRoleResolver, leadEligibilityResolver,
} from './caseTakingSignOff'
export type {
  CaseTakingSignOffRefusalCode, CaseTakingSignOffRefusal,
  CaseTakingSignOffRequest, CaseTakingSignOffDeps, CaseTakingSignOffAttribution,
  CaseTakingSignOffAuthorisation, CaseTakingSignOffOutcome,
  CaseTakingSessionUnderSignature, LeadEligibilityVerdict,
  ActiveCaseRoleResolver, LeadEligibilityResolver,
  SignOffClient, SignOffWriteClient,
} from './caseTakingSignOff'
