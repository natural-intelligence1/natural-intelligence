'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@natural-intelligence/db'
import { revalidatePath } from 'next/cache'
import {
  getPersonalisationForGeneration,
}                              from '@natural-intelligence/db/personalisation'
import {
  buildPersonalisationBlock,
  buildSignatureQuestionBlock,
  buildBestSelfBlock,
  buildEnergyTimingBlock,
  isIslamicFramingEnabled,
}                              from '@natural-intelligence/db/prompts'

// ─── Types ────────────────────────────────────────────────────────────────────

type IntakeRow = Record<string, unknown> | null

interface RootfinderResult {
  confidence_score: number | null
  root_causes: { name: string; description: string | null; key: string } | null
}

interface BiomarkerResult {
  marker_name: string
  value: number | null
  unit: string | null
  functional_zone: number | null
  ni_interpretation: string | null
  gp_interpretation: string | null
}

interface Profile {
  full_name: string | null
  onboarding_intent: string | null
}

// ─── generateHealthSynopsis ───────────────────────────────────────────────────
// Called from completeIntake (fire-and-forget) or directly from the synopsis
// page (regenerate). Uses admin client for ai_summaries writes.
export async function generateHealthSynopsis(memberId: string): Promise<{
  status: 'success' | 'insufficient_data' | 'error'
  summaryId?: string
}> {
  const adminClient = createAdminClient()
  const startMs = Date.now()

  try {
    const [
      { data: intake },
      { data: intakeAnswers },
      { data: rootfinderResults },
      { data: biomarkerResults },
      { data: profile },
      personalisation,
    ] = await Promise.all([
      adminClient
        .from('intake_responses')
        .select('*')
        .eq('member_id', memberId)
        .eq('is_complete', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Task 3 (expanded) — several Tier A/B signals are persisted to
      // intake_answers, not intake_responses (PEM, severity baseline, energy
      // timing, aggravating/relieving factors). The synopsis was blind to all
      // of them. Fetch them here and thread into the prompt (same answerMap
      // pattern as the body story).
      adminClient
        .from('intake_answers')
        .select('question_id, answer')
        .eq('member_id', memberId),
      adminClient
        .from('rootfinder_results')
        .select('confidence_score, root_causes(name, description, key)')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(5),
      adminClient
        .from('biomarker_results')
        .select('marker_name, value, unit, functional_zone, ni_interpretation, gp_interpretation')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(20),
      adminClient
        .from('profiles')
        .select('full_name, onboarding_intent')
        .eq('id', memberId)
        .single(),
      getPersonalisationForGeneration(adminClient, memberId),
    ])

    const hasBiomarkers = (biomarkerResults?.length ?? 0) > 0
    const hasRootfinder  = (rootfinderResults?.length ?? 0) > 0

    // PS.4 — structured logging (small M3 extension matching the body_story
    // pattern). biological_sex + derived boolean ONLY; religion value never
    // logged.
    console.log(JSON.stringify({
      event:                  'health_synopsis.start',
      user_id:                memberId,
      biological_sex:         personalisation.biologicalSex,
      islamic_framing_enabled: isIslamicFramingEnabled(personalisation),
    }))

    if (!intake && !hasBiomarkers && !hasRootfinder) {
      console.log(JSON.stringify({ event: 'health_synopsis.insufficient_data', user_id: memberId }))
      return { status: 'insufficient_data' }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured')
    }

    // PS.4 — prepend personalisation block. CLIENT CONTEXT sits first so the
    // model has demographic/framing context before reading its role/task.
    // Sprint B Phase 1 — additionally prepend the signature-question block
    // when populated, so the synopsis opens by acknowledging the question
    // the user came in with.
    const intakeRowForPrompt = intake as {
      most_want_to_understand?: string | null
      timeline_last_well?:      string | null
      best_self_description?:   string | null
      best_self_sleep?:         string | null
      best_self_energy?:        string | null
      best_self_mood?:          string | null
      best_self_recovery_goal?: string | null
    } | null
    const mostWantToUnderstand = intakeRowForPrompt?.most_want_to_understand ?? null
    // Task 3 (expanded) — answer map from intake_answers, curated below into
    // the user prompt. Energy timing also feeds a dedicated context block in
    // the system prompt, mirroring the body story.
    const answerMap: Record<string, unknown> = {}
    for (const row of intakeAnswers ?? []) {
      answerMap[row.question_id] = row.answer
    }
    const energyTiming = {
      energyLowTimes: Array.isArray(answerMap['energy_low_times'])
        ? (answerMap['energy_low_times'] as unknown[]).map(String)
        : null,
      energyCurve: typeof answerMap['energy_curve'] === 'string'
        ? (answerMap['energy_curve'] as string)
        : null,
    }
    // Sprint B Phase 2 — Best Self Baseline block, between the signature
    // question and the clinical context (same ordering as the body story).
    const systemPrompt = [
      buildSignatureQuestionBlock(mostWantToUnderstand),
      buildBestSelfBlock({
        timelineLastWell:     intakeRowForPrompt?.timeline_last_well     ?? null,
        bestSelfDescription:  intakeRowForPrompt?.best_self_description  ?? null,
        bestSelfSleep:        intakeRowForPrompt?.best_self_sleep        ?? null,
        bestSelfEnergy:       intakeRowForPrompt?.best_self_energy       ?? null,
        bestSelfMood:         intakeRowForPrompt?.best_self_mood         ?? null,
        bestSelfRecoveryGoal: intakeRowForPrompt?.best_self_recovery_goal ?? null,
      }),
      buildEnergyTimingBlock(energyTiming),
      buildPersonalisationBlock(personalisation),
      `You are a clinical health intelligence analyst working for Natural Intelligence, a UK-based integrative health platform. Your role is to synthesise a member's health data — including their self-reported intake form, any biomarker results from uploaded lab reports, and root cause analysis outputs — into a clear, personalised health synopsis.

Write in warm, plain English that a health-conscious non-clinician can understand. Do not use medical jargon without explanation. The synopsis should:
- Open with 1–2 sentences summarising the member's overall health picture
- Address their chief complaints and how they relate to any biomarker or root cause findings
- Highlight 2–3 priority areas for attention (without being alarmist)
- Close with 2–3 practical, evidenced-based actions the member can take
- Be honest about data limitations (e.g. if no lab data exists, say so)

Format: use plain paragraphs. You may use short bullet lists (starting with -) for action items only. Maximum 400 words. No markdown headers. No diagnosis — you are providing health intelligence, not medical advice.`,
    ].filter(Boolean).join('\n\n')

    const userPrompt = buildSynopsisPrompt({
      intake: intake as IntakeRow,
      answers: answerMap,
      rootfinderResults: (rootfinderResults ?? []) as RootfinderResult[],
      biomarkerResults:  (biomarkerResults ?? [])  as BiomarkerResult[],
      profile: profile as Profile | null,
    })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 2000,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const content = message.content[0]?.type === 'text' ? message.content[0].text : ''
    if (!content) throw new Error('Claude returned empty content')

    // Short version: first sentence (up to 200 chars)
    const firstSentenceEnd = content.indexOf('. ')
    const content_short = content
      .slice(0, Math.min(200, firstSentenceEnd > 0 ? firstSentenceEnd + 1 : 200))
      .trim()

    // Retire previous current synopsis
    await adminClient
      .from('ai_summaries')
      .update({ is_current: false })
      .eq('member_id', memberId)
      .eq('summary_type', 'health_synopsis')
      .eq('is_current', true)

    const { data: inserted } = await adminClient
      .from('ai_summaries')
      .insert({
        member_id:        memberId,
        summary_type:     'health_synopsis',
        content,
        content_short,
        source_intake_id: (intake as any)?.id ?? null,
        model_used:       'claude-opus-4-5',
        confidence:       determineConfidence(
          intake as IntakeRow,
          biomarkerResults as BiomarkerResult[] | null,
          rootfinderResults as RootfinderResult[] | null,
        ),
        is_current:       true,
        generated_at:     new Date().toISOString(),
      })
      .select('id')
      .single()

    revalidatePath('/dashboard/synopsis')
    revalidatePath('/dashboard')

    console.log(JSON.stringify({
      event:        'health_synopsis.success',
      user_id:      memberId,
      duration_ms:  Date.now() - startMs,
      input_tokens:  message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    }))

    return { status: 'success', summaryId: inserted?.id }

  } catch (err) {
    const errAny = err as { message?: string }
    const errorCode = errAny?.message ?? (err instanceof Error ? err.message : String(err))
    console.log(JSON.stringify({ event: 'health_synopsis.failure', user_id: memberId, error_code: errorCode, duration_ms: Date.now() - startMs }))
    console.error('[generateHealthSynopsis] error:', err)
    return { status: 'error' }
  }
}

// ─── rateSynopsis ─────────────────────────────────────────────────────────────
export async function rateSynopsis(synopsisId: string, rating: number): Promise<void> {
  const adminClient = createAdminClient()
  await adminClient
    .from('ai_summaries')
    .update({ member_rating: rating })
    .eq('id', synopsisId)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSynopsisPrompt(params: {
  intake: IntakeRow
  answers: Record<string, unknown>
  rootfinderResults: RootfinderResult[]
  biomarkerResults:  BiomarkerResult[]
  profile:           Profile | null
}): string {
  const { intake, answers, rootfinderResults, biomarkerResults, profile } = params
  const lines: string[] = []

  lines.push(`Member name: ${profile?.full_name ?? 'Unknown'}`)
  lines.push(`Onboarding intent: ${profile?.onboarding_intent ?? 'Not specified'}`)
  lines.push('')

  if (intake) {
    lines.push('=== INTAKE FORM ===')
    const i = intake as Record<string, unknown>
    // Remediation Task 3 — field names repaired against the live
    // intake_responses schema. The prompt previously read column names that
    // do not exist (chief_complaints, complaint_duration, complaint_severity,
    // existing_conditions, previous_practitioners, previous_treatments,
    // diet_type, alcohol_frequency, smoking_status, mood_level,
    // digestion_level, cognitive_level, additional_notes) — every one of
    // those reads silently returned undefined, so the synopsis was built from
    // a fraction of the intake. Renamed the five with a direct equivalent and
    // dropped the eight with no current column (no substitutions invented;
    // severity/alcohol live in intake_answers, the numeric mood/digestion/
    // cognitive "levels" were never collected).
    if (i.primary_concerns)        lines.push(`Chief complaints: ${JSON.stringify(i.primary_concerns)}`)
    if (i.concern_duration)        lines.push(`Duration: ${i.concern_duration}`)
    if (i.symptom_pattern)         lines.push(`Symptom pattern over time: ${i.symptom_pattern}`)
    if (i.timeline_trigger)        lines.push(`What changed / possible trigger: ${i.timeline_trigger}`)
    if (i.diagnosed_conditions)    lines.push(`Existing conditions: ${JSON.stringify(i.diagnosed_conditions)}`)
    if (i.current_medications)     lines.push(`Medications: ${i.current_medications}`)
    if (i.current_supplements)     lines.push(`Supplements: ${i.current_supplements}`)
    if (i.past_treatments)         lines.push(`Previous treatments: ${i.past_treatments}`)
    if (i.diet_description)         lines.push(`Diet: ${i.diet_description}`)
    if (i.exercise_frequency)      lines.push(`Exercise frequency: ${i.exercise_frequency}`)
    if (i.sleep_hours)             lines.push(`Avg sleep hours: ${i.sleep_hours}`)
    if (i.stress_level)            lines.push(`Stress level (1–10): ${i.stress_level}`)
    if (i.energy_level)            lines.push(`Energy (1–10): ${i.energy_level}`)
    if (i.psychosocial_worry)      lines.push(`Main worry about their health: ${i.psychosocial_worry}`)
    if (i.family_history)          lines.push(`Family history: ${i.family_history}`)

    // Task 3 (expanded) — Tier A/B signals sourced from intake_answers.
    // These were previously collected but absent from the synopsis entirely.
    const sev = answers['concern_severity_baseline']
    if (typeof sev === 'number')   lines.push(`Severity impact on daily life (0–10): ${sev}`)
    const pem = answers['post_exertional_worsening']
    if (typeof pem === 'boolean')  lines.push(`Post-exertional worsening (worse the day after exertion): ${pem ? 'Yes' : 'No'}`)
    const aggr = answers['aggravating_factors']
    if (typeof aggr === 'string' && aggr.trim()) lines.push(`What makes it worse: ${aggr.trim()}`)
    const reli = answers['relieving_factors']
    if (typeof reli === 'string' && reli.trim()) lines.push(`What makes it better: ${reli.trim()}`)
    lines.push('')
  } else {
    lines.push('=== INTAKE FORM ===')
    lines.push('No intake form completed.')
    lines.push('')
  }

  if (biomarkerResults.length > 0) {
    lines.push('=== BIOMARKER RESULTS (most recent 20) ===')
    for (const b of biomarkerResults) {
      const zone = b.functional_zone ? ` [Zone ${b.functional_zone}]` : ''
      const interp = b.ni_interpretation ?? b.gp_interpretation ?? ''
      lines.push(`${b.marker_name}: ${b.value ?? 'n/a'} ${b.unit ?? ''}${zone} — ${interp}`)
    }
    lines.push('')
  } else {
    lines.push('=== BIOMARKER RESULTS ===')
    lines.push('No lab reports uploaded.')
    lines.push('')
  }

  if (rootfinderResults.length > 0) {
    lines.push('=== ROOT CAUSE ANALYSIS ===')
    for (const r of rootfinderResults) {
      const rc = r.root_causes
      if (rc) {
        lines.push(`${rc.name} (confidence: ${r.confidence_score ?? 'n/a'})`)
      }
    }
    lines.push('')
  } else {
    lines.push('=== ROOT CAUSE ANALYSIS ===')
    lines.push('No root cause analysis completed.')
    lines.push('')
  }

  lines.push('Please write a personalised health synopsis for this member based on the data above.')

  return lines.join('\n')
}

function determineConfidence(
  intake: IntakeRow,
  biomarkerResults: BiomarkerResult[] | null,
  rootfinderResults: RootfinderResult[] | null,
): string {
  let score = 0
  if (intake)                               score += 2
  if ((biomarkerResults?.length ?? 0) > 0)  score += 2
  if ((rootfinderResults?.length ?? 0) > 0) score += 1

  if (score >= 4) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}
