// ─── packages/db/src/environment.ts ──────────────────────────────────────────
// The single authoritative answer to "is this a development/test context?".
//
// Used to keep destructive and data-fabricating capability out of production.
// Admin authentication is NOT sufficient for those: an authenticated admin in
// production must still be unable to reset data, fabricate practitioners, or
// publish draft agreements.
//
// FAILS CLOSED. Anything that is not provably development or test is treated
// as production. In particular:
//
//   · Vercel sets NODE_ENV='production' for PREVIEW builds as well as the
//     production deployment, so previews are refused too.
//   · VERCEL_ENV='production' refuses outright, even if NODE_ENV says
//     otherwise.
//   · An absent, empty or unrecognised NODE_ENV refuses. A missing variable
//     must never read as "safe".

/** True only in a provably development or test context. */
export function isDevOnlyEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV === 'production') return false
  if (env.NODE_ENV === 'production') return false
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
}

/** Human-readable refusal naming the capability being blocked. */
export function devOnlyBlockedMessage(capability: string): string {
  return `${capability} is available in development and test only. ` +
    'It is refused in production and in preview deployments, regardless of ' +
    'who is signed in. This protects production data from test fixtures, ' +
    'resets and placeholder content.'
}

/**
 * Hard server-side stop. Call at the single chokepoint every development-only
 * action passes through, so coverage does not depend on remembering to add it
 * to each new action.
 */
export function assertDevOnlyEnvironment(
  capability: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isDevOnlyEnvironment(env)) throw new Error(devOnlyBlockedMessage(capability))
}
