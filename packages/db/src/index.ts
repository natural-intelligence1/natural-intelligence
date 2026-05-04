export { createClient } from './client'
export { createServerSupabaseClient } from './server'
export { createAdminClient } from './admin'
export * from './email'
export type { Database } from './types'

// UI branching engine (Sprint 16.2 Phase C2)
// Parallel to clinicalScoringRules — different pipeline, different concern.
export * from './intake'
