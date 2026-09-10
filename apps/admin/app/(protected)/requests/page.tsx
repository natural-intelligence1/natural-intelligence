import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import {
  listAllRightsRequests,
  type RightsRequestRow, type RightsRequestStatus,
} from '@natural-intelligence/db'
import { moveRequest } from './actions'

export const metadata: Metadata = { title: 'Data requests' }

// Sprint 3 — admin queue for client rights requests (consent withdrawal,
// access, correction, export, erasure, restriction). Manual fulfilment with
// audited status transitions. Empty/degraded until migration 0051 is applied.

const NEXT_STATES: Record<RightsRequestStatus, RightsRequestStatus[]> = {
  new:          ['acknowledged', 'in_progress', 'fulfilled', 'refused'],
  acknowledged: ['in_progress', 'fulfilled', 'refused'],
  in_progress:  ['fulfilled', 'refused'],
  fulfilled: [], refused: [], withdrawn: [],
}

function StatusBadge({ s }: { s: RightsRequestStatus }) {
  const colour: Record<RightsRequestStatus, string> = {
    new:          'bg-status-errorBg text-status-errorText border-status-errorBorder',
    acknowledged: 'bg-status-warningBg text-status-warningText border-status-warningBorder',
    in_progress:  'bg-status-infoBg text-status-infoText border-status-infoBorder',
    fulfilled:    'bg-status-successBg text-status-successText border-status-successBorder',
    refused:      'bg-surface-muted text-text-secondary border-border-default',
    withdrawn:    'bg-surface-muted text-text-muted border-border-default',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colour[s]}`}>
      {s.replace('_', ' ')}
    </span>
  )
}

export default async function RequestsQueuePage() {
  // Defence-in-depth admin guard (convention: layout + per-page)
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('https://natural-intelligence.uk')

  const requests = await listAllRightsRequests(adminClient)
  const open = requests.filter((r) => !['fulfilled', 'refused', 'withdrawn'].includes(r.status))
  const closed = requests.filter((r) => ['fulfilled', 'refused', 'withdrawn'].includes(r.status))

  function Row({ r }: { r: RightsRequestRow }) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-text-primary capitalize">{r.request_type.replace('_', ' ')}</span>
          <StatusBadge s={r.status} />
          <span className="text-xs text-text-muted font-mono">{r.member_id.slice(0, 8)}…</span>
          <span className="text-xs text-text-muted">{new Date(r.created_at).toLocaleString('en-GB')}</span>
        </div>
        {r.details && <p className="text-sm text-text-secondary mb-2">{r.details}</p>}
        {r.resolution_note && <p className="text-xs text-text-muted mb-2">Note: {r.resolution_note}</p>}
        {NEXT_STATES[r.status].length > 0 && (
          <div className="flex flex-wrap gap-2">
            {NEXT_STATES[r.status].map((to) => (
              <form key={to} action={moveRequest} className="inline-flex items-center gap-1">
                <input type="hidden" name="request_id" value={r.id} />
                <input type="hidden" name="from" value={r.status} />
                <input type="hidden" name="to" value={to} />
                {(to === 'fulfilled' || to === 'refused') && (
                  <input
                    name="note" placeholder="resolution note"
                    className="px-2 py-1 rounded border border-border-default bg-surface-base text-xs w-40"
                  />
                )}
                <button
                  type="submit"
                  className="px-3 py-1 rounded-full border border-border-default text-xs font-medium hover:bg-surface-muted capitalize"
                >
                  → {to.replace('_', ' ')}
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-text-primary mb-2">Data requests</h1>
      <p className="text-sm text-text-secondary mb-6 max-w-2xl">
        Client rights and consent-withdrawal requests, fulfilled manually.
        Every transition is audited (who, when, note). Available once migration
        0051 is applied.
      </p>

      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Open ({open.length})</h2>
      <div className="space-y-3 mb-8">
        {open.length === 0
          ? <p className="text-sm text-text-muted">No open requests.</p>
          : open.map((r) => <Row key={r.id} r={r} />)}
      </div>

      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Closed ({closed.length})</h2>
      <div className="space-y-3">
        {closed.length === 0
          ? <p className="text-sm text-text-muted">None yet.</p>
          : closed.map((r) => <Row key={r.id} r={r} />)}
      </div>
    </div>
  )
}
