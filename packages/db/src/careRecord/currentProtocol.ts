// ─── packages/db/src/careRecord/currentProtocol.ts ──────────────────────────
// Which Protocol version is the client's CURRENT plan.
//
// This is the one rule both apps must agree on. If the client's My Plan and
// the practitioner's Plan section ever answer it differently, the product is
// lying to one of them — so the answer lives here and both read it.
//
// THE RULE
//
//   current = the SIGNED version that no SIGNED version supersedes
//
// Two halves, both load-bearing:
//
//   · signed — an unsigned draft has no clinical status whatever produced it,
//     so it can never be the current plan;
//   · superseded only by a SIGNED successor — a revision points at its
//     predecessor from the moment it is created and stays unsigned until it
//     is signed. If any successor counted, starting a revision would withdraw
//     the client's current plan and leave them with nothing until the new
//     version was signed.
//
// ── RECONCILIATION REQUIRED AT INTEGRATION ─────────────────────────────────
// feat/protocol-adoption-signing carries an equivalent rule in
// packages/db/src/protocols/versionItems.ts (isDailyPathEligible /
// selectDailyPathSource). These two MUST become one function when that branch
// merges, not two that happen to agree today. Deliberately flagged rather
// than quietly duplicated: two copies of this rule drifting apart is exactly
// the failure the care record contract exists to prevent.

/** The signing-relevant shape of a Protocol version, as member_protocols
 *  holds it after migration 0059. */
export interface ProtocolVersionRow {
  id: string
  version: number
  signed_at: string | null
  signed_by: string | null
  supersedes: string | null
  member_id?: string
  case_id?: string | null
}

/** Has this version been signed by a practitioner? */
export function isSigned(v: ProtocolVersionRow): boolean {
  return v.signed_at !== null && v.signed_by !== null
}

/** Is this version displaced by a later SIGNED version? */
export function isSupersededBySignedVersion(
  v: ProtocolVersionRow,
  all: readonly ProtocolVersionRow[],
): boolean {
  return all.some((other) => other.supersedes === v.id && isSigned(other))
}

/** May this version be shown to the client as their plan, or used as a
 *  DailyPath source? */
export function isCurrentPlan(
  v: ProtocolVersionRow,
  all: readonly ProtocolVersionRow[],
): boolean {
  return isSigned(v) && !isSupersededBySignedVersion(v, all)
}

/**
 * The client's current plan, or null.
 *
 * Null is a legitimate, common state — "no signed Protocol yet" is what a
 * client sees before their practitioner signs one, and the UI must render it
 * as a real answer rather than an error or a blank.
 */
export function selectCurrentPlan(
  versions: readonly ProtocolVersionRow[],
): ProtocolVersionRow | null {
  const candidates = versions.filter((v) => isCurrentPlan(v, versions))
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (b.version > a.version ? b : a))
}

/** Signed versions that have since been replaced, newest first. The client
 *  may look back at these; they are history, not their plan. */
export function supersededPlans(
  versions: readonly ProtocolVersionRow[],
): ProtocolVersionRow[] {
  return versions
    .filter((v) => isSigned(v) && isSupersededBySignedVersion(v, versions))
    .sort((a, b) => b.version - a.version)
}

/** Drafts in flight. Never shown to the client under any label — exposed only
 *  so the practitioner surface can say "a revision is in progress". */
export function draftVersions(
  versions: readonly ProtocolVersionRow[],
): ProtocolVersionRow[] {
  return versions.filter((v) => !isSigned(v)).sort((a, b) => b.version - a.version)
}

export type PlanState =
  | { kind: 'none' }
  | { kind: 'current'; version: ProtocolVersionRow; revisionInProgress: boolean }

/** Everything the client's My Plan needs, in one answer. */
export function planState(versions: readonly ProtocolVersionRow[]): PlanState {
  const current = selectCurrentPlan(versions)
  if (!current) return { kind: 'none' }
  return {
    kind: 'current',
    version: current,
    // A draft pointing at the current version means the practitioner is
    // revising it. Worth telling the client, and emphatically NOT a reason to
    // stop showing them the plan they still have.
    revisionInProgress: versions.some((v) => v.supersedes === current.id && !isSigned(v)),
  }
}
