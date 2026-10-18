// ─── packages/db/src/protocols/workspace.ts ────────────────────────────────
// The rules the practitioner workspace renders. Pure: no React, no database.
//
// The UI is a thin renderer of this. That matters for more than tidiness —
// "is this signable", "is this client-ready", "is this DailyPath eligible"
// are clinical-safety questions, and they should be answered in one tested
// place rather than re-derived in a component.

import {
  isDailyPathEligible, isEditable,
  type ProtocolVersionItem, type ProtocolVersionItemInput, type ProtocolVersionRef,
} from './versionItems'

/**
 * The confirmation shown immediately before signing. Founder-approved
 * wording, reproduced verbatim. The component renders this constant; the
 * test asserts it. Changing the sentence should take a deliberate edit here
 * and a failing test, not a quiet copy-edit in JSX.
 */
export const SIGNING_CONFIRMATION =
  'By signing, I confirm that I have reviewed this Protocol in full, made any changes ' +
  'I consider necessary, and adopt the final Protocol as my own professional work to ' +
  'the same standard as if I had authored it from the outset.'

export const DRAFT_BANNER = 'Draft · Not for client use'

export type WorkspacePhase = 'draft' | 'review' | 'signed'

/** Why the practitioner cannot sign right now. Null means they can. */
export type SignBlockedReason =
  | 'already_signed'
  | 'not_lead'
  | 'not_eligible'
  | 'no_items'
  | 'unsaved_invalid_items'

export const SIGN_BLOCKED_MESSAGES: Record<SignBlockedReason, string> = {
  already_signed: 'This version is already signed. Revise it to make further changes.',
  not_lead: 'Only the active Lead Responsible Practitioner for this case can sign the Protocol.',
  not_eligible: 'Your practitioner eligibility is not currently active, so you cannot sign.',
  no_items: 'A Protocol needs at least one active item before it can be signed.',
  unsaved_invalid_items: 'Some items are incomplete. Resolve them before signing.',
}

export interface Viewer {
  practitionerId: string | null
  isLeadForCase: boolean
  isEligible: boolean
}

/** How the draft reached the practitioner, kept separate from who owns the
 *  signed result. Both are shown; neither is allowed to describe the other. */
export interface ProvenanceSummary {
  /** Distinct drafting origins present across the items. */
  draftOrigins: string[]
  originalContributors: string[]
  latestEditors: string[]
  version: number
  signedBy: string | null
  signedAt: string | null
}

export interface WorkspaceView {
  phase: WorkspacePhase
  stateLabel: string
  /** True only while unsigned: the signature is what freezes content. */
  canEdit: boolean
  canSign: boolean
  signBlockedReason: SignBlockedReason | null
  signBlockedMessage: string | null
  /** May the client see this as their plan? */
  isClientReady: boolean
  /** May DailyPath derive actions from it? */
  dailyPathEligible: boolean
  /** Shown instead of edit controls once signed. */
  canRevise: boolean
  isSuperseded: boolean
  provenance: ProvenanceSummary
}

const uniq = (xs: Array<string | null | undefined>): string[] =>
  [...new Set(xs.filter((x): x is string => !!x))]

/**
 * Derive everything the workspace needs to render, from the version, its
 * items and the sibling versions.
 *
 * `phase` is deliberately not stored anywhere: it is a function of the
 * signature. A record that stored its own state could drift out of step with
 * signed_at; this cannot.
 */
export function deriveWorkspace(
  protocol: ProtocolVersionRef,
  items: readonly ProtocolVersionItem[],
  allVersions: readonly ProtocolVersionRef[],
  viewer: Viewer,
  opts: { reviewing?: boolean; invalidItemIds?: readonly string[] } = {},
): WorkspaceView {
  const signed = !isEditable(protocol)
  const activeItems = items.filter((i) => i.is_active)
  const supersededBy = allVersions.find((v) => v.supersedes === protocol.id && v.signed_at !== null)
  const isSuperseded = !!supersededBy

  let signBlockedReason: SignBlockedReason | null = null
  if (signed) signBlockedReason = 'already_signed'
  else if (!viewer.isLeadForCase) signBlockedReason = 'not_lead'
  else if (!viewer.isEligible) signBlockedReason = 'not_eligible'
  else if (activeItems.length === 0) signBlockedReason = 'no_items'
  else if ((opts.invalidItemIds?.length ?? 0) > 0) signBlockedReason = 'unsaved_invalid_items'

  const phase: WorkspacePhase = signed ? 'signed' : opts.reviewing ? 'review' : 'draft'

  return {
    phase,
    stateLabel: signed
      ? (isSuperseded ? `Signed · v${protocol.version} · Superseded` : `Signed · v${protocol.version} · Current`)
      : DRAFT_BANNER,
    canEdit: !signed,
    canSign: signBlockedReason === null,
    signBlockedReason,
    signBlockedMessage: signBlockedReason ? SIGN_BLOCKED_MESSAGES[signBlockedReason] : null,
    // Both of these come from the same authority the data layer uses. The UI
    // never decides them for itself.
    isClientReady: signed && isDailyPathEligible(protocol, allVersions),
    dailyPathEligible: isDailyPathEligible(protocol, allVersions),
    canRevise: signed,
    isSuperseded,
    provenance: {
      draftOrigins: uniq(items.map((i) => i.drafted_source)),
      originalContributors: uniq(items.map((i) => i.drafted_by)),
      latestEditors: uniq(items.map((i) => i.last_edited_by)),
      version: protocol.version,
      signedBy: protocol.signed_by,
      signedAt: protocol.signed_at,
    },
  }
}

// ── Draft editing, as pure list operations ──────────────────────────────────
// The preview runs these in memory; the persisted path runs the equivalent
// through versionItems.ts. Keeping them pure means the ordering and removal
// rules are tested once.

export function reorderItems(
  items: readonly ProtocolVersionItem[], itemId: string, direction: 'up' | 'down',
): ProtocolVersionItem[] {
  const sorted = [...items].sort((a, b) => a.display_order - b.display_order)
  const index = sorted.findIndex((i) => i.id === itemId)
  if (index === -1) return sorted
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= sorted.length) return sorted
  ;[sorted[index], sorted[swapWith]] = [sorted[swapWith], sorted[index]]
  return sorted.map((item, i) => ({ ...item, display_order: i }))
}

export function applyItemEdit(
  items: readonly ProtocolVersionItem[], itemId: string,
  patch: Partial<ProtocolVersionItemInput>, editor: string | null,
): ProtocolVersionItem[] {
  return items.map((i) =>
    i.id === itemId ? { ...i, ...patch, last_edited_by: editor, updated_at: new Date().toISOString() } : i)
}

/** Removing is deactivation, not deletion: the record that the practitioner
 *  considered and rejected an item is itself worth keeping. */
export function removeItem(
  items: readonly ProtocolVersionItem[], itemId: string, editor: string | null,
): ProtocolVersionItem[] {
  return applyItemEdit(items, itemId, { is_active: false }, editor)
}

export function restoreItem(
  items: readonly ProtocolVersionItem[], itemId: string, editor: string | null,
): ProtocolVersionItem[] {
  return applyItemEdit(items, itemId, { is_active: true }, editor)
}

export function addItem(
  items: readonly ProtocolVersionItem[], protocolId: string, editor: string | null,
  seed: Partial<ProtocolVersionItemInput> = {},
): ProtocolVersionItem[] {
  const nextOrder = items.length === 0 ? 0 : Math.max(...items.map((i) => i.display_order)) + 1
  const now = new Date().toISOString()
  return [...items, {
    id: `new-${Math.random().toString(36).slice(2, 10)}`,
    protocol_id: protocolId,
    name: seed.name ?? '',
    item_type: seed.item_type ?? 'supplement',
    dose: seed.dose ?? null,
    timing: seed.timing ?? null,
    duration_weeks: seed.duration_weeks ?? null,
    instructions: seed.instructions ?? null,
    rationale: seed.rationale ?? null,
    display_order: nextOrder,
    is_active: true,
    source_template_item_id: null,
    // Written by the practitioner in the workspace: that is its origin.
    drafted_source: 'practitioner',
    drafted_by: editor,
    last_edited_by: editor,
    created_at: now,
    updated_at: now,
  }]
}

/** The in-memory equivalent of reviseProtocol, for the preview. */
export function beginRevision(
  signedProtocol: ProtocolVersionRef, items: readonly ProtocolVersionItem[], editor: string | null,
): { draft: ProtocolVersionRef; items: ProtocolVersionItem[] } {
  const draftId = `draft-v${signedProtocol.version + 1}`
  const now = new Date().toISOString()
  return {
    draft: {
      id: draftId,
      version: signedProtocol.version + 1,
      signed_at: null,
      signed_by: null,
      supersedes: signedProtocol.id,
      member_id: signedProtocol.member_id,
      case_id: signedProtocol.case_id,
    },
    items: items.filter((i) => i.is_active).map((i, index) => ({
      ...i,
      id: `${draftId}-item-${index}`,
      protocol_id: draftId,
      display_order: index,
      last_edited_by: editor,
      created_at: now,
      updated_at: now,
    })),
  }
}
