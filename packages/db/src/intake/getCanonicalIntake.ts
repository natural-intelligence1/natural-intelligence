// ─── packages/db/src/intake/getCanonicalIntake.ts ────────────────────────────
// ONE answer to "what did this client actually tell NI?". READ ONLY.
//
// WHY THIS EXISTS
//
// Intake V1 writes twice. `intake_answers` gets a row the moment a question is
// answered; `intake_responses` gets a column only when the client leaves the
// step. The two drift, and they drift in three ways: by timing, by the form's
// `|| null` coercion turning a deliberate blank into NULL, and by shape — the
// same question is a string[] in one store and a comma-joined string in the
// other. Every consumer that resolved this for itself resolved it differently,
// which is how a practitioner surface and a client surface ended up disagreeing
// about the same client.
//
// So it is resolved once, here, and consumers read the result.
//
// THE RULES, STATED ONCE
//
//   1. `intake_answers` is canonical. If an answer row exists, it wins —
//      including when it is blank, because "reached and left blank" is a
//      clinical fact and must not be collapsed into "never answered".
//   2. `intake_responses` is consulted ONLY where a question has no answer-row
//      representation, or as a fallback when no answer row exists at all.
//      It is never preferred over a present answer row.
//   3. Multiple sessions are normal. `intake_answers` is unique on
//      (session_id, question_id), NOT on (member_id, question_id), so one
//      member can hold several rows for the same question. The latest wins;
//      the older rows are preserved and returned, never deleted or hidden.
//   4. Shape differences are normalised here, once, so no consumer has to
//      know which store a value came from.
//
// WHAT THIS IS NOT
//
// It is not a snapshot, a copy or a mirror. It holds no state and writes
// nothing — it reads the canonical rows on every call. An immutable
// submission snapshot, if one is ever needed, is a different thing belonging
// to sign-off, not to reading.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import {
  INTAKE_SECTIONS,
  LEGACY_ONLY_FIELDS,
  RESPONSE_METADATA_COLUMNS,
  UNSUPPORTED_KEYS,
  getIntakeQuestion,
  type IntakeQuestion,
} from './questionRegistry'

type ReadClient = SupabaseClient<Database>

/**
 * THE ORDERING KEY, stated explicitly because precedence must be
 * deterministic rather than whatever the database happened to return:
 *
 *   updated_at DESC, answered_at DESC, id DESC
 *
 * `updated_at` first: the `handle_updated_at` trigger moves it on every write,
 * so it marks the most recent write — which is what "latest answer" means. An
 * UPSERT that re-answers a question within one session moves `updated_at` but
 * leaves `answered_at` at the first-answer time, so `answered_at` alone would
 * pick the stale row.
 *
 * `answered_at` second: breaks a tie between rows written in the same
 * trigger-resolution instant, preferring the later first-answer.
 *
 * `id` last: a UUID is arbitrary, but it is TOTAL. Without it two rows that
 * tie on both timestamps would order non-deterministically, and the canonical
 * answer would depend on the query plan.
 */
export const CANONICAL_ANSWER_ORDER = ['updated_at', 'answered_at', 'id'] as const

/** Where a canonical value came from. */
export type AnswerSource =
  /** An `intake_answers` row — the canonical store. */
  | 'answer'
  /** An `intake_responses` column, used only because no answer row exists. */
  | 'legacy_column'
  /** Neither store holds anything. */
  | 'absent'

/**
 * Whether the client gave this question content.
 *
 * `blank` is NOT `unanswered`. It means a row exists and the client left it
 * empty — they reached the question and chose not to answer. The form's
 * `|| null` coercion used to destroy that distinction in the column; this
 * projection restores it from the answer store.
 */
export type AnswerStatus = 'answered' | 'blank' | 'unanswered'

/** `psychosocial_supported`, normalised across both stores. */
export interface SupportLevel {
  /** The option key the client picked, or null when only a boolean survives. */
  key: string | null
  /** True when the client indicated support. Null when nothing is recorded. */
  supported: boolean | null
}

export interface SupersededAnswer {
  sessionId: string
  value: unknown
  answeredAt: string | null
  updatedAt: string | null
}

export interface CanonicalAnswer {
  questionId: string
  label: string
  sectionId: string
  conditional: boolean
  /** Normalised value, or null when nothing is recorded. */
  value: unknown
  status: AnswerStatus
  source: AnswerSource
  /** The session the canonical answer came from, when it came from a row. */
  sessionId: string | null
  answeredAt: string | null
  /** Earlier rows for this question, newest first. History, never discarded. */
  superseded: SupersededAnswer[]
}

export interface CanonicalSection {
  id: string
  title: string
  answers: CanonicalAnswer[]
  /** How many questions in this section the client gave content for. */
  answeredCount: number
}

export interface CanonicalLegacyField {
  column: string
  label: string
  kind: 'derived' | 'stale'
  value: unknown
}

export interface CanonicalIntakeSession {
  id: string
  status: string
  startedAt: string | null
  completedAt: string | null
  /** `intake_answers` rows written in this session. */
  answerCount: number
  /** True for the session the most canonical answers came from. */
  isCurrent: boolean
}

export interface CanonicalCompletion {
  responseId: string
  isComplete: boolean
  completedSections: number | null
  version: number | null
  linkedCaseId: string | null
  consentToAi: boolean | null
  consentGivenAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface CanonicalIntake {
  memberId: string
  sections: CanonicalSection[]
  /** Fields with no question behind them, that nonetheless hold a value. */
  legacyOnly: CanonicalLegacyField[]
  /** Answer rows with no registry entry. Surfaced, never dropped. */
  unregistered: CanonicalAnswer[]
  /** Every session, newest first. Old sessions are history and stay listed. */
  sessions: CanonicalIntakeSession[]
  /** The `intake_responses` row, or null when the member has none. */
  completion: CanonicalCompletion | null
  /** Questions in the registry that the client gave content for. */
  answeredCount: number
  /** Questions in the registry, total. */
  questionCount: number
}

// ─── Value handling ──────────────────────────────────────────────────────────

/** Is this value empty — reached, but with no content? */
function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') {
    return Object.values(v as Record<string, unknown>).every(
      (x) => x === null || x === undefined || x === '' || (Array.isArray(x) && x.length === 0),
    )
  }
  return false
}

function toSupplementList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean)
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function toSupportLevel(raw: unknown): SupportLevel {
  // The answer store holds the option key the client picked.
  if (typeof raw === 'string' && raw.trim() !== '') {
    return { key: raw, supported: !UNSUPPORTED_KEYS.has(raw) }
  }
  // The legacy column holds only the boolean the form derived from that key,
  // so the key itself is unrecoverable. Say so rather than guessing one.
  if (typeof raw === 'boolean') return { key: null, supported: raw }
  return { key: null, supported: null }
}

/**
 * Normalise a raw value to the question's stable shape. Called for both
 * stores, so a consumer never has to know which one answered.
 */
export function normaliseAnswerValue(question: IntakeQuestion, raw: unknown): unknown {
  if (raw === null || raw === undefined) return null
  switch (question.shape) {
    case 'supplement_list':
      return toSupplementList(raw)
    case 'support_level':
      return toSupportLevel(raw)
    default:
      return raw
  }
}

/** Does a normalised value carry content? Shape-aware. */
function hasContent(question: IntakeQuestion, normalised: unknown): boolean {
  if (question.shape === 'support_level') {
    const s = normalised as SupportLevel
    return s.key !== null || s.supported !== null
  }
  return !isEmptyValue(normalised)
}

// ─── Row shapes ──────────────────────────────────────────────────────────────

interface AnswerRow {
  id: string
  session_id: string
  question_id: string
  section_id: string | null
  answer: unknown
  answered_at: string | null
  updated_at: string | null
}

// ─── The reader ──────────────────────────────────────────────────────────────

/**
 * Read one client's canonical Intake.
 *
 * Reads `intake_answers`, `intake_responses` and `intake_sessions`. Writes
 * nothing. Safe to call with an authenticated client (RLS applies) or the
 * service role; it grants nothing of its own.
 */
export async function getCanonicalIntake(
  supabase: ReadClient,
  memberId: string,
): Promise<CanonicalIntake> {
  const [answersRes, responseRes, sessionsRes] = await Promise.all([
    supabase
      .from('intake_answers')
      .select('id, session_id, question_id, section_id, answer, answered_at, updated_at')
      .eq('member_id', memberId)
      // CANONICAL_ANSWER_ORDER — see the constant for why each key is here.
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('answered_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false }),
    supabase.from('intake_responses').select('*').eq('member_id', memberId).maybeSingle(),
    supabase
      .from('intake_sessions')
      .select('id, status, started_at, completed_at')
      .eq('member_id', memberId)
      .order('started_at', { ascending: false, nullsFirst: false }),
  ])

  if (answersRes.error) throw answersRes.error
  if (responseRes.error) throw responseRes.error
  if (sessionsRes.error) throw sessionsRes.error

  const rows = (answersRes.data ?? []) as AnswerRow[]
  const legacy = (responseRes.data ?? null) as Record<string, unknown> | null

  // Rows arrive newest-first, so the first row per question is canonical and
  // the rest are its history, already in the right order.
  const canonicalRow = new Map<string, AnswerRow>()
  const supersededRows = new Map<string, AnswerRow[]>()
  const answerCountBySession = new Map<string, number>()

  for (const r of rows) {
    answerCountBySession.set(r.session_id, (answerCountBySession.get(r.session_id) ?? 0) + 1)
    if (!canonicalRow.has(r.question_id)) {
      canonicalRow.set(r.question_id, r)
      continue
    }
    const prior = supersededRows.get(r.question_id) ?? []
    prior.push(r)
    supersededRows.set(r.question_id, prior)
  }

  function resolve(question: IntakeQuestion): CanonicalAnswer {
    const row = canonicalRow.get(question.id)
    const superseded: SupersededAnswer[] = (supersededRows.get(question.id) ?? []).map((r) => ({
      sessionId: r.session_id,
      value: normaliseAnswerValue(question, r.answer),
      answeredAt: r.answered_at,
      updatedAt: r.updated_at,
    }))

    // RULE 1 — a present answer row always wins, blank included.
    if (row) {
      const value = normaliseAnswerValue(question, row.answer)
      return {
        questionId: question.id,
        label: question.label,
        sectionId: question.sectionId,
        conditional: question.conditional === true,
        value,
        status: hasContent(question, value) ? 'answered' : 'blank',
        source: 'answer',
        sessionId: row.session_id,
        answeredAt: row.answered_at,
        superseded,
      }
    }

    // RULE 2 — the legacy column is a fallback, reached only with no row.
    if (question.legacyColumn && legacy) {
      const raw = legacy[question.legacyColumn]
      if (raw !== null && raw !== undefined) {
        const value = normaliseAnswerValue(question, raw)
        return {
          questionId: question.id,
          label: question.label,
          sectionId: question.sectionId,
          conditional: question.conditional === true,
          value,
          status: hasContent(question, value) ? 'answered' : 'blank',
          source: 'legacy_column',
          sessionId: null,
          answeredAt: null,
          superseded,
        }
      }
    }

    return {
      questionId: question.id,
      label: question.label,
      sectionId: question.sectionId,
      conditional: question.conditional === true,
      value: null,
      status: 'unanswered',
      source: 'absent',
      sessionId: null,
      answeredAt: null,
      superseded,
    }
  }

  const sections: CanonicalSection[] = INTAKE_SECTIONS.map((s) => {
    const answers = s.questions.map(resolve)
    return {
      id: s.id,
      title: s.title,
      answers,
      answeredCount: answers.filter((a) => a.status === 'answered').length,
    }
  })

  // Answer rows this registry does not know about. A question that was asked
  // and stored must be visible even when nobody has labelled it yet.
  const unregistered: CanonicalAnswer[] = []
  for (const [questionId, row] of canonicalRow) {
    if (getIntakeQuestion(questionId)) continue
    const pseudo: IntakeQuestion = {
      id: questionId,
      label: questionId,
      sectionId: row.section_id ?? '',
      legacyColumn: null,
    }
    const value = normaliseAnswerValue(pseudo, row.answer)
    unregistered.push({
      questionId,
      label: questionId,
      sectionId: row.section_id ?? '',
      conditional: false,
      value,
      status: hasContent(pseudo, value) ? 'answered' : 'blank',
      source: 'answer',
      sessionId: row.session_id,
      answeredAt: row.answered_at,
      superseded: (supersededRows.get(questionId) ?? []).map((r) => ({
        sessionId: r.session_id,
        value: r.answer,
        answeredAt: r.answered_at,
        updatedAt: r.updated_at,
      })),
    })
  }

  // Columns with no question behind them, shown only when they hold a value.
  const legacyOnly: CanonicalLegacyField[] = legacy
    ? LEGACY_ONLY_FIELDS.filter(
        (f) => legacy[f.column] !== null && legacy[f.column] !== undefined,
      ).map((f) => ({ ...f, value: legacy[f.column] }))
    : []

  // Any remaining column that is neither metadata, nor mirrored by a question,
  // nor a known legacy-only field. Belt and braces against a column being
  // added to the table and silently never reaching a reader.
  if (legacy) {
    const accountedFor = new Set<string>([
      ...RESPONSE_METADATA_COLUMNS,
      ...LEGACY_ONLY_FIELDS.map((f) => f.column),
      ...INTAKE_SECTIONS.flatMap((s) =>
        s.questions.map((q) => q.legacyColumn).filter((c): c is string => c !== null),
      ),
    ])
    for (const [column, value] of Object.entries(legacy)) {
      if (accountedFor.has(column)) continue
      if (value === null || value === undefined) continue
      legacyOnly.push({ column, label: column, kind: 'stale', value })
    }
  }

  const canonicalSessionIds = new Set(
    [...canonicalRow.values()].map((r) => r.session_id),
  )

  const sessions: CanonicalIntakeSession[] = (sessionsRes.data ?? []).map((s) => ({
    id: s.id,
    status: s.status,
    startedAt: s.started_at ?? null,
    completedAt: s.completed_at ?? null,
    answerCount: answerCountBySession.get(s.id) ?? 0,
    isCurrent: canonicalSessionIds.has(s.id),
  }))

  const completion: CanonicalCompletion | null = legacy
    ? {
        responseId: String(legacy.id),
        isComplete: legacy.is_complete === true,
        completedSections:
          typeof legacy.completed_sections === 'number' ? legacy.completed_sections : null,
        version: typeof legacy.version === 'number' ? legacy.version : null,
        linkedCaseId: typeof legacy.case_id === 'string' ? legacy.case_id : null,
        consentToAi:
          typeof legacy.consent_to_ai_analysis === 'boolean' ? legacy.consent_to_ai_analysis : null,
        consentGivenAt:
          typeof legacy.consent_given_at === 'string' ? legacy.consent_given_at : null,
        createdAt: typeof legacy.created_at === 'string' ? legacy.created_at : null,
        updatedAt: typeof legacy.updated_at === 'string' ? legacy.updated_at : null,
      }
    : null

  const questionCount = sections.reduce((n, s) => n + s.answers.length, 0)
  const answeredCount = sections.reduce((n, s) => n + s.answeredCount, 0)

  return {
    memberId,
    sections,
    legacyOnly,
    unregistered,
    sessions,
    completion,
    answeredCount,
    questionCount,
  }
}
