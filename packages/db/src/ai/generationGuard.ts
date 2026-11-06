// ─── packages/db/src/ai/generationGuard.ts ───────────────────────────────────
// Smallest safe concurrency guard for AI interpretation generation.
//
// WHY. Production evidence, 13 September 2026: one member's four health
// synopses were generated at 23:38:02, :16, :31 and :46 — four full Opus
// calls, four rows, inside 44 seconds. Each click starts a fresh generation
// and retires the previous row. Nothing prevented it.
//
// WHAT THIS IS NOT. Not a queue, not a job runner, not a distributed mutex.
// The Founder ruling was explicit: prevent duplicate simultaneous/recent
// generation for the same member + output type, and do not build a full
// queue/job architecture now.
//
// MECHANISM — two layers, because neither alone is sufficient:
//
//   1. IN-FLIGHT CLAIM (in-process). A module-level map keyed
//      "<memberId>:<output>". Claimed synchronously BEFORE the first await,
//      so two concurrent calls in the same instance cannot both pass: the
//      event loop is single-threaded, so the second sees the claim. Entries
//      carry a TTL (IN_FLIGHT_TTL_MS) and are purged on read, so a frozen or
//      crashed serverless invocation cannot lock a member out permanently —
//      which matters here because the intake-completion path is
//      fire-and-forget and Vercel may freeze it mid-generation.
//
//   2. RECENCY CHECK (shared database). Reads the timestamp of the member's
//      most recent output of that type and refuses inside
//      GENERATION_COOLDOWN_MS. This is the cross-instance layer: the map is
//      per-instance and empty after a cold start, but every instance reads
//      the same database.
//
// HONEST RESIDUAL GAP. Two genuinely simultaneous requests landing on two
// different warm instances, both before either has written a row, are not
// prevented — layer 1 is per-instance and layer 2 has nothing to see yet.
// Closing that needs a database claim (an advisory lock or a generation-runs
// table), which is schema work outside the approved scope. The observed
// failure was sequential clicks seconds apart, which both layers catch.
//
// A LEGITIMATE LATER REGENERATION IS NEVER DISCARDED. The cooldown is 60
// seconds, not a lockout: a member returning minutes later regenerates
// normally. A refusal is reported as a distinct status with retryAfterMs,
// never swallowed and never dressed up as a generation failure.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { InterpretationOutput } from './interpretationFlag'

type AdminClient = SupabaseClient<Database>

/** A second generation of the same output within this window is refused. */
export const GENERATION_COOLDOWN_MS = 60_000

/**
 * How long an unreleased in-flight claim survives. Matches the five-minute
 * timeout the generating UI already uses, so a claim can never outlive the
 * longest generation the interface is prepared to wait for.
 */
export const IN_FLIGHT_TTL_MS = 5 * 60_000

export type GenerationRefusal = 'in_flight' | 'recently_generated' | 'guard_unavailable'

export type GenerationClaim =
  | { allowed: true; release: () => void }
  | { allowed: false; reason: GenerationRefusal; retryAfterMs: number }

/** key -> epoch ms at which the claim expires. */
const inFlight = new Map<string, number>()

function claimKey(memberId: string, output: InterpretationOutput): string {
  return memberId + ':' + output
}

function purgeExpired(now: number): void {
  for (const [key, expiry] of inFlight) {
    if (expiry <= now) inFlight.delete(key)
  }
}

/**
 * The timestamp of the member's most recent output of this type, or null when
 * there is none. Strictly read-only — in particular it must never create a
 * client_cases row, which is why the body-story lookup reads the case rather
 * than calling getOrCreateClientCase.
 */
async function lastGeneratedAt(
  client: AdminClient,
  memberId: string,
  output: InterpretationOutput,
): Promise<{ at: number | null } | { error: string }> {
  if (output === 'health_synopsis') {
    const { data, error } = await client
      .from('ai_summaries')
      .select('created_at')
      .eq('member_id', memberId)
      .eq('summary_type', 'health_synopsis')
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) return { error: error.code + ': ' + error.message }
    const at = data?.[0]?.created_at
    return { at: at ? new Date(at).getTime() : null }
  }

  // Body story writes reasoning_traces, which is keyed by case_id, not
  // member_id. Read the member's active case WITHOUT creating one; no case
  // means nothing has ever been generated, so there is nothing to throttle.
  const { data: cases, error: caseErr } = await client
    .from('client_cases')
    .select('id')
    .eq('client_id', memberId)
    .eq('status', 'active')
  if (caseErr) return { error: caseErr.code + ': ' + caseErr.message }
  const caseIds = (cases ?? []).map((c) => c.id)
  if (caseIds.length === 0) return { at: null }

  const { data, error } = await client
    .from('reasoning_traces')
    .select('created_at')
    .in('case_id', caseIds)
    .eq('trace_type', 'intake_analysis')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return { error: error.code + ': ' + error.message }
  const at = data?.[0]?.created_at
  return { at: at ? new Date(at).getTime() : null }
}

/**
 * Claim the right to generate `output` for `memberId`.
 *
 * On success the caller MUST call release() in a finally block. Forgetting to
 * is survivable — the claim expires after IN_FLIGHT_TTL_MS — but it blocks
 * that member's regeneration until it does.
 *
 * A guard read error refuses rather than proceeding: the cost of refusing is
 * a control that works again on the next attempt, whereas the cost of
 * proceeding blind is another Opus call and another row. The claim is
 * released first, so the refusal does not also impose the five-minute TTL.
 */
export async function claimGeneration(
  client: AdminClient,
  memberId: string,
  output: InterpretationOutput,
  now: number = Date.now(),
): Promise<GenerationClaim> {
  const key = claimKey(memberId, output)
  purgeExpired(now)

  const existing = inFlight.get(key)
  if (existing !== undefined) {
    return { allowed: false, reason: 'in_flight', retryAfterMs: existing - now }
  }

  // Claim BEFORE the await. Two concurrent callers in this instance cannot
  // both get past the check above if the claim is already recorded.
  inFlight.set(key, now + IN_FLIGHT_TTL_MS)

  const last = await lastGeneratedAt(client, memberId, output)

  if ('error' in last) {
    inFlight.delete(key)
    return { allowed: false, reason: 'guard_unavailable', retryAfterMs: 0 }
  }

  if (last.at !== null) {
    const age = now - last.at
    if (age >= 0 && age < GENERATION_COOLDOWN_MS) {
      inFlight.delete(key)
      return {
        allowed: false,
        reason: 'recently_generated',
        retryAfterMs: GENERATION_COOLDOWN_MS - age,
      }
    }
  }

  let released = false
  return {
    allowed: true,
    release: () => {
      if (released) return
      released = true
      inFlight.delete(key)
    },
  }
}

/** Test-only: drop every in-flight claim. Never called by application code. */
export function __resetGenerationClaims(): void {
  inFlight.clear()
}
