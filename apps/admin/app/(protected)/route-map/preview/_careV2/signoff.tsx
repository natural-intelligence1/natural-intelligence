// ─── Care V2 previews — context banner + formal sign-off panel ────────────────
// Display-only/inert: there is no approval mechanism in the codebase yet, so
// this panel RECORDS the required parties and their current status — it does
// not collect signatures. Defaults are "Not yet approved / Not yet reviewed"
// for every non-technical party; only the technical row states what is
// actually true of this branch build. Nothing here implies KR, clinical or
// legal approval — none has been recorded.

import { C, display, body } from './ui'

/** Task-1 clarity copy: these are ADMIN-APP BRANCH previews, not a second
 *  route-map, not production, not public, not live-data surfaces. */
export function PreviewContextBanner() {
  return (
    <div className="rounded-lg px-4 py-3 text-[12px] leading-relaxed mb-4"
      style={{ ...body, background: '#EDE4D2', border: `1px solid ${C.border}`, color: C.text2 }}>
      <span style={{ fontWeight: 600, color: C.pine }}>Internal admin preview — branch only.</span>{' '}
      This page is not on production until KR approves merge/deploy. The production admin route-map
      remains{' '}
      <span className="font-mono text-[11px]" style={{ color: C.pine }}>admin.natural-intelligence.uk/route-map</span>
      {' '}— this preview lives inside that same admin app, on a review branch. Synthetic data only;
      not a live-data practitioner surface; not a public website page.
    </div>
  )
}

// ─── Sign-off structure (approved wording) ────────────────────────────────────

interface SignOffParty {
  key: string
  party: string
  status: string
  statusOptions: string[]
  items: string[]
  evidence?: boolean
}

const SIGN_OFF_PARTIES: SignOffParty[] = [
  {
    key: 'A',
    party: 'KR / Founder / Product Owner',
    status: 'Not yet approved',
    statusOptions: ['Not yet approved', 'Approved for visual direction', 'Approved for Code build', 'Approved for merge', 'Approved for live-data use'],
    items: [
      'Intake flow and UX',
      'Synopsis structure and density',
      'Safety block placement/tone',
      'Ask-once/profile-confirmation model',
      'Food diary vs good/average/difficult-day UX',
      'Timeline centrepiece',
    ],
  },
  {
    key: 'B',
    party: 'Clinical Reviewer / Lead Practitioner Reviewer',
    status: 'Not yet reviewed',
    statusOptions: ['Not yet reviewed', 'Reviewed with changes', 'Clinically approved for synthetic preview', 'Clinically approved for live-data use'],
    items: [
      'safety_capture trigger set',
      'System symptom option sets',
      'Reproductive questions',
      'Family mental-health wording',
      'Missing-information prompts',
      'Practitioner call-sheet prompts',
      'Physical observation fields',
    ],
  },
  {
    key: 'C',
    party: 'Solicitor / Legal-Governance Reviewer',
    // Recorded ruling, relayed by KR 18 Sep 2026 (docs/governance/
    // solicitor-rulings-2026-09.md): LEGAL SECOND PASS — GREEN.
    // Architecture approved. Live-data activation NOT yet approved: EIGHT
    // mandatory implementation controls are required first (each its own
    // gate — never merged), and the full intake-question wording review is
    // a SEPARATE open legal-review item, not one of the eight.
    status: 'LEGAL SECOND PASS — GREEN · Architecture approved · Live-data activation not yet approved (8 controls required)',
    statusOptions: ['Not yet reviewed', 'Reviewed with changes', 'Approved for synthetic preview', 'Approved for live-data use'],
    items: [
      'Control 1: field-purpose / data-minimisation metadata',
      'Control 2: clear "not continuously monitored / not for emergencies" wording',
      'Control 3: safeguarding / escalation SOP for serious information actually seen by NI',
      'Control 4: complete summary provenance / audit metadata',
      'Control 5: retention / deletion rules in the field registry',
      'Control 6: supervised/student access and audit controls',
      'Control 7: practitioner-only Analysis & Plan / sign-off',
      'Control 8: hard LEGAL/MHRA REVIEW REQUIRED change-control gate (its own gate) before adding confidence scores; NI-generated severity/risk scores; diagnostic or dysfunction labels; disease prediction; personalised red-flag triage; inferred causes/root causes; treatment recommendations; supplement recommendations; dosage guidance; ranked practitioner options; practitioner-facing clinical decision support; automated Analysis & Plan content; automatic care-plan generation; or claims that NI diagnoses, detects, predicts, treats, manages or recommends',
      'SEPARATE open item (not one of the eight): full intake-question wording review outstanding',
    ],
  },
  {
    key: 'D',
    party: 'Data Protection / Governance',
    status: 'Not yet reviewed',
    statusOptions: ['Not yet reviewed', 'Approved for internal synthetic preview', 'Approved for live-data processing'],
    items: [
      'Data minimisation',
      'Frozen case_snapshot scope',
      'Profile vs case data split',
      'Withdrawal/restriction behaviour',
      'Retention handling',
      'Audit trail',
    ],
  },
  {
    key: 'E',
    party: 'Technical / Code',
    status: 'Built as synthetic branch preview only',
    statusOptions: ['Built on branch', 'Tests passed', 'Main untouched', 'Production untouched', 'No migrations', 'No live-data wiring'],
    evidence: true,
    items: [
      'Branch: care-v2-preview-synthetic (from main 2747f83)',
      'Registry + mapping + previews on branch; 55/55 intakeV2 tests',
      'Type-check, lint and full admin production build pass',
      'Controlled-language sweep: hits only in negations, boundary text or attributed field IDs',
      'No real or anonymised client data — one invented fixture ("Rowan Example")',
      'No assignment, 0052, 0055 or pricing changes; no migrations applied; main and production untouched',
    ],
  },
]

export const FINAL_GATE_TEXT =
  'Not approved for live-data use until KR, clinical reviewer, solicitor/legal-governance ' +
  'reviewer and technical verifier have all signed off. Live-data wiring requires separate ' +
  'KR authorisation and the approved Sprint 3-compatible data-access model.'

/** The formal sign-off panel — display-only. */
export function SignOffPanel({ surface }: { surface: string }) {
  return (
    <section className="rounded-2xl p-6 mt-8" style={{ background: C.warm, border: `1px solid ${C.gold}` }}>
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase mb-1" style={{ color: C.goldInk }}>Sign-off record</p>
      <h2 className="text-[22px] font-medium mb-1" style={{ ...display, color: C.pine }}>Approvals for {surface}</h2>
      <p className="text-[12px] mb-5 leading-relaxed" style={{ ...body, color: C.muted }}>
        Display-only record — no approval is collected through this page. Statuses below are the
        current defaults; a status changes only when the named party records it through governance.
      </p>

      <div className="space-y-4">
        {SIGN_OFF_PARTIES.map((party) => (
          <div key={party.key} className="rounded-xl p-4" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
              <p className="text-[14px] font-medium" style={{ ...body, color: C.pine }}>
                <span className="font-mono text-[11px] mr-2" style={{ color: C.muted }}>{party.key}</span>
                {party.party}
              </p>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{ ...body, background: party.evidence ? '#E9EFEA' : '#F1EBDD', color: party.evidence ? C.pine : C.goldInk, border: `1px solid ${party.evidence ? '#B9CBBE' : C.goldPale}` }}>
                {party.status}
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ ...body, color: C.muted }}>
              {party.evidence ? 'Required evidence' : 'Required sign-off'}
            </p>
            <ul className="text-[12px] leading-relaxed list-disc pl-4" style={{ ...body, color: C.text2 }}>
              {party.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            {!party.evidence && (
              <p className="text-[10px] mt-2" style={{ ...body, color: C.muted }}>
                Status scale: {party.statusOptions.join(' → ')}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* F — final release gate */}
      <div className="rounded-xl p-4 mt-4" style={{ background: C.goldWash, border: `1px solid ${C.gold}` }}>
        <p className="text-[10px] uppercase tracking-wide mb-1 font-mono" style={{ color: C.goldInk }}>F · Final release gate</p>
        <p className="text-[13px] leading-relaxed font-medium" style={{ ...body, color: C.goldInk }}>{FINAL_GATE_TEXT}</p>
      </div>
    </section>
  )
}
