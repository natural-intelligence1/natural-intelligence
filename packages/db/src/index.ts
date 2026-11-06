export { createClient } from './client'
export { createServerSupabaseClient } from './server'
export { createAdminClient } from './admin'
export * from './email'
export type { Database } from './types'

// UI branching engine (Sprint 16.2 Phase C2)
// Parallel to clinicalScoringRules — different pipeline, different concern.
export * from './intake'

// Clinical Reasoning Trace (Sprint 17)
export * from './crt'

// ── Sprint 3 safety floor ─────────────────────────────────────────────────────
export * from './consent'
export * from './rights'

// Signup / foundational consent. SERVER ONLY — reaches node:crypto. Safe in
// this barrel because the root barrel already re-exports server.ts
// (next/headers) and is therefore server-only by construction; it is NOT
// re-exported from './consent', which a client component imports. See
// packages/db/src/consent/server.ts.
export * from './consent/server'
