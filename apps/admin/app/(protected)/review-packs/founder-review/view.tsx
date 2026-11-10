import Link from 'next/link'
import type {
  FounderReviewCase,
  FounderReviewRefusal,
  FounderReviewListRow,
} from '@natural-intelligence/db/crt'
import type {
  CanonicalAnswer,
  CanonicalIntake,
  SupportLevel,
} from '@natural-intelligence/db/intake'

// ─── Founder Review Mode — presentation ──────────────────────────────────────
// Separated from the route so the admin guard and the data read sit in the
// page and this file does nothing but render what it was handed.
//
// It resolves NOTHING. Every answer arrives already decided by the shared
// canonical projection (packages/db getCanonicalIntake): which store won, how
// the shape was normalised, which session it came from, what was superseded.
// The bespoke "column empty, intake_answers has a value" fallback that used to
// live here is gone — that judgement belongs in one place, and this is not it.
//
// No form, no button, no input, no action, no mutation verb. Asserted by
// packages/db/src/crt/founderReviewBoundary.test.ts, which sweeps this whole
// directory rather than trusting the claim.

/** How a stored value reads as English. Shape-aware, never interpretive. */
function present(a: CanonicalAnswer): string {
  if (a.status === 'unanswered') return 'Not answered'

  const v = a.value
  if (v === null || v === undefined) return 'Not answered'

  if (typeof v === 'object' && v !== null && 'supported' in (v as object)) {
    const s = v as SupportLevel
    if (s.key) return s.key.replace(/_/g, ' ')
    if (s.supported !== null) return s.supported ? 'Supported' : 'Not supported'
    return 'Reached, nothing recorded'
  }

  if (typeof v === 'string') return v.trim() === '' ? 'Reached, left blank' : v
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) {
    return v.length === 0
      ? 'Reached, nothing selected'
      : v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' · ')
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>).filter(
      ([, x]) => x !== null && x !== undefined && x !== '' && !(Array.isArray(x) && x.length === 0),
    )
    return entries.length === 0
      ? 'Reached, nothing recorded'
      : entries.map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join(', ') : String(x)}`).join(' · ')
  }
  return String(v)
}

function presentRaw(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.length === 0 ? 'Empty list' : v.map(String).join(' · ')
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  return s.trim() === '' ? 'Empty' : s
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

/** One canonical answer, with its provenance shown only where it matters. */
function AnswerRow({ answer }: { answer: CanonicalAnswer }) {
  const text = present(answer)
  const plain = answer.status === 'answered'
  const notes: string[] = []

  if (answer.conditional && answer.status === 'unanswered') {
    notes.push('conditional, may not have been shown')
  }
  // Provenance worth surfacing: the answer store disagreed with the legacy
  // column, or the legacy column is all that survives.
  if (answer.source === 'legacy_column') {
    notes.push('from the legacy column — no answer row exists')
  }
  if (answer.superseded.length > 0) {
    notes.push(
      answer.superseded.length === 1
        ? 'revised — 1 earlier answer on record'
        : `revised — ${answer.superseded.length} earlier answers on record`,
    )
  }

  return (
    <div className="py-2.5 border-t border-border-muted first:border-t-0">
      <p className="text-xs text-text-muted mb-1">
        {answer.label}
        {notes.map((n) => (
          <span key={n} className="ml-1.5">
            · {n}
          </span>
        ))}
      </p>
      <p className={plain ? 'text-sm text-text-primary break-words' : 'text-sm text-text-muted italic'}>
        {text}
      </p>
      {answer.superseded.length > 0 && (
        <details className="mt-1.5">
          <summary className="text-[11px] text-text-brand cursor-pointer">Earlier answers</summary>
          <ul className="mt-1 pl-3 border-l border-border-muted space-y-1">
            {answer.superseded.map((s, i) => (
              <li key={i} className="text-xs text-text-muted break-words">
                {presentRaw(s.value)}
                <span className="ml-1.5">· {ukDateTime(s.answeredAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
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

function IntakeStatePanel({ intake, caseId }: { intake: CanonicalIntake; caseId: string }) {
  const c = intake.completion
  if (c === null) {
    return (
      <Panel title="Intake state">
        <p className="text-sm text-text-muted italic">
          No Intake response. This member has no row in intake_responses.
        </p>
      </Panel>
    )
  }

  const linkageOk = c.linkedCaseId === caseId

  return (
    <Panel title="Intake state">
      <Facts
        rows={[
          ['Intake version', c.version !== null ? `v${c.version}` : '—'],
          ['Completion', c.isComplete ? 'Completed' : 'In progress'],
          ['Completion recorded', c.isComplete ? ukDateTime(c.updatedAt) : '—'],
          [
            'Section progress',
            c.completedSections !== null
              ? `${c.completedSections} sections recorded as complete`
              : '—',
          ],
          [
            'Questions answered',
            `${intake.answeredCount} of ${intake.questionCount} in the question registry`,
          ],
          ['Response ID', <span key="r" className="font-mono text-xs break-all">{c.responseId}</span>],
          [
            'Case linkage',
            linkageOk ? (
              <span key="l" className="text-status-successText break-all">
                Linked to this case · {c.linkedCaseId}
              </span>
            ) : c.linkedCaseId === null ? (
              <span key="l" className="text-status-warningText">
                Not linked — intake_responses.case_id is NULL
              </span>
            ) : (
              <span key="l" className="text-status-errorText break-all">
                Linked to a DIFFERENT case · {c.linkedCaseId}
              </span>
            ),
          ],
          [
            'AI analysis consent',
            c.consentToAi === null
              ? 'Not recorded'
              : c.consentToAi
                ? `Given${c.consentGivenAt ? ` on ${ukDate(c.consentGivenAt)}` : ''}`
                : 'Not given',
          ],
        ]}
      />
    </Panel>
  )
}

export function FounderReviewView({ data: c }: { data: FounderReviewCase }) {
  const intake = c.intake

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

      <IntakeStatePanel intake={intake} caseId={c.caseId} />

      <Panel
        title="Intake sessions"
        note="Every sitting the client has had at the form. Older sessions are history and are kept."
      >
        {intake.sessions.length === 0 ? (
          <p className="text-sm text-text-muted italic">
            No Intake session. This member has no row in intake_sessions.
          </p>
        ) : (
          <div className="space-y-2">
            {intake.sessions.map((s) => (
              <div key={s.id} className="py-2 border-t border-border-muted first:border-t-0">
                <p className="text-sm text-text-primary">
                  {s.status}
                  {s.canonicalCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-status-successBg text-status-successText border border-status-successBorder align-middle">
                      {s.canonicalCount} CURRENT
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  started {ukDateTime(s.startedAt)}
                  {s.completedAt ? ` · completed ${ukDateTime(s.completedAt)}` : ' · not completed'}
                  {` · ${s.answerCount} answer rows, ${s.canonicalCount} still the current answer`}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5 font-mono break-all">{s.id}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Client-reported content"
        note="The client's own answers, resolved by the shared canonical projection. Nothing here is interpreted, scored or summarised."
      >
        {intake.answeredCount === 0 && intake.sessions.length === 0 && intake.completion === null ? (
          <p className="text-sm text-text-muted italic">
            No Intake response and no stored answers, so there is nothing the client has reported.
          </p>
        ) : (
          <div className="space-y-6">
            {intake.sections.map((section) => (
              <div key={section.id}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    {section.title}
                  </h3>
                  <span className="text-[11px] text-text-muted shrink-0">
                    {section.answeredCount} of {section.answers.length} answered
                  </span>
                </div>
                <div>
                  {section.answers.map((a) => (
                    <AnswerRow key={a.questionId} answer={a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {intake.legacyOnly.length > 0 && (
        <Panel
          title="Legacy fields holding a value"
          note="Columns with no question behind them. Shown because they are not empty."
        >
          <Facts
            rows={intake.legacyOnly.map((f): [string, React.ReactNode] => [
              `${f.label}${f.kind === 'stale' ? ' · retired' : ' · derived'}`,
              presentRaw(f.value),
            ])}
          />
        </Panel>
      )}

      {intake.unregistered.length > 0 && (
        <Panel
          title="Stored but unlabelled"
          note="Answer rows with no entry in the question registry. Shown so nothing stored is hidden."
        >
          {intake.unregistered.map((a) => (
            <AnswerRow key={a.questionId} answer={a} />
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
        Answers resolved by the shared canonical Intake projection over client_cases, profiles,
        intake_responses, intake_sessions, intake_answers, case_taking_sessions and
        case_taking_answers. One case identity — no preview copy, no snapshot, no fixture.
      </p>
    </div>
  )
}
