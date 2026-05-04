// ─── packages/db/src/intake/saveIntakeAnswer.ts ───────────────────────────────
// Single write path for per-question intake answers.
// UPSERTs into intake_answers ON CONFLICT (session_id, question_id).
// Supabase client is passed in — works for both server and browser callers.

import type { SupabaseClient } from '@supabase/supabase-js'
import { sectionIdFromNumber } from './sectionCoercion'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SaveIntakeAnswerInput {
  sessionId:          string
  memberId:           string   // required — intake_answers.member_id is NOT NULL, no default
  questionId:         string
  sectionNumber:      number
  value:              unknown
  clinicalObjective?: string
  mappedSystems?:     string[]
  mappedHypotheses?:  string[]
}

export interface IntakeAnswerRow {
  id:                 string
  session_id:         string
  member_id:          string
  question_id:        string
  section_id:         string
  answer:             unknown
  clinical_objective: string | null
  mapped_systems:     string[] | null
  mapped_hypotheses:  string[] | null
  answered_at:        string | null
  updated_at:         string
}

// ─── Implementation ───────────────────────────────────────────────────────────

export async function saveIntakeAnswer(
  supabase: SupabaseClient,
  input: SaveIntakeAnswerInput,
): Promise<IntakeAnswerRow> {
  const {
    sessionId,
    memberId,
    questionId,
    sectionNumber,
    value,
    clinicalObjective,
    mappedSystems,
    mappedHypotheses,
  } = input

  const { data, error } = await supabase
    .from('intake_answers')
    .upsert(
      {
        session_id:         sessionId,
        member_id:          memberId,
        question_id:        questionId,
        // Live schema uses section_id text — convert via sectionCoercion helper
        section_id:         sectionIdFromNumber(sectionNumber),
        answer:             value,
        clinical_objective: clinicalObjective ?? null,
        mapped_systems:     mappedSystems     ?? null,
        mapped_hypotheses:  mappedHypotheses  ?? null,
        // updated_at is managed by the DB trigger (handle_updated_at)
        // answered_at is set by the DB default on insert
      },
      {
        onConflict:        'session_id,question_id',
        ignoreDuplicates:  false,
      },
    )
    .select()
    .single()

  if (error) {
    throw new Error(
      `saveIntakeAnswer failed [${error.code ?? 'unknown'}]: ${error.message}`,
    )
  }

  return data as IntakeAnswerRow
}
