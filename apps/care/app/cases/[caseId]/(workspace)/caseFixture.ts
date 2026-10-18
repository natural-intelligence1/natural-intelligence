// ─── Fictional case for the workspace shell ──────────────────────────────────
//
// FICTIONAL DATA ONLY. No real client, no real practitioner, no real health
// information. The same invented people as the other NI previews — Rowan
// Example and Amara Okafor — so the surfaces read as one product rather than
// three unrelated demos.
//
// Why a fixture rather than live queries: the workspace shell is being judged
// on structure and hierarchy tonight, and several sections have no domain
// module to query at all. Wiring half the panels to live tables and leaving
// the rest blank would make the shell harder to judge, not easier. Each
// section page states plainly which of the two it is.
//
// Where a real domain module already exists and is safe to use, the section
// page says so; nothing here invents clinical logic or a scoring rule.

export interface CaseFixture {
  caseId: string
  reference: string
  client: { pseudonym: string; ageBand: string; registeredSince: string }
  lead: { name: string; credential: string; role: string }
  stage: string
  status: 'in_care' | 'awaiting_review' | 'closed'
  lastReview: string
  nextReview: string
  sinceLastReview: Array<{ at: string; fact: string; source: string }>
  concerns: Array<{ label: string; inOwnWords: string; duration: string }>
  systemsUnderConsideration: string[]
  synopsis: { state: 'draft' | 'current'; generatedAt: string | null; sections: number }
  safety: { state: 'none_recorded' | 'items_present'; items: number; reviewed: boolean }
  plan: { version: number | null; state: 'none' | 'draft' | 'signed'; signedAt: string | null; signedBy: string | null }
  outstandingWork: Array<{ label: string; due: string; urgency: 'overdue' | 'watch' | 'ok' }>
  team: Array<{ name: string; role: string; since: string; active: boolean }>
}

export const CASE_FIXTURE: CaseFixture = {
  caseId: 'demo-case',
  reference: 'NI-4F2A91',
  client: { pseudonym: 'Rowan Example', ageBand: '40–49', registeredSince: '12 Jun 2026' },
  lead: { name: 'Amara Okafor', credential: 'Accredited Practitioner · Nutritional Therapy', role: 'Lead Responsible Practitioner' },
  stage: 'In care · second review cycle',
  status: 'in_care',
  lastReview: '18 Sep 2026',
  nextReview: '16 Oct 2026',

  // Facts with a date and a source. No interpretation, no ranking.
  sinceLastReview: [
    { at: '2 Oct 2026',  fact: 'Reported sleeping through the night on 5 of the last 7 nights.', source: 'Client check-in' },
    { at: '28 Sep 2026', fact: 'Started the daylight walk on most weekday mornings.',            source: 'Client check-in' },
    { at: '24 Sep 2026', fact: 'Stopped magnesium for four days — digestion felt loose.',         source: 'Client message' },
    { at: '21 Sep 2026', fact: 'GP changed blood pressure medication dose.',                      source: 'Client-reported' },
  ],

  concerns: [
    { label: 'Sleep',       inOwnWords: 'I wake at 3am most nights and cannot get back off.', duration: '~8 months' },
    { label: 'Energy',      inOwnWords: 'Flat by mid-afternoon, every day.',                   duration: '~1 year' },
    { label: 'Digestion',   inOwnWords: 'Bloating after most evening meals.',                  duration: '~6 months' },
  ],

  systemsUnderConsideration: ['Sleep', 'Digestion', 'Energy, hormones & metabolism'],

  synopsis: { state: 'current', generatedAt: '18 Sep 2026', sections: 11 },
  safety:   { state: 'none_recorded', items: 0, reviewed: true },
  plan:     { version: 2, state: 'signed', signedAt: '18 Sep 2026', signedBy: 'Amara Okafor' },

  outstandingWork: [
    { label: 'Review client check-ins since 18 Sep', due: 'Today',   urgency: 'watch' },
    { label: 'Confirm GP medication change on record', due: '3 days', urgency: 'ok' },
  ],

  team: [
    { name: 'Amara Okafor', role: 'Lead Responsible Practitioner', since: '24 Jul 2026', active: true },
    { name: 'J. Student',   role: 'Supervised student',            since: '2 Sep 2026',  active: true },
  ],
}
