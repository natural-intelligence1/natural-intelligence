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
    const mostWantToUnderstand = (intake as { most_want_to_understand?: string | null } | null)?.most_want_to_understand ?? null
    const systemPrompt = [
      buildSignatureQuestionBlock(mostWantToUnderstand),
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
    const errorCode = err instanceof Error ? err.message : String(err)
    const errorStack = err instanceof Error ? (err.stack ?? '').slice(0, 600) : ''
    console.log(JSON.stringify({ event: 'health_synopsis.failure', user_id: memberId, error_code: errorCode, duration_ms: Date.now() - startMs }))
    // TEMP DEBUG — Sprint B closure diagnostic. Remove before final commit.
    console.log(JSON.stringify({ event: 'health_synopsis.debug.failure_detail', user_id: memberId, error_code_full: errorCode, error_stack_head: errorStack }))
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
  rootfinderResults: RootfinderResult[]
  biomarkerResults:  BiomarkerResult[]
  profile:           Profile | null
}): string {
  const { intake, rootfinderResults, biomarkerResults, profile } = params
  const lines: string[] = []

  lines.push(`Member name: ${profile?.full_name ?? 'Unknown'}`)
  lines.push(`Onboarding intent: ${profile?.onboarding_intent ?? 'Not specified'}`)
  lines.push('')

  if (intake) {
    lines.push('=== INTAKE FORM ===')
    const i = intake as Record<string, unknown>
    if (i.chief_complaints)        lines.push(`Chief complaints: ${JSON.stringify(i.chief_complaints)}`)
    if (i.complaint_duration)      lines.push(`Duration: ${i.complaint_duration}`)
    if (i.complaint_severity)      lines.push(`Severity (1–10): ${i.complaint_severity}`)
    if (i.existing_conditions)     lines.push(`Existing conditions: ${JSON.stringify(i.existing_conditions)}`)
    if (i.current_medications)     lines.push(`Medications: ${i.current_medications}`)
    if (i.current_supplements)     lines.push(`Supplements: ${i.current_supplements}`)
    if (i.previous_practitioners)  lines.push(`Practitioners seen: ${JSON.stringify(i.previous_practitioners)}`)
    if (i.previous_treatments)     lines.push(`Previous treatments: ${i.previous_treatments}`)
    if (i.diet_type)               lines.push(`Diet type: ${i.diet_type}`)
    if (i.exercise_frequency)      lines.push(`Exercise frequency: ${i.exercise_frequency}`)
    if (i.sleep_hours)             lines.push(`Avg sleep hours: ${i.sleep_hours}`)
    if (i.stress_level)            lines.push(`Stress level (1–10): ${i.stress_level}`)
    if (i.alcohol_frequency)       lines.push(`Alcohol: ${i.alcohol_frequency}`)
    if (i.smoking_status)          lines.push(`Smoking: ${i.smoking_status}`)
    if (i.energy_level)            lines.push(`Energy (1–10): ${i.energy_level}`)
    if (i.mood_level)              lines.push(`Mood (1–10): ${i.mood_level}`)
    if (i.digestion_level)         lines.push(`Digestion (1–10): ${i.digestion_level}`)
    if (i.cognitive_level)         lines.push(`Cognitive function (1–10): ${i.cognitive_level}`)
    if (i.family_history)          lines.push(`Family history: ${i.family_history}`)
    // Sprint B Phase 1 deletion — health_goals removed from intake; the
    // line above for the synopsis prompt is dropped.
    if (i.additional_notes)        lines.push(`Additional notes: ${i.additional_notes}`)
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
