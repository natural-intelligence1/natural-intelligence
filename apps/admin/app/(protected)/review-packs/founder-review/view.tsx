import Link from 'next/link'
import type {
  FounderReviewCase,
  FounderReviewRefusal,
  FounderReviewListRow,
} from '@natural-intelligence/db/crt'
import {
  REVIEW_SECTIONS,
  RETIRED_RESPONSE_FIELDS,
  RECORD_FIELDS,
  RESPONSE_METADATA_COLUMNS,
  REGISTERED_RESPONSE_KEYS,
  REGISTERED_KEYS,
  type ReviewField,
} from './fields'

// ─── Founder Review Mode — presentation ──────────────────────────────────────
// Separated from the route so the admin guard and the data read sit in the
// page and this file does nothing but render what it was handed. It takes a
// FounderReviewCase as a prop and has no client, no query and no fallback: if
// a field is absent from the data, it says so.
//
// No form, no button, no input, no action, no mutation verb. Asserted by
// packages/db/src/crt/founderReviewBoundary.test.ts, which sweeps this whole
// directory rather than trusting the claim.

const NOT_ANSWERED = 'Not answered'

/** Render a stored value honestly. Each shape gets its own plain-English form,
 *  and the differences matter clinically: a question never reached is not the
 *  same as one reached and left blank, and an empty multi-select is not the
 *  same as no answer at all. */
export function present(value: unknown): { text: string; answered: boolean } {
  if (value === null || value === undefined) return { text: NOT_ANSWERED, answered: false }
  if (typeof value === 'string') {
    const t = value.trim()
    return t === '' ? { text: 'Reached, left blank', answered: false } : { text: value, answered: true }
  }
  if (typeof value === 'boolean') return { text: value ? 'Yes' : 'No', answered: true }
  if (typeof value === 'number') return { text: String(value), answered: true }
  if (Array.isArray(value)) {
    return value.length === 0
      ? { text: 'Reached, nothing selected', answered: false }
      : {
          text: value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' · '),
          answered: true,
        }
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
    )
    return entries.length === 0
      ? { text: 'Reached, nothing recorded', answered: false }
      : {
          text: entries
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
            .join(' · '),
          answered: true,
        }
  }
  return { text: String(value), answered: true }
}

function ukDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ukDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${day}, ${time}`
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-border-default bg-surface-raised">
      <div className="px-5 py-3 border-b border-border-muted">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {note && <p className="text-xs text-text-muted mt-0.5">{note}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,17rem)_1fr] gap-x-6 gap-y-2.5">
      {rows.map(([k, v], i) => (
        <div key={i} className="sm:contents">
          <dt className="text-xs text-text-muted sm:py-0.5">{k}</dt>
          <dd className="text-sm text-text-primary sm:py-0.5 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function AnswerRow({
  field,
  value,
  fromAnswerRowOnly = false,
}: {
  field: ReviewField
  value: unknown
  /** The denormalised column is empty and this came from intake_answers. */
  fromAnswerRowOnly?: boolean
}) {
  const { text, answered } = present(value)
  return (
    <div className="py-2.5 border-t border-border-muted first:border-t-0">
      <p className="text-xs text-text-muted mb-1">
        {field.label}
        {field.conditional && !answered && (
          <span className="ml-1.5">· conditional, may not have been shown</span>
        )}
        {fromAnswerRowOnly && (
          <span className="ml-1.5">· recorded in intake_answers only, column is empty</span>
        )}
      </p>
      <p className={answered ? 'text-sm text-text-primary break-words' : 'text-sm text-text-muted italic'}>
        {text}
      </p>
    </div>
  )
}

function TestBadge() {
  return (
    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-status-warningBg text-status-warningText border border-status-warningBorder align-middle">
      TEST
    </span>
  )
}

/** The case picker. Receives rows already restricted to test clients by
 *  listFounderReviewCases — it applies no filter of its own, because a filter
 *  in the markup is one a later refactor can drop without anyone noticing. */
export function FounderReviewPickerView({ rows }: { rows: FounderReviewListRow[] }) {
  return (
    <div className="p-8 max-w-3xl">
      <Link href="/review-packs" className="text-xs text-text-brand hover:underline">
        ← Review packs
      </Link>
      <h1 className="text-2xl font-semibold text-text-primary mt-3 mb-1">Founder Review</h1>
      <p className="text-sm text-text-secondary mb-6 max-w-2xl">
        Real test-case data · Read only. Open a test case to see what the practitioner would
        receive: the canonical case row and its linked Intake. Nothing on these pages can be
        changed, and no practitioner authority is granted. Test clients only — a case whose client
        is not marked as test data is refused.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          No test cases. A case appears here only when its client profile has is_test_data set.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.caseId}>
              <Link
                href={`/review-packs/founder-review/${c.caseId}`}
                className="block px-4 py-3 rounded-lg bg-surface-raised border border-border-default hover:border-border-muted"
              >
                <p className="text-sm font-medium text-text-primary">
                  {c.clientName ?? 'No name on profile'}
                  <TestBadge />
                </p>
                <p className="text-xs text-text-muted mt-0.5 font-mono break-all">{c.caseId}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {c.status}
                  {c.createdAt ? ` · created ${ukDate(c.createdAt)}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Shown instead of any content when the case is not an eligible test case. */
export function FounderReviewRefusedView({
  caseId,
  refusal,
}: {
  caseId: string
  refusal: FounderReviewRefusal
}) {
  const message =
    refusal === 'not_test_data'
      ? 'This case belongs to a client whose profile is not marked as test data. Founder Review Mode is restricted to test cases and will not display real health records.'
      : refusal === 'case_not_found'
        ? 'No case exists with that identifier.'
        : 'The client profile for this case could not be found, so the test-data restriction cannot be verified. Refusing to display content.'
  return (
    <div className="p-8 max-w-3xl">
      <Link href="/review-packs/founder-review" className="text-xs text-text-brand hover:underline">
        ← Founder Review
      </Link>
      <h1 className="text-2xl font-semibold text-text-primary mt-3 mb-4">Review refused</h1>
      <div className="px-4 py-3 rounded-md bg-status-warningBg text-status-warningText border border-status-warningBorder text-sm">
        {message}
      </div>
      <p className="text-xs text-text-muted mt-4 font-mono break-all">{caseId}</p>
    </div>
  )
}

export function FounderReviewView({ data: c }: { data: FounderReviewCase }) {
  const answerByKey = new Map(c.answers.map((a) => [a.questionId, a.value]))
  const responseValues = c.response?.values ?? {}

  /**
   * Resolve a field from whichever canonical row actually holds it.
   *
   * The form's persist() writes BOTH the denormalised intake_responses column
   * and a per-question intake_answers row. They can disagree — Tree Khan has
   * a most_want_to_understand answer row while the column is NULL — and when
   * they do, reporting "Not answered" from the column alone would be wrong:
   * the client reached the question. So the answer row is used as the
   * fallback, and the page says where the value came from.
   */
  const resolve = (field: ReviewField): { value: unknown; fromAnswerRowOnly: boolean } => {
    if (field.source === 'answer') {
      return { value: answerByKey.get(field.key), fromAnswerRowOnly: false }
    }
    const column = responseValues[field.key]
    if ((column === null || column === undefined) && answerByKey.has(field.key)) {
      return { value: answerByKey.get(field.key), fromAnswerRowOnly: true }
    }
    return { value: column, fromAnswerRowOnly: false }
  }

  // Anything stored that this registry does not label. Surfaced rather than
  // dropped: a review surface that silently hides a populated column is not a
  // review surface.
  const unregisteredColumns = Object.entries(responseValues).filter(
    ([k, v]) =>
      !RESPONSE_METADATA_COLUMNS.has(k) &&
      !REGISTERED_RESPONSE_KEYS.has(k) &&
      v !== null &&
      v !== undefined,
  )
  // Checked against BOTH key sets: persist() dual-writes, so a question
  // labelled as a column is also a legitimate answer row.
  const unregisteredAnswers = c.answers.filter((a) => !REGISTERED_KEYS.has(a.questionId))
  const retiredWithValues = RETIRED_RESPONSE_FIELDS.filter(
    (f) => responseValues[f.key] !== null && responseValues[f.key] !== undefined,
  )

  const linkageOk = c.response !== null && c.response.linkedCaseId === c.caseId

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/review-packs/founder-review" className="text-xs text-text-brand hover:underline">
        ← Founder Review
      </Link>

      <div className="mt-3 mb-5 px-4 py-3 rounded-md bg-status-infoBg text-status-infoText border border-status-infoBorder">
        <p className="text-sm font-semibold">Founder Review Mode</p>
        <p className="text-xs mt-0.5">
          Real test-case data · Read only. This page reads the canonical case and Intake rows and
          cannot change them. It does not confer practitioner, Lead or LRP authority, and no
          clinical interpretation is generated here.
        </p>
      </div>

      <h1 className="text-2xl font-semibold text-text-primary mb-1">
        {c.client.displayName ?? 'Client has no name on their profile'}
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        What the practitioner would receive for this case.
      </p>

      <Panel title="Case">
        <Facts
          rows={[
            [
              'Client',
              <span key="n">
                {c.client.displayName ?? <span className="text-text-muted italic">No name on profile</span>}
                <TestBadge />
              </span>,
            ],
            ['Case ID', <span key="c" className="font-mono text-xs break-all">{c.caseId}</span>],
            ['Case status', c.status],
            ['Created', ukDateTime(c.createdAt)],
            ['Last updated', ukDateTime(c.updatedAt)],
            [
              'Primary concern on case',
              c.primaryConcern ?? <span className="text-text-muted italic">Not set</span>,
            ],
          ]}
        />
      </Panel>

      <Panel title="Intake state">
        {c.response === null ? (
          <p className="text-sm text-text-muted italic">
            No Intake response. This member has no row in intake_responses.
          </p>
        ) : (
          <Facts
            rows={[
              ['Intake version', c.response.version !== null ? `v${c.response.version}` : '—'],
              ['Completion', c.response.isComplete ? 'Completed' : 'In progress'],
              ['Completion recorded', c.response.isComplete ? ukDateTime(c.response.updatedAt) : '—'],
              [
                'Section progress',
                c.response.completedSections !== null
                  ? `${c.response.completedSections} sections recorded as complete`
                  : '—',
              ],
              ['Response ID', <span key="r" className="font-mono text-xs break-all">{c.response.id}</span>],
              [
                'Case linkage',
                linkageOk ? (
                  <span key="l" className="text-status-successText break-all">
                    Linked to this case · {c.response.linkedCaseId}
                  </span>
                ) : c.response.linkedCaseId === null ? (
                  <span key="l" className="text-status-warningText">
                    Not linked — intake_responses.case_id is NULL
                  </span>
                ) : (
                  <span key="l" className="text-status-errorText break-all">
                    Linked to a DIFFERENT case · {c.response.linkedCaseId}
                  </span>
                ),
              ],
              [
                'AI analysis consent',
                c.response.consentToAi === null
                  ? 'Not recorded'
                  : c.response.consentToAi
                    ? `Given${c.response.consentGivenAt ? ` on ${ukDate(c.response.consentGivenAt)}` : ''}`
                    : 'Not given',
              ],
              ...RECORD_FIELDS.map((f): [string, React.ReactNode] => {
                const { text, answered } = present(responseValues[f.key])
                return [f.label, answered ? text : <span className="text-text-muted italic">{text}</span>]
              }),
            ]}
          />
        )}
      </Panel>

      <Panel title="Intake session" note="The session row records how the client moved through the form.">
        {c.session === null ? (
          <p className="text-sm text-text-muted italic">
            No Intake session. This member has no row in intake_sessions.
          </p>
        ) : (
          <Facts
            rows={[
              ['Session status', c.session.status],
              ['Started', ukDateTime(c.session.startedAt)],
              ['Completed', ukDateTime(c.session.completedAt)],
              [
                'Position when last saved',
                c.session.currentSection ?? <span className="text-text-muted italic">—</span>,
              ],
              [
                'Progress recorded on session',
                c.session.completionPercentage !== null ? `${c.session.completionPercentage}%` : '—',
              ],
              [
                'Questions answered / shown',
                `${c.session.answeredCount ?? 0} / ${c.session.visibleCount ?? 0}`,
              ],
              ['Safety prompts flagged', String(c.session.redFlagCount ?? 0)],
              ['Stored answer rows', `${c.answers.length} in intake_answers`],
            ]}
          />
        )}
      </Panel>

      <Panel
        title="Client-reported content"
        note="The client's own answers, as stored. Nothing here is interpreted, scored or summarised."
      >
        {c.response === null && c.answers.length === 0 ? (
          <p className="text-sm text-text-muted italic">
            No Intake response and no stored answers, so there is nothing the client has reported.
          </p>
        ) : (
          <div className="space-y-6">
            {REVIEW_SECTIONS.map((section) => {
              const answeredCount = section.fields.filter((f) => present(resolve(f).value).answered).length
              return (
                <div key={section.id}>
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      {section.title}
                    </h3>
                    <span className="text-[11px] text-text-muted shrink-0">
                      {answeredCount} of {section.fields.length} answered
                    </span>
                  </div>
                  <div>
                    {section.fields.map((f) => {
                      const r = resolve(f)
                      return (
                        <AnswerRow
                          key={`${f.source}:${f.key}`}
                          field={f}
                          value={r.value}
                          fromAnswerRowOnly={r.fromAnswerRowOnly}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {retiredWithValues.length > 0 && (
        <Panel
          title="Retired fields holding a value"
          note="The form no longer asks these. Shown because the column is not empty."
        >
          {retiredWithValues.map((f) => (
            <AnswerRow key={f.key} field={f} value={responseValues[f.key]} />
          ))}
        </Panel>
      )}

      {(unregisteredColumns.length > 0 || unregisteredAnswers.length > 0) && (
        <Panel
          title="Stored but unlabelled"
          note="Present in the database with no question wording in this registry. Shown so nothing stored is hidden."
        >
          {unregisteredColumns.map(([k, v]) => (
            <AnswerRow key={`col:${k}`} field={{ key: k, label: k, source: 'response' }} value={v} />
          ))}
          {unregisteredAnswers.map((a) => (
            <AnswerRow
              key={`ans:${a.id}`}
              field={{ key: a.questionId, label: a.questionId, source: 'answer' }}
              value={a.value}
            />
          ))}
        </Panel>
      )}

      <Panel
        title="Case-taking state"
        note="The practitioner consultation record. Written by the consultation workflow, which is not yet active."
      >
        {c.consultations.length === 0 ? (
          <p className="text-sm text-text-muted italic">
            No consultation recorded yet. This case has no rows in case_taking_sessions.
          </p>
        ) : (
          <div className="space-y-2">
            {c.consultations.map((s) => (
              <div key={s.id} className="py-2 border-t border-border-muted first:border-t-0">
                <p className="text-sm text-text-primary">
                  Consultation {s.seq ?? '—'} · {s.kind ?? 'kind not recorded'} · {s.state}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {s.answerCount} answers recorded
                  {s.signedOffAt ? ` · signed off ${ukDateTime(s.signedOffAt)}` : ' · not signed off'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Released plan" note="The signed protocol a client would see.">
        <p className="text-sm text-text-muted italic">
          No released plan. A plan is released from a signed-off consultation, and this case has none.
        </p>
      </Panel>

      <Panel title="Not available in Founder Review Mode">
        <p className="text-sm text-text-secondary mb-2">
          The practitioner workflow will offer the actions below. None of them exists on this page —
          they are not disabled controls, they are absent, and this route has no write pathway at all.
        </p>
        <p className="text-sm text-text-muted">
          Save · Verify · Amend · Add observation · Submit to Lead · Ready for sign-off · Sign off ·
          Revise protocol
        </p>
      </Panel>

      <p className="text-xs text-text-muted">
        Read from client_cases, profiles, intake_responses, intake_sessions, intake_answers,
        case_taking_sessions and case_taking_answers. One case identity — no preview copy, no
        snapshot, no fixture.
      </p>
    </div>
  )
}
