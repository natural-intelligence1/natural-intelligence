// ─── packages/db/src/intakeV2/flow.ts ─────────────────────────────────────────
// V2 flow helpers: kill-switch, progressive disclosure and answer storage.
//
// Storage REUSES the existing intake tables — no schema change:
//   • intake_sessions: one 'in_progress' session per member (V1 helper reused)
//   • intake_answers:  upsert on (session_id, question_id); V2 ids carry the
//     'v2.' prefix and section_id carries 'v2_<section>' so V1 and V2 answers
//     can never collide and V1 records remain untouched/legacy-readable.
// Answers save on EVERY step; nothing is interpreted, scored or ranked.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { V2QuestionDef, V2SectionDef, V2ShowIf } from './types'
import { V2_QUESTIONS, V2_SECTIONS } from './registry'

/** Kill-switch: the V2 route is off unless explicitly enabled (exact 'true'). */
export function isIntakeV2Enabled(): boolean {
  return process.env.INTAKE_V2_ENABLED === 'true'
}

export type V2Answers = Record<string, unknown>

function conditionMet(showIf: V2ShowIf | undefined, answers: V2Answers): boolean {
  if (!showIf) return true
  const value = answers[showIf.questionId]
  if (showIf.equals !== undefined) return value === showIf.equals
  if (showIf.includesAny) {
    if (!Array.isArray(value)) return false
    return showIf.includesAny.some((option) => (value as unknown[]).includes(option))
  }
  return true
}

/** Sections visible for these answers (progressive disclosure). */
export function visibleSections(answers: V2Answers): V2SectionDef[] {
  return V2_SECTIONS.filter((section) => conditionMet(section.showIf, answers))
}

/** Questions visible within a section for these answers. */
export function visibleQuestions(section: V2SectionDef['id'], answers: V2Answers): V2QuestionDef[] {
  return V2_QUESTIONS
    .filter((question) => question.section === section)
    .filter((question) => conditionMet(question.showIf, answers))
}

/** Required questions still unanswered (submission gate — factual only). */
export function missingRequired(answers: V2Answers): V2QuestionDef[] {
  return V2_QUESTIONS
    .filter((question) => question.required)
    .filter((question) => conditionMet(question.showIf, answers))
    .filter((question) => {
      const value = answers[question.id]
      if (value === undefined || value === null || value === '') return true
      if (Array.isArray(value) && value.length === 0) return true
      return false
    })
}

/**
 * True when any answered safety-capture question includes a safety option.
 * INTERNAL ONLY: used to set requires_practitioner_review on the session
 * answers — never surfaced to the client as urgency or risk.
 */
export function hasSafetyCaptureAnswers(answers: V2Answers): boolean {
  return V2_QUESTIONS.some((question) => {
    if (question.samd !== 'safety_capture' || !question.safetyOptions) return false
    const value = answers[question.id]
    if (Array.isArray(value)) return question.safetyOptions.some((option) => (value as unknown[]).includes(option))
    if (typeof value === 'string') return question.safetyOptions.includes(value)
    return false
  })
}

// ─── Storage ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

/** Upsert one V2 answer (save-on-every-step write path). */
export async function saveV2Answer(
  client: AnyClient,
  input: { sessionId: string; memberId: string; questionId: string; value: unknown },
): Promise<void> {
  const question = V2_QUESTIONS.find((entry) => entry.id === input.questionId)
  if (!question) throw new Error(`saveV2Answer: unknown V2 question id ${input.questionId}`)
  const { error } = await (client as AnyClient)
    .from('intake_answers')
    .upsert({
      session_id:  input.sessionId,
      member_id:   input.memberId,
      question_id: input.questionId,
      section_id:  `v2_${question.section}`,
      answer:      { value: input.value, v: question.version },
      answered_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'session_id,question_id' })
  if (error) throw new Error(`saveV2Answer failed [${error.code}]: ${error.message}`)
}

/** All V2 answers for a session, as { questionId: value }. */
export async function loadV2Answers(client: AnyClient, sessionId: string): Promise<V2Answers> {
  const { data, error } = await (client as AnyClient)
    .from('intake_answers')
    .select('question_id, answer')
    .eq('session_id', sessionId)
    .like('question_id', 'v2.%')
  if (error) throw new Error(`loadV2Answers failed [${error.code}]: ${error.message}`)
  const answers: V2Answers = {}
  for (const row of (data ?? []) as { question_id: string; answer: { value?: unknown } | null }[]) {
    answers[row.question_id] = row.answer?.value
  }
  return answers
}

/**
 * V2 keeps its own session so a legacy V1 in-progress session is never
 * touched or completed by V2 activity. V2 sessions are identified by
 * current_section starting 'v2'.
 */
export async function getOrCreateV2Session(
  client: AnyClient, memberId: string,
): Promise<{ id: string; status: string }> {
  const { data: existing, error: selErr } = await (client as AnyClient)
    .from('intake_sessions')
    .select('id, status')
    .eq('member_id', memberId)
    .eq('status', 'in_progress')
    .like('current_section', 'v2%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (selErr) throw new Error(`getOrCreateV2Session select failed [${selErr.code}]: ${selErr.message}`)
  if (existing) return existing as { id: string; status: string }

  const { data: created, error: insErr } = await (client as AnyClient)
    .from('intake_sessions')
    .insert({ member_id: memberId, status: 'in_progress', current_section: 'v2:arrival' })
    .select('id, status')
    .single()
  if (insErr || !created) throw new Error(`getOrCreateV2Session insert failed [${insErr?.code}]: ${insErr?.message}`)
  return created as { id: string; status: string }
}

/** Mark the V2 session submitted. Deliberately triggers NOTHING downstream:
 *  no AI pipelines, no assignment, no practitioner visibility. */
export async function completeV2Session(client: AnyClient, sessionId: string): Promise<void> {
  const { error } = await (client as AnyClient)
    .from('intake_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString(), current_section: 'v2:submitted' })
    .eq('id', sessionId)
    .like('current_section', 'v2%')
  if (error) throw new Error(`completeV2Session failed [${error.code}]: ${error.message}`)
}
