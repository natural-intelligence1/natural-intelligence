// ─── packages/db/src/intake/collectionFlag.ts ─────────────────────────────────
// Intake COLLECTION kill-switch (containment patch, pre-Sprint 3).
//
// Collection of identifiable health data through the intake flow is DISABLED
// BY DEFAULT. It only runs when INTAKE_COLLECTION_ENABLED === "true" (exact
// string match — "1", "TRUE", "false", unset all mean disabled), mirroring the
// assignment kill-switch semantics.
//
// This flag is INDEPENDENT of INTAKE_ASSIGNMENT_ENABLED: enabling collection
// does not enable practitioner routing, and vice versa. Both default off.
//
// Guard points (apps/web):
//   - /dashboard/intake page — renders an "intake unavailable" notice instead
//     of the live form when disabled (which also removes the client-side
//     intake_answers write path, since only the form issues those writes)
//   - saveIntakeSection / completeIntake server actions — refuse before any
//     DB client is created, so no intake_responses write and no AI synopsis /
//     body-story generation can run while disabled

/** Kill-switch: intake collection is off unless explicitly enabled. */
export function isIntakeCollectionEnabled(): boolean {
  return process.env.INTAKE_COLLECTION_ENABLED === 'true'
}

/**
 * Throws when intake collection is disabled. Call as the FIRST statement of
 * any server action that stores intake health data, before any Supabase
 * client is created — a throw here proves nothing was written.
 */
export function assertIntakeCollectionEnabled(): void {
  if (!isIntakeCollectionEnabled()) {
    throw new Error('Intake collection is currently disabled (INTAKE_COLLECTION_ENABLED is not "true").')
  }
}
