// ─── PriorReviewsPanel ────────────────────────────────────────────────────────
// Completed work history on this case. Collapsed by default (addendum S4).
// Excludes the current work item (handled by getPriorReviews helper).
// Notes truncated to 100 characters for summary display.

import type { PriorReview } from '@natural-intelligence/db/practitioners'
import { CollapsibleSection } from './CollapsibleSection'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

interface PriorReviewsPanelProps {
  reviews: PriorReview[]
}

export function PriorReviewsPanel({ reviews }: PriorReviewsPanelProps) {
  const count    = reviews.length
  const subtitle = count > 0 ? `${count} review${count === 1 ? '' : 's'}` : undefined

  return (
    <CollapsibleSection
      id="prior-reviews"
      title="Prior Reviews"
      subtitle={subtitle}
      defaultExpanded={false}
      emptyState={count === 0 ? 'No prior reviews' : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {reviews.map(r => (
          <div
            key={r.workItemId}
            style={{
              padding:      '12px 14px',
              background:   '#FFFFFF',
              border:       '1px solid #E8E6E0',
              borderRadius: '6px',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: r.notes ? '8px' : 0 }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#1A1917', fontFamily: 'monospace' }}>
                  {r.workType}
                </span>
                {r.practitionerName && (
                  <span style={{ fontSize: '11px', color: '#8A8880' }}>
                    {r.practitionerName}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '11px', color: '#B0AEA8' }}>
                {formatDate(r.completedAt)}
              </span>
            </div>

            {/* Notes excerpt */}
            {r.notes && (
              <p style={{ fontSize: '12px', color: '#8A8880', margin: 0, lineHeight: '1.5' }}>
                {r.notes.length > 100 ? `${r.notes.slice(0, 100)}…` : r.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
}
