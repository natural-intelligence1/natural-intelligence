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

import type { DatedUpdate } from '@natural-intelligence/db/careRecord'

export interface CaseFixture {
  caseId: string
  reference: string
  client: { pseudonym: string; ageBand: string; registeredSince: string }
  lead: { name: string; credential: string; role: string }
  stage: string
  status: 'in_care' | 'awaiting_review' | 'closed'
  lastReview: string
  /** ISO, so the real delta builder can use it as the review cutoff. */
  lastReviewAt: string
  nextReview: string
  /** Real DatedUpdate records, NOT pre-rendered lines. The Overview passes
   *  these through buildSinceLastReview, so the grouping, ordering, cutoff
   *  and attribution on screen are the shipped builder's, not the fixture's.
   *  Only the CONTENT is invented. */
  sinceLastReview: DatedUpdate[]
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
  lastReviewAt: '2026-09-18T10:00:00.000Z',
  nextReview: '16 Oct 2026',

  // Facts with a date, a kind and an author. No interpretation, no ranking.
  //
  // Deliberately NOT in display order: the builder orders and groups these,
  // so if it ever stopped doing so the Overview would visibly show it rather
  // than silently relying on the order they happen to be written in. The last
  // entry is before the review cutoff and must NOT appear.
  sinceLastReview: [
    {
      id: 'u-3', at: '2026-09-24T18:40:00.000Z', authorRole: 'client', authorId: 'client-rowan',
      kind: 'supplement_change', sourceRef: 'supplements/magnesium',
      statement: 'Stopped magnesium for four days. Digestion felt loose over the same period.',
      previousValue: 'Magnesium glycinate, 1 capsule at night', newValue: 'Not taken, 20–24 Sep',
    },
    {
      id: 'u-1', at: '2026-10-02T07:15:00.000Z', authorRole: 'client', authorId: 'client-rowan',
      kind: 'client_report', sourceRef: 'concerns/sleep',
      statement: 'Slept through the night on 5 of the last 7 nights.', concernId: 'sleep',
    },
    {
      id: 'u-4', at: '2026-09-21T09:05:00.000Z', authorRole: 'client', authorId: 'client-rowan',
      kind: 'medication_change', sourceRef: 'medications/bp',
      statement: 'GP changed blood pressure medication dose.',
      previousValue: 'Amlodipine 5mg', newValue: 'Amlodipine 10mg',
    },
    {
      id: 'u-2', at: '2026-09-28T06:50:00.000Z', authorRole: 'client', authorId: 'client-rowan',
      kind: 'daily_path_obstacle', sourceRef: 'dailypath/daylight-walk',
      statement: 'Did the daylight walk on most weekday mornings, not at weekends.',
    },
    {
      id: 'u-0', at: '2026-09-02T11:00:00.000Z', authorRole: 'client', authorId: 'client-rowan',
      kind: 'client_report', sourceRef: 'concerns/energy',
      statement: 'Before the September review: afternoons still flat.', concernId: 'energy',
    },
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
