// ─── /cases — Practitioner Inbox ─────────────────────────────────────────────
// Replaces the original case-list page with a work-item inbox.
// Four sections: Needs Review / In Progress / Escalated / Completed Recently.
//
// Data: listWorkForInbox via admin client (see listWorkForInbox.ts for RLS note).
// practitionerId is always derived from the authenticated session.

import Link                    from 'next/link'
import type { Metadata }       from 'next'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import {
  listWorkForInbox,
  type InboxWorkItem,
  type InboxUrgency,
} from '@natural-intelligence/db/practitioners'
import { TopBar } from '@/components/TopBar'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Inbox — NI Care' }

// ─── Sorting helpers ──────────────────────────────────────────────────────────

function urgencyOrder(u: InboxUrgency): number {
  return u === 'overdue' ? 0 : u === 'watch' ? 1 : 2
}

function sortNeedsReview(items: InboxWorkItem[]): InboxWorkItem[] {
  // Overdue first, then by due_at ascending, then by assigned_at ascending
  return [...items].sort((a, b) => {
    const urgDiff = urgencyOrder(a.urgency) - urgencyOrder(b.urgency)
    if (urgDiff !== 0) return urgDiff
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt)
    if (a.dueAt) return -1
    if (b.dueAt) return 1
    return a.assignedAt.localeCompare(b.assignedAt)
  })
}

function sortInProgress(items: InboxWorkItem[]): InboxWorkItem[] {
  // Most recently started first
  return [...items].sort((a, b) =>
    (b.startedAt ?? b.assignedAt).localeCompare(a.startedAt ?? a.assignedAt),
  )
}

function sortEscalated(items: InboxWorkItem[]): InboxWorkItem[] {
  // Most recently changed (use assignedAt as proxy — escalated_at not on InboxWorkItem)
  return [...items].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatRelativeDate(iso: string, label: 'due' | 'started' | 'completed'): string {
  const d    = new Date(iso)
  const now  = Date.now()
  const diff = now - d.getTime()
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  const hrs  = Math.floor(diff / (60 * 60 * 1000))
  const mins = Math.floor(diff / (60 * 1000))

  if (label === 'due') {
    const future = d.getTime() - now
    if (future < 0) {
      const overdueDays = Math.abs(days)
      return overdueDays === 0 ? 'Overdue today' : `Overdue ${overdueDays}d`
    }
    const futureDays  = Math.floor(future / (24 * 60 * 60 * 1000))
    const futureHrs   = Math.floor(future / (60 * 60 * 1000))
    if (futureHrs < 24) return 'Due today'
    if (futureDays === 1) return 'Due tomorrow'
    if (futureDays <= 7) return `Due in ${futureDays}d`
    return `Due ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  }

  if (mins < 60)    return `${label === 'started' ? 'Started' : 'Completed'} ${mins}m ago`
  if (hrs < 24)     return `${label === 'started' ? 'Started' : 'Completed'} ${hrs}h ago`
  if (days === 1)   return `${label === 'started' ? 'Started' : 'Completed'} yesterday`
  if (days <= 7)    return `${label === 'started' ? 'Started' : 'Completed'} ${days}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ─── Urgency colours (per Section 11) ────────────────────────────────────────

const URGENCY_ROW: Record<InboxUrgency, React.CSSProperties> = {
  overdue: { background: '#FEF2F2', borderLeft: '3px solid #DC2626' },
  watch:   { background: '#FFFBEB', borderLeft: '3px solid #D97706' },
  normal:  { background: '#FFFFFF', borderLeft: '3px solid transparent' },
}

const URGENCY_LABEL: Record<InboxUrgency, React.CSSProperties> = {
  overdue: { color: '#DC2626', fontWeight: 600 },
  watch:   { color: '#D97706', fontWeight: 500 },
  normal:  { color: '#8A8880', fontWeight: 400 },
}

// ─── Work-item row ────────────────────────────────────────────────────────────

function WorkItemRow({
  item,
  secondaryLabel,
}: {
  item:           InboxWorkItem
  secondaryLabel: string
}) {
  const rowStyle: React.CSSProperties = {
    ...URGENCY_ROW[item.urgency],
    display:    'flex',
    alignItems: 'center',
    padding:    '14px 18px',
    gap:        '12px',
    textDecoration: 'none',
    color:      'inherit',
  }

  const inner = (
    <>
      {/* Urgency icon */}
      <span style={{ fontSize: '14px', flexShrink: 0, width: '16px' }}>
        {item.urgency === 'overdue' ? '⚠' : item.status === 'in_review' ? '◑' : item.status === 'escalated' ? '↑' : item.status === 'completed' ? '✓' : ''}
      </span>

      {/* Client + concern */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1917' }}>
          {item.clientName}
        </div>
        {item.primaryConcern && (
          <div style={{ fontSize: '12px', color: '#8A8880', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.primaryConcern}
            {item.caseComplexityScore > 0 ? ` · complexity ${item.caseComplexityScore}` : ''}
          </div>
        )}
      </div>

      {/* Work type */}
      <span style={{ fontSize: '12px', color: '#8A8880', fontFamily: 'monospace', flexShrink: 0 }}>
        {item.workType}
      </span>

      {/* Urgency / time label */}
      <span style={{ ...URGENCY_LABEL[item.urgency], fontSize: '12px', flexShrink: 0 }}>
        {secondaryLabel}
      </span>
    </>
  )

  // Completed and escalated items are read-only (no navigation to workspace for escalated)
  if (item.status === 'completed' || item.status === 'escalated') {
    return (
      <div style={rowStyle}>
        {inner}
      </div>
    )
  }

  return (
    <Link href={`/cases/${item.caseId}/work/${item.workItemId}`} style={rowStyle}>
      {inner}
    </Link>
  )
}

// ─── Section container ────────────────────────────────────────────────────────

function InboxSection({
  title,
  count,
  items,
  emptyMessage,
  children,
}: {
  title:        string
  count?:       number
  items?:       React.ReactNode
  emptyMessage: string
  children?:    React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8A8880' }}>
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span style={{ fontSize: '11px', color: '#8A8880' }}>({count})</span>
        )}
      </div>

      {/* Rows */}
      {children ?? (
        count === 0 ? (
          <p style={{ fontSize: '13px', color: '#B0AEA8', padding: '12px 0' }}>{emptyMessage}</p>
        ) : (
          <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #E8E6E0', display: 'flex', flexDirection: 'column', gap: '1px', background: '#E8E6E0' }}>
            {items}
          </div>
        )
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function InboxPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  const practitionerId = user?.id ?? ''

  // Fetch practitioner display_name for the top bar
  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('display_name')
    .eq('id', practitionerId)
    .maybeSingle()

  let allItems: InboxWorkItem[] = []
  try {
    allItems = await listWorkForInbox(supabase, practitionerId)
  } catch {
    // Render an empty inbox with an error note — do not throw to the error boundary
    return (
      <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917' }}>
        <TopBar practitionerName={practitioner?.display_name ?? undefined} />
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px' }}>
          <p style={{ color: '#DC2626', fontSize: '14px' }}>
            Could not load your inbox. Refresh to try again.
          </p>
        </div>
      </main>
    )
  }

  const needsReview     = sortNeedsReview(allItems.filter(i => i.status === 'assigned'))
  const inProgress      = sortInProgress(allItems.filter(i => i.status === 'in_review'))
  const escalated       = sortEscalated(allItems.filter(i => i.status === 'escalated'))
  const completedItems  = allItems.filter(i => i.status === 'completed') // already capped at 5 by helper

  const totalOpen = needsReview.length + inProgress.length

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917' }}>
      <TopBar practitionerName={practitioner?.display_name ?? undefined} />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px' }}>

        {/* Page header */}
        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8A8880', marginBottom: '6px' }}>
            Practitioner Inbox
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px' }}>
            {totalOpen > 0
              ? `${totalOpen} item${totalOpen === 1 ? '' : 's'} need${totalOpen === 1 ? 's' : ''} review`
              : 'All reviews complete'}
          </h1>
        </div>

        {/* ── Needs Review ──────────────────────────────────────────────────── */}
        <InboxSection
          title="Needs Review"
          count={needsReview.length}
          emptyMessage=""
          items={needsReview.map(item => (
            <WorkItemRow
              key={item.workItemId}
              item={item}
              secondaryLabel={
                item.dueAt ? formatRelativeDate(item.dueAt, 'due') : ''
              }
            />
          ))}
        >
          {needsReview.length === 0 && (
            <p style={{ fontSize: '13px', color: '#B0AEA8', padding: '12px 0' }}>
              No assigned work. New cases will appear here when your next review is assigned.
            </p>
          )}
        </InboxSection>

        {/* ── In Progress ───────────────────────────────────────────────────── */}
        {inProgress.length > 0 && (
          <InboxSection
            title="In Progress"
            count={inProgress.length}
            emptyMessage=""
            items={inProgress.map(item => (
              <WorkItemRow
                key={item.workItemId}
                item={item}
                secondaryLabel={
                  item.startedAt ? formatRelativeDate(item.startedAt, 'started') : ''
                }
              />
            ))}
          />
        )}

        {/* ── Escalated ─────────────────────────────────────────────────────── */}
        {escalated.length > 0 && (
          <InboxSection
            title="Escalated"
            count={escalated.length}
            emptyMessage=""
            items={escalated.map(item => (
              <WorkItemRow
                key={item.workItemId}
                item={item}
                secondaryLabel="Awaiting admin"
              />
            ))}
          />
        )}

        {/* ── Completed Recently ────────────────────────────────────────────── */}
        {completedItems.length > 0 && (
          <InboxSection
            title="Completed Recently"
            emptyMessage=""
            items={completedItems.map(item => (
              <WorkItemRow
                key={item.workItemId}
                item={item}
                secondaryLabel={
                  item.completedAt ? formatRelativeDate(item.completedAt, 'completed') : ''
                }
              />
            ))}
          />
        )}

        {/* All-empty state */}
        {allItems.length === 0 && (
          <p style={{ fontSize: '14px', color: '#8A8880', marginTop: '16px' }}>
            No assigned work. New cases will appear here when your next review is assigned.
          </p>
        )}
      </div>
    </main>
  )
}
