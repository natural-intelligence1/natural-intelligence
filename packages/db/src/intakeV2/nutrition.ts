// ─── packages/db/src/intakeV2/nutrition.ts ───────────────────────────────────
// Nutrition in three separated layers, therapeutic aims, and outcome measures.
//
// The separation is the point. Collapsing these three into one "nutrition
// plan" is what turns a record into advice, so they are distinct types that
// cannot be assigned to one another:
//
//   LAYER 1 — WHAT THE CLIENT EATS NOW.      Client-reported. Factual.
//   LAYER 2 — WHAT THE CLIENT BELIEVES.      Client-reported, held as belief,
//                                            never promoted to fact.
//   LAYER 3 — WHAT THE PRACTITIONER ADVISES. Practitioner-authored only, and
//                                            only inside a signed protocol.
//
// NI may organise and present layers 1 and 2. It may never author layer 3:
// `practitionerAdvice()` requires a practitioner actor and a protocol version,
// and there is no code path that creates one without both.
//
// THERAPEUTIC AIMS are what the practitioner is working towards, in the
// client's terms where possible. An aim is not a prediction and not a promise.
//
// OUTCOME MEASURES are how change will be noticed. Every measure is either
// client-rated or an external record; NI never scores, grades or interprets
// one, and a measure has no target the client can fail.

import type { V2SourcedFact } from './provenance'
import { clientReported, systemOrganised } from './provenance'

/** The provenance helpers take a value only; `capturedAt` is a field on the
 *  fact. These wrappers keep the "when" attached at the point of capture. */
const said = <T,>(value: T, at: string): V2SourcedFact<T> =>
  ({ ...clientReported(value), capturedAt: at })
const organised = <T,>(value: T, at: string): V2SourcedFact<T> =>
  ({ ...systemOrganised(value), capturedAt: at })

export const NUTRITION_LAYERS = ['current_intake', 'client_belief', 'practitioner_advice'] as const
export type NutritionLayer = (typeof NUTRITION_LAYERS)[number]

export const NUTRITION_LAYER_LABELS: Record<NutritionLayer, string> = {
  current_intake:       'What you eat now',
  client_belief:        'What you believe about food',
  practitioner_advice:  'What your practitioner advises',
}

// ─── Layer 1 — current intake (client-reported fact) ─────────────────────────

export interface CurrentIntakeEntry {
  id: string
  layer: 'current_intake'
  /** What they eat or drink, in their words where they gave words. */
  item: V2SourcedFact<string>
  /** Typical pattern, as reported. Absent is absent — never inferred. */
  frequency?: V2SourcedFact<string | null>
  context?: V2SourcedFact<string | null>
  capturedAt: string
}

export function currentIntake(args: {
  id: string; item: string; frequency?: string | null; context?: string | null
  capturedAt: string
}): CurrentIntakeEntry {
  return {
    id: args.id,
    layer: 'current_intake',
    item: said(args.item, args.capturedAt),
    frequency: args.frequency === undefined
      ? undefined : said(args.frequency, args.capturedAt),
    context: args.context === undefined
      ? undefined : said(args.context, args.capturedAt),
    capturedAt: args.capturedAt,
  }
}

// ─── Layer 2 — client belief (held as belief, never as fact) ─────────────────

export interface ClientBeliefEntry {
  id: string
  layer: 'client_belief'
  /** Their statement, verbatim. This is the belief, not a finding. */
  statement: V2SourcedFact<string>
  /** What the belief concerns, where they named it. */
  about?: string | null
  /** Set only by a practitioner who has discussed it. Never set by NI, and
   *  'unreviewed' is the only state NI can produce. */
  reviewState: 'unreviewed' | 'discussed_with_client'
  capturedAt: string
}

export function clientBelief(args: {
  id: string; statement: string; about?: string | null; capturedAt: string
}): ClientBeliefEntry {
  return {
    id: args.id,
    layer: 'client_belief',
    statement: said(args.statement, args.capturedAt),
    about: args.about ?? null,
    reviewState: 'unreviewed',
    capturedAt: args.capturedAt,
  }
}

// ─── Layer 3 — practitioner advice (signed protocol only) ────────────────────

export interface PractitionerAdviceEntry {
  id: string
  layer: 'practitioner_advice'
  instruction: string
  amount?: string | null
  frequency?: string | null
  duration?: string | null
  /** Why, for the client. Plain, and the practitioner's own words. */
  rationaleForClient?: string | null
  /** Required. There is no unattributed advice. */
  authoredBy: string
  /** Required. Advice exists only as part of a signed protocol version. */
  protocolVersion: number
  authoredAt: string
}

export type AdviceRefusal = 'no_author' | 'no_protocol_version' | 'no_instruction'

export interface AdviceResult {
  advice: PractitionerAdviceEntry | null
  refusedReason?: AdviceRefusal
}

/**
 * The only constructor for layer 3. Refuses without a named practitioner and a
 * protocol version, so nutrition advice cannot exist outside a signed,
 * attributable protocol.
 */
export function practitionerAdvice(args: {
  id: string; instruction: string
  amount?: string | null; frequency?: string | null; duration?: string | null
  rationaleForClient?: string | null
  authoredBy: string | null; protocolVersion: number | null; authoredAt: string
}): AdviceResult {
  if (!args.authoredBy) return { advice: null, refusedReason: 'no_author' }
  if (args.protocolVersion === null || args.protocolVersion === undefined) {
    return { advice: null, refusedReason: 'no_protocol_version' }
  }
  if (!args.instruction.trim()) return { advice: null, refusedReason: 'no_instruction' }

  return {
    advice: {
      id: args.id,
      layer: 'practitioner_advice',
      instruction: args.instruction,
      amount: args.amount ?? null,
      frequency: args.frequency ?? null,
      duration: args.duration ?? null,
      rationaleForClient: args.rationaleForClient ?? null,
      authoredBy: args.authoredBy,
      protocolVersion: args.protocolVersion,
      authoredAt: args.authoredAt,
    },
  }
}

export type NutritionEntry = CurrentIntakeEntry | ClientBeliefEntry | PractitionerAdviceEntry

/** The three layers, kept apart, for presentation. */
export interface NutritionRecord {
  currentIntake: CurrentIntakeEntry[]
  clientBeliefs: ClientBeliefEntry[]
  practitionerAdvice: PractitionerAdviceEntry[]
}

export function groupNutrition(entries: NutritionEntry[]): NutritionRecord {
  return {
    currentIntake: entries.filter((e): e is CurrentIntakeEntry => e.layer === 'current_intake'),
    clientBeliefs: entries.filter((e): e is ClientBeliefEntry => e.layer === 'client_belief'),
    practitionerAdvice: entries.filter(
      (e): e is PractitionerAdviceEntry => e.layer === 'practitioner_advice'),
  }
}

// ─── Therapeutic aims ────────────────────────────────────────────────────────

export interface TherapeuticAim {
  id: string
  /** What is being worked towards. The client's words where they gave them. */
  aim: V2SourcedFact<string>
  /** The concern this aim relates to. */
  concernId: string | null
  /** Required — an aim belongs to the practitioner who set it. */
  setBy: string
  setAt: string
  /** Agreed with the client in a conversation, or not yet. */
  agreedWithClient: boolean
  state: 'active' | 'met' | 'changed' | 'withdrawn'
}

export type AimRefusal = 'no_author' | 'no_aim' | 'predictive_wording'

export interface AimResult {
  aim: TherapeuticAim | null
  refusedReason?: AimRefusal
}

/** Wording that would turn an aim into a promise or a prediction. An aim says
 *  what is being worked towards, never what will happen. */
const PREDICTIVE_WORDING = [
  /\bwill\s+(?:cure|fix|resolve|heal|eliminate|reverse|prevent)\b/i,
  /\bguarantee/i,
  /\bcures?\b/i,
  /\bwill\s+be\s+(?:cured|fixed|healed)\b/i,
]

export function therapeuticAim(args: {
  id: string; aim: string; concernId?: string | null
  setBy: string | null; setAt: string
  agreedWithClient?: boolean
  /** True when the text is the client's own wording. */
  fromClientWording?: boolean
}): AimResult {
  if (!args.setBy) return { aim: null, refusedReason: 'no_author' }
  if (!args.aim.trim()) return { aim: null, refusedReason: 'no_aim' }
  if (PREDICTIVE_WORDING.some((re) => re.test(args.aim))) {
    return { aim: null, refusedReason: 'predictive_wording' }
  }
  return {
    aim: {
      id: args.id,
      aim: args.fromClientWording
        ? said(args.aim, args.setAt)
        : organised(args.aim, args.setAt),
      concernId: args.concernId ?? null,
      setBy: args.setBy,
      setAt: args.setAt,
      agreedWithClient: args.agreedWithClient ?? false,
      state: 'active',
    },
  }
}

// ─── Outcome measures ────────────────────────────────────────────────────────

export const MEASURE_SOURCES = ['client_rated', 'external_record'] as const
export type MeasureSource = (typeof MEASURE_SOURCES)[number]

export interface OutcomeMeasure {
  id: string
  /** What is being noticed, in plain terms. */
  label: string
  aimId: string | null
  concernId: string | null
  source: MeasureSource
  /** How the client rates it, when client-rated. Free scale — the client's
   *  own 0–10 or their own words; NI does not normalise it. */
  unit: string | null
  createdBy: string
  createdAt: string
}

export interface MeasureReading {
  id: string
  measureId: string
  /** What was recorded. A client rating or an external value, verbatim. */
  value: V2SourcedFact<string>
  at: string
  /** Where it came from, so it can be traced. */
  sourceRef: string
}

/**
 * Two readings of one measure, reported as a change WITHOUT evaluation. It
 * states the two values and their dates and says nothing about whether the
 * change is good, bad, significant or caused by anything.
 *
 * Returns null rather than inventing a direction when either reading is
 * non-numeric — a worded rating is shown as the two phrases, not as progress.
 */
export function describeChange(
  measure: OutcomeMeasure, earlier: MeasureReading, later: MeasureReading,
): string | null {
  if (earlier.measureId !== measure.id || later.measureId !== measure.id) return null
  const a = new Date(earlier.at).getTime()
  const b = new Date(later.at).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null
  const unit = measure.unit ? ` ${measure.unit}` : ''
  const who = measure.source === 'client_rated' ? 'client-rated' : 'from record'
  return `${measure.label}: ${earlier.value.value}${unit} → ${later.value.value}${unit} ` +
         `(${who}, ${earlier.at.slice(0, 10)} → ${later.at.slice(0, 10)}).`
}

/** Readings for a measure, oldest first. Order only — no trend, no slope. */
export function readingsForMeasure(
  measure: OutcomeMeasure, readings: MeasureReading[],
): MeasureReading[] {
  return readings
    .filter((r) => r.measureId === measure.id)
    .sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime())
}
