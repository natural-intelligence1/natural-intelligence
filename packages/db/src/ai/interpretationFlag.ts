// ─── packages/db/src/ai/interpretationFlag.ts ────────────────────────────────
// AI INTERPRETATION kill-switch (Mission 20 containment).
//
// Founder ruling, 6 November 2026: raw Intake COLLECTION remains ON, but
// automatic AI health-synopsis / interpretation generation for new real
// Intakes is HELD pending the outstanding Legal/MHRA review of the downstream
// pipelines.
//
// CAPTURE IS NOT INTERPRETATION. This flag separates the two: it holds the
// generators and touches nothing about collection. Intake questions,
// assertIntakeCollectionEnabled(), and the intake_answers / intake_responses
// writes are all unaffected.
//
// Interpretation is DISABLED BY DEFAULT. It runs only when
// AI_INTERPRETATION_ENABLED === "true" (exact string match — "1", "TRUE",
// "false", unset all mean held), mirroring the intake kill-switch semantics.
// Default-off means merging this guard activates the hold: no environment
// variable has to be set, and a typo, a missing variable or a brand-new
// environment all fail closed.
//
// Guard point: the FIRST statement of each generator —
//   - generateHealthSynopsis()  apps/web/app/dashboard/synopsis/actions.ts
//   - generateBodyStory()       apps/web/app/dashboard/story/actions.ts
//
// Deliberately NOT at the trigger sites. Each pipeline has three entry points
// (intake completion, plus two page-level regenerate controls), and the
// page-level ones bypass every check completeIntake performs. Guarding the
// generator is the only placement that is fail-closed for all three, and it
// is where a fourth entry point added later will funnel too.

/** Kill-switch: AI interpretation is held unless explicitly enabled. */
export function isAiInterpretationEnabled(): boolean {
  return process.env.AI_INTERPRETATION_ENABLED === 'true'
}

/**
 * The outputs this flag holds. Both derive from Intake and both are named in
 * the 13 September ruling as awaiting Legal/MHRA review.
 *
 * Biohub lab-report parsing is deliberately NOT here: it is a separate
 * pipeline, not Intake-derived, and was not named in the ruling. It shares
 * only ANTHROPIC_API_KEY, which is why removing that key was rejected as the
 * containment mechanism.
 */
export const HELD_INTERPRETATION_OUTPUTS = ['health_synopsis', 'body_story'] as const

export type InterpretationOutput = (typeof HELD_INTERPRETATION_OUTPUTS)[number]
