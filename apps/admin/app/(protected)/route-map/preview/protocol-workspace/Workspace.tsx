'use client'
/*
 * Practitioner Protocol workspace — synthetic preview.
 *
 * Every state shown here is derived by deriveWorkspace() from the shipped
 * rules module, not decided in this component. That is deliberate: whether a
 * Protocol is editable, signable, client-ready or DailyPath-eligible are
 * clinical-safety questions, and this screen is only allowed to render the
 * answers. It cannot show an edit control on a signed version or a sign
 * button to someone who may not sign, because it never computes either.
 *
 * Persistence is in-memory. Writing would need 0061, which is deliberately
 * unapplied. The database proofs live in packages/db — this is for UX review.
 */
import { useId, useMemo, useState } from 'react'
import {
  deriveWorkspace, SIGNING_CONFIRMATION, DRAFT_BANNER,
  applyItemEdit, removeItem, restoreItem, addItem, reorderItems, beginRevision,
  validateItemInput, ITEM_TYPES,
  type ProtocolVersionItem, type ProtocolVersionRef, type ProtocolItemType,
} from '@natural-intelligence/db/protocols'
import { C, display, body, FOCUS_RING, SyntheticBanner } from '../_connected/shared'
import {
  PRACTITIONER, CLIENT, SIGNED_V1, SIGNED_V2, SIGNED_V1_ITEMS, SIGNED_V2_ITEMS,
  ACTOR_NAMES, DRAFT_SOURCE_LABELS,
} from './fixtures'

type Store = Record<string, { ref: ProtocolVersionRef; items: ProtocolVersionItem[] }>

const INITIAL: Store = {
  'proto-v1': { ref: SIGNED_V1, items: SIGNED_V1_ITEMS },
  'proto-v2': { ref: SIGNED_V2, items: SIGNED_V2_ITEMS },
}

const TYPE_LABEL: Record<ProtocolItemType, string> = {
  supplement: 'Supplement', lifestyle: 'Lifestyle', nutrition: 'Nutrition',
  test: 'Test', practitioner: 'Practitioner-led',
}

export default function Workspace() {
  const [store, setStore] = useState<Store>(INITIAL)
  const [currentId, setCurrentId] = useState('proto-v2')
  const [reviewing, setReviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [showProvenance, setShowProvenance] = useState(false)

  const current = store[currentId]
  const allVersions = useMemo(() => Object.values(store).map((v) => v.ref), [store])

  const invalidItemIds = useMemo(
    () => current.items.filter((i) => i.is_active && validateItemInput(i).length > 0).map((i) => i.id),
    [current.items])

  const view = deriveWorkspace(current.ref, current.items, allVersions,
    { practitionerId: PRACTITIONER.id, isLeadForCase: true, isEligible: true },
    { reviewing, invalidItemIds })

  const mutate = (fn: (items: ProtocolVersionItem[]) => ProtocolVersionItem[]) =>
    setStore((s) => ({ ...s, [currentId]: { ...s[currentId], items: fn(s[currentId].items) } }))

  function sign() {
    setStore((s) => ({
      ...s,
      [currentId]: {
        ...s[currentId],
        ref: { ...s[currentId].ref, signed_at: new Date().toISOString(), signed_by: PRACTITIONER.id },
      },
    }))
    setConfirming(false); setAcknowledged(false); setReviewing(false)
  }

  function revise() {
    const { draft, items } = beginRevision(current.ref, current.items, PRACTITIONER.id)
    setStore((s) => ({ ...s, [draft.id]: { ref: draft, items } }))
    setCurrentId(draft.id)
    setReviewing(false)
  }

  const activeItems = current.items.filter((i) => i.is_active).sort((a, b) => a.display_order - b.display_order)
  const removedItems = current.items.filter((i) => !i.is_active)
  const versions = [...allVersions].sort((a, b) => b.version - a.version)

  return (
    <div style={{ ...body, color: C.text }}>
      <SyntheticBanner text="Synthetic case, in-memory only. Nothing is saved and no database is touched — migration 0061 is deliberately unapplied." />

      {/* ── Client / case ─────────────────────────────────────────────── */}
      <header className="mb-6">
        <p className="text-[11.5px] uppercase tracking-[0.14em] mb-1" style={{ color: C.muted }}>
          {CLIENT.caseRef} · You are Lead Responsible Practitioner
        </p>
        <h1 className="text-[30px] leading-tight mb-1" style={{ ...display, color: C.botanical }}>
          {CLIENT.name}
        </h1>
        <p className="text-[13.5px]" style={{ color: C.text2 }}>
          {PRACTITIONER.name} · {PRACTITIONER.credential}
        </p>
      </header>

      {/* ── Version switcher + state ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {versions.map((v) => {
          const selected = v.id === currentId
          const vView = deriveWorkspace(v, store[v.id].items, allVersions,
            { practitionerId: PRACTITIONER.id, isLeadForCase: true, isEligible: true })
          return (
            <button key={v.id} onClick={() => { setCurrentId(v.id); setReviewing(false) }}
              aria-current={selected ? 'true' : undefined}
              className={`px-3 py-1.5 rounded-full text-[12.5px] border transition-colors ${FOCUS_RING}`}
              style={{
                background: selected ? C.pine : 'transparent',
                color: selected ? C.warm : C.text2,
                borderColor: selected ? C.pine : C.border,
              }}>
              v{v.version} · {v.signed_at ? (vView.isSuperseded ? 'Superseded' : 'Signed') : 'Draft'}
            </button>
          )
        })}
      </div>

      <StateBanner view={view} />

      {/* ── Plan content ──────────────────────────────────────────────── */}
      <section aria-label="Protocol content" className="mt-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[19px]" style={{ ...display, color: C.botanical }}>
            {reviewing ? 'As the client will receive it' : 'Plan content'}
          </h2>
          {view.canEdit && (
            <button onClick={() => setReviewing((r) => !r)}
              className={`text-[12.5px] underline underline-offset-4 ${FOCUS_RING}`} style={{ color: C.goldInk }}>
              {reviewing ? 'Back to editing' : 'Preview as client'}
            </button>
          )}
        </div>

        {activeItems.length === 0 && (
          <p className="text-[13.5px] py-6 text-center rounded-lg border border-dashed"
             style={{ color: C.muted, borderColor: C.border }}>
            No items yet. Add the first one below.
          </p>
        )}

        <ol className="space-y-3">
          {activeItems.map((item, index) => (
            <li key={item.id}>
              {view.canEdit && !reviewing
                ? <EditableItem
                    item={item} index={index} total={activeItems.length}
                    problems={validateItemInput(item)}
                    onChange={(patch) => mutate((is) => applyItemEdit(is, item.id, patch, PRACTITIONER.id))}
                    onRemove={() => mutate((is) => removeItem(is, item.id, PRACTITIONER.id))}
                    onMove={(d) => mutate((is) => reorderItems(is, item.id, d))}
                  />
                : <ReadOnlyItem item={item} clientView={reviewing} />}
            </li>
          ))}
        </ol>

        {view.canEdit && !reviewing && (
          <>
            {removedItems.length > 0 && (
              <div className="mt-4 pt-3 border-t" style={{ borderColor: C.border }}>
                <p className="text-[11.5px] uppercase tracking-[0.12em] mb-2" style={{ color: C.muted }}>
                  Removed from this version
                </p>
                <ul className="space-y-1.5">
                  {removedItems.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 text-[13px]" style={{ color: C.muted }}>
                      <span className="line-through">{i.name || 'Untitled item'}</span>
                      <button onClick={() => mutate((is) => restoreItem(is, i.id, PRACTITIONER.id))}
                        className={`text-[12px] underline underline-offset-2 ${FOCUS_RING}`} style={{ color: C.goldInk }}>
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button onClick={() => mutate((is) => addItem(is, currentId, PRACTITIONER.id))}
              className={`mt-4 px-4 py-2 rounded-lg text-[13px] border border-dashed w-full transition-colors ${FOCUS_RING}`}
              style={{ borderColor: C.sage, color: C.pine, background: C.warm }}>
              + Add an item
            </button>
          </>
        )}
      </section>

      {/* ── Review & sign / Revise ────────────────────────────────────── */}
      <section aria-label="Protocol actions" className="mt-8 pt-6 border-t" style={{ borderColor: C.border }}>
        {view.canEdit ? (
          <SignBlock
            view={view} confirming={confirming} acknowledged={acknowledged}
            onBegin={() => { setReviewing(true); setConfirming(true) }}
            onCancel={() => { setConfirming(false); setAcknowledged(false) }}
            onAcknowledge={setAcknowledged} onSign={sign}
          />
        ) : (
          <SignedBlock view={view} onRevise={revise} />
        )}
      </section>

      {/* ── Provenance ────────────────────────────────────────────────── */}
      <section className="mt-6">
        <button onClick={() => setShowProvenance((s) => !s)}
          aria-expanded={showProvenance}
          className={`text-[12.5px] underline underline-offset-4 ${FOCUS_RING}`} style={{ color: C.muted }}>
          {showProvenance ? 'Hide version details' : 'Version details & draft origin'}
        </button>
        {showProvenance && <ProvenancePanel view={view} />}
      </section>
    </div>
  )
}

// ── pieces ────────────────────────────────────────────────────────────────

function StateBanner({ view }: { view: ReturnType<typeof deriveWorkspace> }) {
  const draft = view.phase !== 'signed'
  return (
    <div className="rounded-lg px-4 py-3 border flex flex-wrap items-center gap-x-4 gap-y-1"
      style={{
        background: draft ? C.goldWash : C.warm,
        borderColor: draft ? C.goldPale : C.sage,
      }}>
      {/* Never colour alone: the words carry the state. */}
      <strong className="text-[14px]" style={{ color: draft ? C.goldInk : C.pine }}>
        {view.stateLabel}
      </strong>
      <span className="text-[12.5px]" style={{ color: C.text2 }}>
        {draft
          ? 'Not visible to the client and not a DailyPath source until it is signed.'
          : view.isClientReady
            ? 'Visible to the client as their current Protocol · Eligible for DailyPath'
            : 'Readable history. A later signed version is now current.'}
      </span>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, multiline, width = 'full' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; multiline?: boolean; width?: 'full' | 'half'
}) {
  // useId, not a random value: this component is server-rendered before it
  // hydrates, and a random id would differ between the two passes.
  const id = useId()
  const shared = {
    id, value, placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    className: `w-full rounded-md border px-3 py-2 text-[13.5px] bg-white ${FOCUS_RING}`,
    style: { borderColor: C.border, color: C.text },
  }
  return (
    <div className={width === 'half' ? 'sm:col-span-1' : 'sm:col-span-2'}>
      <label htmlFor={id} className="block text-[11.5px] uppercase tracking-[0.1em] mb-1" style={{ color: C.muted }}>
        {label}
      </label>
      {multiline ? <textarea rows={2} {...shared} /> : <input type="text" {...shared} />}
    </div>
  )
}

function EditableItem({ item, index, total, problems, onChange, onRemove, onMove }: {
  item: ProtocolVersionItem; index: number; total: number; problems: string[]
  onChange: (p: Partial<ProtocolVersionItem>) => void
  onRemove: () => void; onMove: (d: 'up' | 'down') => void
}) {
  return (
    <div className="rounded-xl border p-4" style={{ background: C.warm, borderColor: problems.length ? C.gold : C.border }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-[11.5px] tabular-nums pt-2" style={{ color: C.muted }}>{index + 1}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onMove('up')} disabled={index === 0}
            aria-label={`Move ${item.name || 'item'} up`}
            className={`px-2 py-1 rounded text-[12px] disabled:opacity-30 ${FOCUS_RING}`} style={{ color: C.text2 }}>↑</button>
          <button onClick={() => onMove('down')} disabled={index === total - 1}
            aria-label={`Move ${item.name || 'item'} down`}
            className={`px-2 py-1 rounded text-[12px] disabled:opacity-30 ${FOCUS_RING}`} style={{ color: C.text2 }}>↓</button>
          <button onClick={onRemove} aria-label={`Remove ${item.name || 'item'}`}
            className={`px-2 py-1 rounded text-[12px] underline underline-offset-2 ${FOCUS_RING}`} style={{ color: C.goldInk }}>
            Remove
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Action" value={item.name} onChange={(v) => onChange({ name: v })} placeholder="What the client does" />
        <div className="sm:col-span-1">
          <label className="block text-[11.5px] uppercase tracking-[0.1em] mb-1" style={{ color: C.muted }}>Type</label>
          <select value={item.item_type} onChange={(e) => onChange({ item_type: e.target.value as ProtocolItemType })}
            className={`w-full rounded-md border px-3 py-2 text-[13.5px] bg-white ${FOCUS_RING}`}
            style={{ borderColor: C.border, color: C.text }}>
            {ITEM_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <Field label="Amount" value={item.dose ?? ''} onChange={(v) => onChange({ dose: v || null })} placeholder="e.g. 200mg" width="half" />
        <Field label="Timing / frequency" value={item.timing ?? ''} onChange={(v) => onChange({ timing: v || null })} placeholder="e.g. Evening, with food" width="half" />
        <div className="sm:col-span-1">
          <label className="block text-[11.5px] uppercase tracking-[0.1em] mb-1" style={{ color: C.muted }}>Duration (weeks)</label>
          <input type="number" min={1} value={item.duration_weeks ?? ''}
            onChange={(e) => onChange({ duration_weeks: e.target.value === '' ? null : Number(e.target.value) })}
            className={`w-full rounded-md border px-3 py-2 text-[13.5px] bg-white ${FOCUS_RING}`}
            style={{ borderColor: C.border, color: C.text }} />
        </div>
        <Field label="Instructions — the client reads this" value={item.instructions ?? ''}
          onChange={(v) => onChange({ instructions: v || null })} multiline />
        <Field label="Rationale / therapeutic aim — your note" value={item.rationale ?? ''}
          onChange={(v) => onChange({ rationale: v || null })} multiline />
      </div>

      {problems.length > 0 && (
        <p role="alert" className="mt-3 text-[12.5px]" style={{ color: C.goldInk }}>
          {problems.join(' ')}
        </p>
      )}
    </div>
  )
}

function ReadOnlyItem({ item, clientView }: { item: ProtocolVersionItem; clientView: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: C.warm, borderColor: C.border }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
        <h3 className="text-[16px]" style={{ ...display, color: C.botanical }}>{item.name}</h3>
        <span className="text-[11px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
          style={{ background: C.cream, color: C.olive }}>{TYPE_LABEL[item.item_type]}</span>
      </div>
      <p className="text-[13px] mb-2" style={{ color: C.text2 }}>
        {[item.dose, item.timing, item.duration_weeks ? `${item.duration_weeks} weeks` : null]
          .filter(Boolean).join(' · ') || '—'}
      </p>
      {item.instructions && <p className="text-[13.5px] mb-1.5" style={{ color: C.text }}>{item.instructions}</p>}
      {/* The rationale is the practitioner's note and is not part of what the
          client receives, so the client preview omits it. */}
      {!clientView && item.rationale && (
        <p className="text-[12.5px] italic" style={{ color: C.muted }}>Aim: {item.rationale}</p>
      )}
    </div>
  )
}

function SignBlock({ view, confirming, acknowledged, onBegin, onCancel, onAcknowledge, onSign }: {
  view: ReturnType<typeof deriveWorkspace>
  confirming: boolean; acknowledged: boolean
  onBegin: () => void; onCancel: () => void
  onAcknowledge: (v: boolean) => void; onSign: () => void
}) {
  if (!confirming) {
    return (
      <div>
        <button onClick={onBegin} disabled={!view.canSign}
          className={`px-5 py-2.5 rounded-lg text-[14px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING}`}
          style={{ background: C.pine, color: C.warm }}>
          Review &amp; sign
        </button>
        {view.signBlockedMessage && (
          <p className="mt-2 text-[12.5px]" style={{ color: C.goldInk }}>{view.signBlockedMessage}</p>
        )}
      </div>
    )
  }

  return (
    <div role="group" aria-labelledby="sign-heading"
      className="rounded-xl border p-5" style={{ background: C.goldWash, borderColor: C.goldPale }}>
      <h3 id="sign-heading" className="text-[18px] mb-3" style={{ ...display, color: C.botanical }}>
        Sign this Protocol
      </h3>

      {/* The confirmation itself: rendered from the shared constant so the
          wording cannot drift from the approved sentence. */}
      <p className="text-[14px] leading-relaxed mb-4" style={{ color: C.text }}>
        {SIGNING_CONFIRMATION}
      </p>

      <label className="flex items-start gap-3 mb-4 cursor-pointer text-[13.5px]" style={{ color: C.text }}>
        {/* Never pre-ticked. */}
        <input type="checkbox" checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)}
          className={`mt-0.5 h-4 w-4 ${FOCUS_RING}`} />
        <span>I confirm the above and adopt this Protocol as my own professional work.</span>
      </label>

      <p className="text-[12.5px] mb-4" style={{ color: C.goldInk }}>
        Signing cannot be undone. To change the Protocol afterwards you will create a new version.
      </p>

      <div className="flex flex-wrap gap-3">
        <button onClick={onSign} disabled={!acknowledged || !view.canSign}
          className={`px-5 py-2.5 rounded-lg text-[14px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING}`}
          style={{ background: C.pine, color: C.warm }}>
          Sign Protocol
        </button>
        <button onClick={onCancel}
          className={`px-5 py-2.5 rounded-lg text-[14px] border ${FOCUS_RING}`}
          style={{ borderColor: C.border, color: C.text2 }}>
          Keep editing
        </button>
      </div>
    </div>
  )
}

function SignedBlock({ view, onRevise }: { view: ReturnType<typeof deriveWorkspace>; onRevise: () => void }) {
  const { provenance: p } = view
  return (
    <div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          ['Version', `v${p.version}`],
          ['State', view.isSuperseded ? 'Superseded' : 'Current'],
          ['Signed by', p.signedBy ? ACTOR_NAMES[p.signedBy] ?? p.signedBy : '—'],
          ['Signed', p.signedAt ? new Date(p.signedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11.5px] mb-1" style={{ color: C.muted }}>{k}</dt>
            <dd className="text-[14px]" style={{ color: C.text }}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[13px] mb-4" style={{ color: C.text2 }}>
        {PRACTITIONER.credential}
      </p>

      <button onClick={onRevise}
        className={`px-5 py-2.5 rounded-lg text-[14px] font-medium ${FOCUS_RING}`}
        style={{ background: C.pine, color: C.warm }}>
        Revise Protocol
      </button>
      <p className="mt-2 text-[12.5px]" style={{ color: C.muted }}>
        Creates v{p.version + 1} as a new draft with these items copied forward. This signed version stays exactly as it is.
      </p>
    </div>
  )
}

function ProvenancePanel({ view }: { view: ReturnType<typeof deriveWorkspace> }) {
  const { provenance: p } = view
  const name = (id: string) => ACTOR_NAMES[id] ?? id
  return (
    <div className="mt-3 rounded-lg border p-4 text-[13px]" style={{ background: C.warm, borderColor: C.border }}>
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <p className="text-[11.5px] uppercase tracking-[0.12em] mb-2" style={{ color: C.muted }}>Draft origin</p>
          <ul className="space-y-1" style={{ color: C.text2 }}>
            {p.draftOrigins.map((o) => <li key={o}>· {DRAFT_SOURCE_LABELS[o] ?? o}</li>)}
            {p.originalContributors.length > 0 && (
              <li className="pt-1">· Contributors: {p.originalContributors.map(name).join(', ')}</li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-[11.5px] uppercase tracking-[0.12em] mb-2" style={{ color: C.muted }}>
            Final professional sign-off
          </p>
          {p.signedBy ? (
            <ul className="space-y-1" style={{ color: C.text2 }}>
              <li>· {name(p.signedBy)}</li>
              <li>· {PRACTITIONER.credential}</li>
              <li>· {p.signedAt ? new Date(p.signedAt).toLocaleString('en-GB') : ''}</li>
              <li>· Version {p.version}</li>
            </ul>
          ) : (
            <p style={{ color: C.muted }}>Not yet signed. {DRAFT_BANNER}</p>
          )}
        </div>
      </div>
      <p className="mt-4 pt-3 border-t text-[12.5px]" style={{ borderColor: C.border, color: C.muted }}>
        Draft origin is an audit record of how the working draft reached the practitioner.
        The signed Protocol is the signing practitioner&rsquo;s own professional work.
      </p>
    </div>
  )
}
