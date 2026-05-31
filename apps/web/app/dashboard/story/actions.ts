'use server'

import Anthropic                                         from '@anthropic-ai/sdk'
import { revalidatePath }                                from 'next/cache'
import { createAdminClient }                             from '@natural-intelligence/db'
import { getOrCreateClientCase, createReasoningTrace }  from '@natural-intelligence/db/crt'
import type { TraceEntry }                              from '@natural-intelligence/db/crt'
import {
  getPersonalisationForGeneration,
  type PersonalisationForGeneration,
}                                                       from '@natural-intelligence/db/personalisation'
import {
  buildPersonalisationBlock,
  buildSignatureQuestionBlock,
  isIslamicFramingEnabled,
}                                                       from '@natural-intelligence/db/prompts'

// ─── generateBodyStory ────────────────────────────────────────────────────────
// Reads the member's intake answers, calls Claude, writes a full reasoning trace
// (practitioner entries + client_explanation entries), sets status=client_visible.
//
// Safe to call multiple times — idempotent at the client_case level.
// Calling again will create a new trace (revision history preserved).

export async function generateBodyStory(
  memberId:        string,
  // Optional personalisation override — preserves backwards compatibility.
  // If not passed, fetched inside via getPersonalisationForGeneration.
  personalisation?: PersonalisationForGeneration,
): Promise<{
  status: 'success' | 'insufficient_data' | 'error'
}> {
  const adminClient = createAdminClient()
  const startMs = Date.now()

  try {
    // ── 1. Load intake answers + personalisation ─────────────────────────────
    const [{ data: answers }, { data: intake }, { data: profile }, p] = await Promise.all([
      adminClient
        .from('intake_answers')
        .select('question_id, answer, mapped_systems')
        .eq('member_id', memberId)
        .order('answered_at', { ascending: true }),
      adminClient
        .from('intake_responses')
        // Sprint B Phase 1 — most_want_to_understand added; variable-string
        // select bypasses the not-yet-regenerated Database types validation.
        .select(['primary_concerns', 'primary_system', 'is_complete', 'most_want_to_understand'].join(', '))
        .eq('member_id', memberId)
        .eq('is_complete', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminClient
        .from('profiles')
        .select('full_name')
        .eq('id', memberId)
        .single(),
      personalisation
        ? Promise.resolve(personalisation)
        : getPersonalisationForGeneration(adminClient, memberId),
    ])

    // M3 structured logging — biologicalSex + derived boolean ONLY.
    // Religion value is never logged (only the gate result is).
    console.log(JSON.stringify({
      event:                  'body_story.start',
      user_id:                memberId,
      biological_sex:         p.biologicalSex,
      islamic_framing_enabled: isIslamicFramingEnabled(p),
    }))

    if (!answers || answers.length === 0) {
      console.log(JSON.stringify({ event: 'body_story.insufficient_data', user_id: memberId, reason: 'no_intake_answers' }))
      return { status: 'insufficient_data' }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    // ── 2. Build prompt from answers ──────────────────────────────────────────
    const answerMap: Record<string, unknown> = {}
    for (const row of answers) {
      answerMap[row.question_id] = row.answer
    }

    const userPrompt = buildStoryPrompt(answerMap, intake as Record<string, unknown> | null)

    // ── 3. Call Claude ────────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Sprint B Phase 1 — quote the user's signature-question answer back in
    // the opening of the body story. Empty string when the user skipped, so
    // the prompt joins cleanly.
    const mostWantToUnderstand = (intake as { most_want_to_understand?: string | null } | null)?.most_want_to_understand ?? null
    const systemPrompt = buildBodyStorySystemPrompt(p, mostWantToUnderstand)

    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    if (!raw) throw new Error('Claude returned empty content')

    // ── 4. Parse structured response ──────────────────────────────────────────
    const parsed = parseClaudeResponse(raw)

    // ── 5. Create / retrieve client case ─────────────────────────────────────
    const primaryConcern = Array.isArray(answerMap['primary_concerns'])
      ? (answerMap['primary_concerns'] as string[])[0]
      : (answerMap['primary_concerns'] as string | undefined)

    // intake typed loosely because the select string is a variable (needed
    // to include most_want_to_understand before generated DB types are
    // regenerated).
    const intakeRow = intake as { primary_concerns?: string[] | null; most_want_to_understand?: string | null } | null
    const caseId = await getOrCreateClientCase(adminClient, memberId, {
      primaryConcern: primaryConcern ?? intakeRow?.primary_concerns?.[0] ?? undefined,
    })

    // ── 6. Build trace entries ────────────────────────────────────────────────
    const entries: TraceEntry[] = [
      // Practitioner-visible reasoning
      ...parsed.observations.map((obs, i): TraceEntry => ({
        agent_name:  'case_historian',
        entry_type:  'observation',
        content:     obs,
        system_area: parsed.systems[i % parsed.systems.length] ?? null,
        visibility:  'practitioner',
        priority:    i + 1,
      })),
      ...parsed.hypotheses.map((h, i): TraceEntry => ({
        agent_name:     'root_cause',
        entry_type:     'hypothesis',
        content:        h.statement,
        system_area:    h.system,
        hypothesis_key: h.key,
        confidence:     h.confidence,
        visibility:     'practitioner',
        priority:       i + 1,
      })),
      ...parsed.evidence.map((e): TraceEntry => ({
        agent_name:   'root_cause',
        entry_type:   'evidence_for',
        content:      e,
        visibility:   'practitioner',
      })),
      {
        agent_name:  'root_cause',
        entry_type:  'weighting',
        content:     `Primary systems involved: ${parsed.systems.join(', ')}. Leading hypothesis: ${parsed.hypotheses[0]?.key ?? 'general_dysregulation'}.`,
        visibility:  'practitioner',
      },
      {
        agent_name:  'protocol_builder',
        entry_type:  'decision',
        content:     parsed.decision,
        visibility:  'practitioner',
      },

      // Client-visible narrative
      {
        agent_name:  'protocol_builder',
        entry_type:  'client_explanation',
        system_area: 'systems_involved',
        content:     JSON.stringify(parsed.systems),
        visibility:  'client',
      },
      {
        agent_name:  'protocol_builder',
        entry_type:  'client_explanation',
        system_area: 'body_story',
        content:     parsed.body_story,
        visibility:  'client',
      },
      {
        agent_name:  'protocol_builder',
        entry_type:  'client_explanation',
        system_area: 'future_self',
        content:     parsed.future_self,
        visibility:  'client',
      },
    ]

    // ── 7. Write trace to DB ──────────────────────────────────────────────────
    await createReasoningTrace(adminClient, {
      caseId,
      traceType:   'intake_analysis',
      generatedBy: 'ai',
      summary:     `Systems: ${parsed.systems.join(', ')}. ${parsed.hypotheses[0]?.statement ?? ''}`,
      entries,
    })

    revalidatePath('/dashboard/story')
    revalidatePath('/dashboard')

    console.log(JSON.stringify({
      event:        'body_story.success',
      user_id:      memberId,
      trace_id:     caseId,
      duration_ms:  Date.now() - startMs,
      input_tokens:  message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    }))

    return { status: 'success' }

  } catch (err) {
    const errAny = err as { message?: string }
    const errorCode = errAny?.message ?? (err instanceof Error ? err.message : String(err))
    console.log(JSON.stringify({ event: 'body_story.failure', user_id: memberId, error_code: errorCode, duration_ms: Date.now() - startMs }))
    console.error('[generateBodyStory] error:', err)
    return { status: 'error' }
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────
//
// PS.4 — the system prompt is now built per request so the personalisation
// CLIENT CONTEXT block can be prepended. The personalisation block sits
// FIRST so the model has client context before reading its role/task. The
// existing role/task/format/tone content follows unchanged.

function buildBodyStorySystemPrompt(
  p: PersonalisationForGeneration,
  mostWantToUnderstand: string | null,
): string {
  // Sprint B Phase 1 — signature block prepended when the user answered the
  // "what would you most want to understand" question. Empty string when
  // skipped (the .filter(Boolean) drops it cleanly).
  return [
    buildSignatureQuestionBlock(mostWantToUnderstand),
    buildPersonalisationBlock(p),
    BODY_STORY_PROMPT_BODY,
  ].filter(Boolean).join('\n\n')
}

const BODY_STORY_PROMPT_BODY = `You are a clinical reasoning engine for Natural Intelligence, a UK integrative health platform.

Your task: analyse a member's health intake and generate a structured Clinical Reasoning Trace.

Return ONLY valid JSON — no markdown, no explanation, no preamble. The JSON must match this exact structure:

{
  "systems": ["system1", "system2"],
  "observations": ["observation 1", "observation 2", "observation 3"],
  "hypotheses": [
    {
      "key": "hypothesis_key",
      "statement": "The hypothesis statement",
      "system": "system_area",
      "confidence": 0.75
    }
  ],
  "evidence": ["evidence point 1", "evidence point 2"],
  "decision": "The clinical decision statement explaining what to address and why.",
  "body_story": "FULL My Body's Story narrative — see format below",
  "future_self": "FULL Your Future Self narrative — see format below"
}

SYSTEMS must be 1–2 from: digestion, energy, hormonal, cognitive, immune, nervous_system, metabolic, sleep

BODY_STORY format (follow strictly, plain prose):
Your symptoms are not random — they appear to be connected.

The pattern we see centres around [1-2 systems].

From [their history], it looks like [mechanism explanation — cause → effect].

This can lead to:
- [symptom 1]
- [symptom 2]
- [symptom 3]

[Behavioural context — food/lifestyle observation].

This doesn't point to a single issue — it points to a system that needs support and rebalancing.

This pattern is more common than it seems — and it's something we can work with.

FUTURE_SELF format (follow strictly, plain prose):
If we follow this path step by step, here's what we would expect to change over time.

In the first few weeks:
- [change 1]
- [change 2]
- [change 3]

After 4–8 weeks:
- [change 1]
- [change 2]
- [change 3]

Over the following months:
- [change 1]
- [change 2]
- [change 3]

This is not about quick fixes.

It's about giving your body the conditions it needs to stabilise and recover.

We'll adjust the plan as your body responds — so this path stays aligned with you.

TONE RULES:
- Calm, precise, non-alarmist
- Intelligent but human
- No diagnosis language ("you have", "you suffer from", "diagnosed")
- No certainty language ("will definitely", "guaranteed")
- No percentages or confidence scores in client text
- No alarming medical speculation
- Hopeful but grounded for future_self section`

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildStoryPrompt(
  answers: Record<string, unknown>,
  intake:  Record<string, unknown> | null,
): string {
  const lines: string[] = ['=== MEMBER INTAKE ANSWERS ===', '']

  const field = (key: string, label: string) => {
    const val = answers[key] ?? intake?.[key]
    if (val === null || val === undefined || val === '') return
    lines.push(`${label}: ${Array.isArray(val) ? val.join(', ') : String(val)}`)
  }

  field('arrival_emotion',          'Arrival emotion')
  field('primary_concerns',         'Primary concerns')
  field('concern_severity_baseline','Severity impact on daily life (0–10)')
  field('symptom_onset',            'When symptoms started')
  field('timeline_last_well',       'Last time felt well')
  field('timeline_trigger',         'Possible trigger event')
  field('timeline_trigger_type',    'Trigger type')
  field('diagnosed_conditions',     'Diagnosed conditions')
  field('past_treatments',          'Past treatments tried')
  field('current_medications',      'Current medications')
  field('current_supplements',      'Current supplements')
  field('family_history',           'Family history')
  field('aggravating_factors',      'What makes it worse')
  field('relieving_factors',        'What makes it better')
  field('post_exertional_worsening','Symptoms worsen after physical/mental exertion')
  field('gi_stool_frequency',       'Bowel movements per day')
  field('food_symptom_link',        'Food-symptom connections')
  field('diet_description',         'Diet description')
  field('exercise_frequency',       'Exercise frequency')
  field('sleep_hours',              'Average sleep hours')
  field('sleep_quality',            'Sleep quality')
  field('stress_level',             'Stress level (1–10)')
  field('caffeine_intake',          'Caffeine intake')
  field('alcohol_intake',           'Alcohol intake')
  field('menstrual_status',         'Menstrual status')
  field('menstrual_cycle_length',   'Menstrual cycle length (days)')
  field('menstrual_flow_heaviness', 'Menstrual flow heaviness (1–5)')
  field('psychosocial_worry',       'Main worry/stress')
  field('psychosocial_impact',      'Emotional/social impact')
  field('working_with_practitioners','Currently working with practitioners')
  // Sprint B Phase 1 deletions — practitioner_types, health_goals,
  // readiness_change, timeline_expectation removed from intake; references
  // in the prompt builder dropped accordingly.

  lines.push('')
  lines.push('Generate the Clinical Reasoning Trace JSON for this member.')

  return lines.join('\n')
}

// ─── Response parser ──────────────────────────────────────────────────────────

interface ClaudeStoryResponse {
  systems:      string[]
  observations: string[]
  hypotheses:   Array<{ key: string; statement: string; system: string; confidence: number }>
  evidence:     string[]
  decision:     string
  body_story:   string
  future_self:  string
}

function parseClaudeResponse(raw: string): ClaudeStoryResponse {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  let parsed: ClaudeStoryResponse

  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Claude response was not valid JSON: ${cleaned.slice(0, 200)}`)
  }

  // Validate required fields
  if (!parsed.body_story || !parsed.future_self) {
    throw new Error('Claude response missing body_story or future_self')
  }

  return {
    systems:      Array.isArray(parsed.systems)      ? parsed.systems      : [],
    observations: Array.isArray(parsed.observations) ? parsed.observations : [],
    hypotheses:   Array.isArray(parsed.hypotheses)   ? parsed.hypotheses   : [],
    evidence:     Array.isArray(parsed.evidence)     ? parsed.evidence     : [],
    decision:     parsed.decision     ?? '',
    body_story:   parsed.body_story,
    future_self:  parsed.future_self,
  }
}
