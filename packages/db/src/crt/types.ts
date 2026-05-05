// ─── packages/db/src/crt/types.ts ────────────────────────────────────────────
// Domain types for the Clinical Reasoning Trace system.
// These mirror the DB check constraints — keep in sync with the migration.

export type CaseStatus = 'active' | 'paused' | 'closed'

export type EventType =
  | 'intake_answer'
  | 'follow_up_answer'
  | 'lab_upload'
  | 'gp_record_upload'
  | 'grocery_receipt'
  | 'practitioner_note'
  | 'protocol_update'

export type TraceType =
  | 'intake_analysis'
  | 'lab_analysis'
  | 'food_analysis'
  | 'protocol_generation'
  | 'weekly_review'
  | 'practitioner_review'

export type TraceStatus = 'draft' | 'ready_for_review' | 'reviewed' | 'client_visible'

export type GeneratedBy = 'ai' | 'practitioner' | 'hybrid'

export type AgentName =
  | 'case_historian'
  | 'medical_records'
  | 'food_environment'
  | 'root_cause'
  | 'protocol_builder'
  | 'safety_scope'
  | 'practitioner_review'

export type EntryType =
  | 'observation'
  | 'hypothesis'
  | 'evidence_for'
  | 'evidence_against'
  | 'weighting'
  | 'decision'
  | 'uncertainty'
  | 'recommendation'
  | 'escalation_flag'
  | 'practitioner_comment'
  | 'client_explanation'

export type Visibility = 'internal' | 'practitioner' | 'client'

export interface TraceEntry {
  agent_name:       AgentName
  entry_type:       EntryType
  content:          string
  system_area?:     string
  hypothesis_key?:  string
  evidence_payload?: Record<string, unknown>
  confidence?:      number
  priority?:        number
  visibility:       Visibility
}

export interface ClientStory {
  body_story:   string
  future_self:  string
  systems:      string[]
  generated_at: string
}
