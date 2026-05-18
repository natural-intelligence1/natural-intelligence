// ─── CaseHistoryPanel ─────────────────────────────────────────────────────────
// Chronological log of case events. Collapsed by default (addendum S4).
// Shows event type, timestamp, and a one-line payload summary.

import type { CaseEvent } from '@natural-intelligence/db/practitioners'
import { CollapsibleSection } from './CollapsibleSection'

const EVENT_TYPE_LABELS: Record<string, string> = {
  intake_answer:      'Intake answer',
  follow_up_answer:   'Follow-up answer',
  lab_upload:         'Lab upload',
  gp_record_upload:   'GP record upload',
  grocery_receipt:    'Grocery receipt',
  practitioner_note:      'Practitioner note',
  practitioner_decision:  'Practitioner decision',
  protocol_update:        'Protocol update',
}

function formatPayloadSummary(eventType: string, payload: Record<string, unknown>): string {
  if (Object.keys(payload).length === 0) return '—'
  // Show a one-line summary from known payload shapes
  if (eventType === 'intake_answer' && payload.question_id) {
    return `Question: ${payload.question_id}`
  }
  if (eventType === 'lab_upload' && payload.file_name) {
    return `File: ${payload.file_name}`
  }
  if (eventType === 'practitioner_note' && payload.summary) {
    return String(payload.summary).slice(0, 80)
  }
  if (eventType === 'practitioner_decision' && payload.decision) {
    const label: Record<string, string> = {
      approved: 'Approved', needs_revision: 'Needs revision', escalated: '↑ Escalated',
    }
    const who = payload.practitioner_display_name ? ` · ${payload.practitioner_display_name}` : ''
    return `${label[String(payload.decision)] ?? String(payload.decision)}${who}`
  }
  // Fallback: first key-value pair
  const [k, v] = Object.entries(payload)[0]
  return `${k}: ${String(v).slice(0, 60)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface CaseHistoryPanelProps {
  events: CaseEvent[]
}

export function CaseHistoryPanel({ events }: CaseHistoryPanelProps) {
  const count    = events.length
  const subtitle = count > 0 ? `${count} event${count === 1 ? '' : 's'}` : undefined

  return (
    <CollapsibleSection
      id="case-history"
      title="Case History"
      subtitle={subtitle}
      defaultExpanded={false}
      emptyState={count === 0 ? 'No events recorded' : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {events.map(event => (
          <div
            key={event.id}
            style={{
              display:       'flex',
              gap:           '12px',
              padding:       '10px 12px',
              background:    '#FFFFFF',
              borderBottom:  '1px solid #F4F3F0',
              alignItems:    'flex-start',
            }}
          >
            {/* Event type label */}
            <div style={{ flexShrink: 0, minWidth: '140px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#1A1917' }}>
                {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
              </span>
            </div>

            {/* Payload summary */}
            <div style={{ flex: 1, fontSize: '12px', color: '#8A8880', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatPayloadSummary(event.eventType, event.eventPayload)}
            </div>

            {/* Timestamp */}
            <div style={{ flexShrink: 0, fontSize: '11px', color: '#B0AEA8' }}>
              {formatDate(event.createdAt)}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
}
