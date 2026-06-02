// Domain types for the practitioners helper module.
// Mirror the DB check constraints — keep in sync with migrations 0034–0038.

// ─── practitioners ─────────────────────────────────────────────────────────────

export type PractitionerStatus =
  | 'pending_review'
  | 'approved'
  | 'active'
  | 'suspended'
  | 'archived'

// ─── case_practitioner_work ────────────────────────────────────────────────────

export type WorkType =
  | 'case_review'
  | 'safety_review'
  | 'protocol_review'
  | 'escalation_review'
  | 'follow_up_review'
  | 'specialist_consult'

export type WorkStatus =
  | 'assigned'
  | 'in_review'
  | 'completed'
  | 'escalated'
  | 'declined'
  | 'cancelled'

export type WorkDecision = 'approved' | 'needs_revision' | 'escalated'

export type AssignmentSource = 'admin' | 'matching_engine' | 'auto_complexity_threshold'

export interface AssignedWork {
  id:               string
  caseId:           string
  practitionerId:   string
  workType:         WorkType
  status:           WorkStatus
  assignedBy:       string
  assignmentSource: AssignmentSource
  dueAt:            string | null
  assignedAt:       string
  startedAt:        string | null
  completedAt:      string | null
  notes:            string | null
  outputEventId:    string | null
}

export interface AssignWorkInput {
  caseId:            string
  practitionerId:    string
  workType:          WorkType
  assignedBy:        string
  assignmentSource?: AssignmentSource
  dueAt?:            string
}

export interface CompleteWorkItemInput {
  workId:         string
  decision:       WorkDecision
  notes:          string
  recommendation: string
}

// ─── client_practitioner_links ─────────────────────────────────────────────────

export type ConnectionType =
  | 'brought_by_practitioner'
  | 'assigned_by_admin'
  | 'chosen_by_client'
  | 'added_by_system'

// "Role" in the context of a client-practitioner link (distinct from auth roles)
export type LinkRole = 'lead' | 'specialist' | 'reviewer' | 'temporary'

export type ControlLevel = 'keep' | 'flexible' | 'one_off'

export type CreationActor = 'admin' | 'practitioner' | 'system'

// Conventional end reasons — free-text in DB, typed here for documentation
export type EndReason =
  | 'declined'
  | 'escalated'
  | 'admin_action'
  | 'client_request'
  | 'practitioner_archived'
  | (string & {})  // allows arbitrary strings while keeping autocomplete for conventional values

export interface CreateClientPractitionerLinkInput {
  clientId:       string
  practitionerId: string
  connectionType: ConnectionType
  role:           LinkRole
  controlLevel:   ControlLevel
  creationActor:  CreationActor
  createdBy?:     string
  notes?:         string
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

export type InboxUrgency = 'overdue' | 'watch' | 'normal'

export interface InboxWorkItem {
  workItemId:          string
  caseId:              string
  workType:            WorkType
  status:              WorkStatus
  assignedAt:          string
  startedAt:           string | null
  completedAt:         string | null
  dueAt:               string | null
  clientName:          string
  primaryConcern:      string | null
  caseComplexityScore: number
  escalationRequired:  boolean
  urgency:             InboxUrgency
}

// ─── Workspace — helper return types ──────────────────────────────────────────

export interface IntakeSummary {
  arrivalEmotion:          string | null
  primaryConcerns:         string[] | null
  primarySystem:           string | null
  stressLevel:             number | null   // 1–10
  sleepQuality:            number | null   // 0–10
  energyLevel:             number | null   // 0–10
  concernSeverity:         number | null   // 0–10 (from intake_answers.concern_severity_baseline)
  postExertionalWorsening: boolean | null  // from intake_answers.post_exertional_worsening
  dietDescription:         string | null
  currentMedications:      string | null
  currentSupplements:      string | null
  symptomOnset:            string | null
  timelineLastWell:        string | null
  timelineTrigger:         string | null
  diagnosedConditions:     string[] | null
  // Sprint B Phase 1 — signature question. Quoted verbatim under client
  // name in the practitioner workspace; passed into AI generation prompts.
  // null when the user skipped (the question is not required).
  mostWantToUnderstand:    string | null
  // Sprint B Phase 2 — Best Self Baseline (intake_responses, migration 0050).
  // Rendered as the "BEST SELF" workspace section when any is non-null.
  // Comparatives store: better_than_now | about_the_same | not_sure.
  bestSelfDescription:     string | null
  bestSelfSleep:           string | null
  bestSelfEnergy:          string | null
  bestSelfMood:            string | null
  bestSelfRecoveryGoal:    string | null
}

export interface CaseEvent {
  id:           string
  eventType:    string
  eventPayload: Record<string, unknown>
  createdAt:    string
  sourceId:     string | null
  sourceTable:  string | null
}

export interface BioHubSignal {
  id:             string
  markerName:     string
  markerKey:      string | null
  value:          number | null
  unit:           string | null
  reportDate:     string | null
  functionalZone: number | null
  gpRangeLow:     number | null
  gpRangeHigh:    number | null
  niOptimalLow:   number | null
  niOptimalHigh:  number | null
}

export interface PriorReview {
  workItemId:       string
  workType:         WorkType
  status:           WorkStatus
  completedAt:      string
  notes:            string | null
  practitionerName: string | null
}

// Safe projection returned by getClientTeam — contact/admin fields excluded
export interface ClientTeamMember {
  practitionerId:      string
  displayName:         string
  bio:                 string | null
  credentialsSummary:  string | null
  specialisations:     string[] | null
  modalities:          string | null
  role:                LinkRole
  linkedAt:            string
}
