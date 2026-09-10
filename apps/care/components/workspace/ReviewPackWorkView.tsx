// ─── ReviewPackWorkView — de-identified workspace (Sprint 3) ─────────────────
// Rendered INSTEAD of the identified workspace when
// PRACTITIONER_REVIEW_PACKS_ENABLED is on. Shows ONLY the review pack:
// pseudonymous case reference (never a name), structured de-identified
// clinical fields, and the pack's data-minimisation note. When no pack
// exists the practitioner sees an explicit blocked state — the page never
// falls back to raw identified intake data.
//
// Deliberately absent: client full name / identity view, raw intake summary,
// case primary_concern free text, BioHub signals, narrative answers.

import { TopBar }      from '@/components/TopBar'
import { ActionPanel } from './ActionPanel'
import type { ReviewPackRow } from '@natural-intelligence/db/practitioners'

const FIELD_LABELS: Record<string, string> = {
  stressLevel:             'Stress level',
  sleepQuality:            'Sleep quality',
  energyLevel:             'Energy level',
  concernSeverity:         'Concern severity',
  postExertionalWorsening: 'Post-exertional worsening',
  arrivalEmotion:          'Arrival emotion',
  primarySystem:           'Primary system',
  primaryConcerns:         'Primary concerns',
  currentMedications:      'Current medications',
  currentSupplements:      'Current supplements',
  diagnosedConditions:     'Diagnosed conditions',
  symptomOnset:            'Symptom onset',
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(String).join(' · ') || '—'
  return String(value)
}

export function ReviewPackWorkView({
  pack,
  workItem,
  workId,
}: {
  pack: ReviewPackRow | null
  workItem: { work_type: string; status: string; due_at: string | null; started_at: string | null }
  workId: string
}) {
  const workType = workItem.work_type.replace(/_/g, ' ')
  const clinical = (pack?.pack?.clinical ?? {}) as Record<string, unknown>
  const clinicalKeys = Object.keys(clinical)

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917' }}>
      <TopBar
        breadcrumb={[
          { label: pack?.pseudonym ?? 'Case review' },
          { label: workType },
        ]}
      />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '11px', color: '#B0AEA8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>
            Case Review Workspace — de-identified
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize:   '28px',
            fontWeight: 400,
            color:      '#1A1917',
            margin:     '0 0 4px',
            lineHeight: '1.2',
          }}>
            {pack?.pseudonym ?? 'Review pack unavailable'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#8A8880', fontFamily: 'monospace' }}>
              {workItem.work_type}
            </span>
            {pack && (
              <span style={{ fontSize: '11px', background: '#F4F3F0', color: '#8A8880', padding: '2px 6px', borderRadius: '4px' }}>
                Pack v{pack.pack_version}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {pack === null ? (
              // Explicit blocked state — NO fallback to identified data.
              <section style={{
                background: '#FFFFFF', border: '1px solid #E8E6E1',
                borderRadius: '12px', padding: '32px', textAlign: 'center',
              }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px' }}>
                  No review pack available for this case
                </h2>
                <p style={{ fontSize: '14px', color: '#8A8880', margin: 0, lineHeight: 1.6 }}>
                  This workspace runs in de-identified mode. A review pack has not
                  been generated for this case, or your access to it has ended, so
                  no client data can be shown. Contact the NI clinical team to
                  request pack generation. Raw intake data is not accessible from
                  this view.
                </p>
              </section>
            ) : (
              <>
                <section style={{
                  background: '#FFFFFF', border: '1px solid #E8E6E1',
                  borderRadius: '12px', padding: '24px', marginBottom: '16px',
                }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8A8880', margin: '0 0 16px' }}>
                    De-identified clinical summary
                  </h2>
                  {clinicalKeys.length === 0 ? (
                    <p style={{ fontSize: '14px', color: '#8A8880', margin: 0 }}>
                      The pack contains no releasable structured fields.
                    </p>
                  ) : (
                    <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', margin: 0 }}>
                      {clinicalKeys.map((key) => (
                        <div key={key}>
                          <dt style={{ fontSize: '11px', color: '#B0AEA8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                            {FIELD_LABELS[key] ?? key}
                          </dt>
                          <dd style={{ fontSize: '14px', color: '#1A1917', margin: 0 }}>
                            {renderValue(clinical[key])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>
                {pack.pack.note && (
                  <p style={{ fontSize: '12px', color: '#8A8880', lineHeight: 1.6, margin: '0 0 16px' }}>
                    {pack.pack.note}
                  </p>
                )}
              </>
            )}
          </div>

          <ActionPanel
            workItemId={workId}
            status={workItem.status}
            dueAt={workItem.due_at}
            startedAt={workItem.started_at}
          />
        </div>
      </div>
    </main>
  )
}
