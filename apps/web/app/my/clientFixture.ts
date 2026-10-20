// ─── Fictional client view for the shell ────────────────────────────────────
//
// FICTIONAL DATA ONLY. The same invented person as the practitioner surfaces
// — Rowan Example, cared for by Amara Okafor — so the two shells read as one
// product seen from two sides rather than two unrelated demos.
//
// Why a fixture: most of these flows are domain-ready but unwired (see
// careRecord/contract.ts). Wiring half of them to live tables and leaving the
// rest blank would make the shell harder to judge, not easier. Each page says
// plainly which of the two it is.
//
// The Protocol versions below are shaped exactly like member_protocols rows
// after 0059, so the plan state is computed by the SAME function the
// practitioner side uses rather than hard-coded here.

import type { ProtocolVersionRow } from '@natural-intelligence/db/careRecord'

export const CLIENT = {
  firstName: 'Rowan',
  caseReference: 'NI-4F2A91',
  memberSince: '12 Jun 2026',
  nextReview: '16 Oct 2026',
  lastReview: '18 Sep 2026',
}

/** As member_protocols holds them: v1 signed then superseded by v2 signed. */
export const PROTOCOL_VERSIONS: ProtocolVersionRow[] = [
  {
    id: 'proto-v1', version: 1,
    signed_at: '2026-07-24T11:05:00Z', signed_by: 'prac-amara',
    supersedes: null, member_id: 'member-rowan', case_id: 'case-4f2a91',
  },
  {
    id: 'proto-v2', version: 2,
    signed_at: '2026-09-18T09:20:00Z', signed_by: 'prac-amara',
    supersedes: 'proto-v1', member_id: 'member-rowan', case_id: 'case-4f2a91',
  },
]

export const SIGNED_BY_NAME: Record<string, { name: string; credential: string }> = {
  'prac-amara': { name: 'Amara Okafor', credential: 'Accredited Practitioner · Nutritional Therapy' },
}

/** The actions in the current signed Protocol, as the client reads them.
 *  Instructions are the client-facing text; the practitioner's rationale is
 *  deliberately not here. */
export const PLAN_ACTIONS = [
  { name: 'Protein at breakfast', kind: 'Nutrition', amount: '25–30g', when: 'Within an hour of waking', weeks: 12,
    instructions: 'Eggs, fish, yoghurt or a legume base — whichever fits the morning. The timing matters more than the source.' },
  { name: 'Daylight walk', kind: 'Lifestyle', amount: null, when: 'Morning, before screens', weeks: 12,
    instructions: '15–20 minutes outdoors. Overcast is fine — it is the daylight rather than the sunshine that counts.' },
  { name: 'Magnesium glycinate', kind: 'Supplement', amount: '200mg', when: 'Evening, with food', weeks: 8,
    instructions: 'Take with the evening meal. Stop and tell me if digestion becomes loose.' },
  { name: 'Review call', kind: 'With your practitioner', amount: null, when: 'Week 4', weeks: null,
    instructions: 'Twenty minutes. Bring the sleep notes; we will decide together what to keep and what to drop.' },
]

/** Today's actions, derived from the signed Protocol. */
export const TODAY_ACTIONS = [
  { name: 'Protein at breakfast', detail: '25–30g · within an hour of waking', done: true },
  { name: 'Daylight walk', detail: '15–20 minutes, before screens', done: true },
  { name: 'Magnesium glycinate', detail: '200mg · evening, with food', done: false },
]

/** What the client has told NI since the last review. The same shape the
 *  practitioner's "Since last review" is built from. */
export const MY_UPDATES = [
  { at: '2 Oct 2026', text: 'Slept through the night 5 of the last 7 nights.' },
  { at: '28 Sep 2026', text: 'Started the daylight walk on most weekday mornings.' },
  { at: '24 Sep 2026', text: 'Stopped magnesium for four days — digestion felt loose.' },
]

export const MY_TEAM = [
  { name: 'Amara Okafor', role: 'Lead Responsible Practitioner',
    credential: 'Accredited Practitioner · Nutritional Therapy', since: '24 Jul 2026', isLead: true },
  { name: 'J. Student', role: 'Supervised student',
    credential: 'Working under supervision', since: '2 Sep 2026', isLead: false },
]

/** The factual health record, as the client sees it. Counts only — the
 *  content itself lives in the synopsis, which is not yet wired. */
export const MY_HEALTH_SUMMARY = {
  concerns: ['Sleep', 'Energy', 'Digestion'],
  synopsisSections: 11,
  synopsisUpdated: '18 Sep 2026',
  intakeCompleted: '22 Jul 2026',
}
