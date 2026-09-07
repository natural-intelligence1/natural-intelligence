# NI Role–Route Map

Canonical record of what screens each login type actually has. Populated from the
read-only role audit of commit `8ec0baa` (2026-09-07). This document is the single
source of truth for the admin Route Map panel — the panel parses and renders THIS
file, so keep the format below intact (sections start with `## `, per-role
`**Landing:**` / `**Enforcement:**` lines, then one pipe-table of routes).
Statuses: LIVE, BUILT-NOT-LIVE, STUB, NOT FOUND.

## Admin (admin app)

**Landing:** `admin.natural-intelligence.uk/login` → `/dashboard`. On the public web app an admin has no special routing and lands on the ordinary member dashboard.
**Enforcement:** admin middleware (session) + `(protected)/layout.tsx` requires `profiles.role === 'admin'` for the whole tree, repeated per-page; RLS admin checks in `supabase/migrations/0002_rls_policies.sql`.

| Route / Screen | Status | Notes |
|---|---|---|
| /dashboard | LIVE | Admin overview |
| /applications, /applications/[id] | LIVE | Practitioner application review + decisions |
| /practitioners, /practitioners/[id] | LIVE | Practitioner management (status, directory readiness) |
| /members | LIVE | Member listing |
| /resources, /resources/new, /resources/[id]/edit | LIVE | The Library CMS (draft → published → archived) |
| /workshops, /workshops/new, /workshops/[id]/edit | LIVE | Platform events CMS |
| /support, /support/[id] | LIVE | Support requests + referral matching |
| /dev/seed | LIVE | Test-data seeding; nav link shown outside production only |
| /route-map | LIVE | This panel — read-only render of this document |

## Practitioner (web app)

**Landing:** web login → `/dashboard` → auto-redirect to `/dashboard/practitioner` (`dashboard/page.tsx` when `role === 'practitioner'`).
**Enforcement:** `profiles.role` guards in web dashboard pages; member-only tools redirect practitioners away; `/dashboard/practitioner` redirects non-practitioners back.

| Route / Screen | Status | Notes |
|---|---|---|
| /dashboard/practitioner | LIVE | Practitioner home on the member site |
| /dashboard/practitioner/profile | LIVE | Public directory-profile editor (profiles currently hidden from the public directory, which is in its coming-soon state) |
| /dashboard/workshops, /dashboard/requests, /dashboard/profile | LIVE | Shared dashboard screens |

## Practitioner (care app)

**Landing:** `care.natural-intelligence.uk/auth/signin` → `/cases` inbox.
**Enforcement:** care middleware requires a `practitioners` row with `status = 'active'` (table-based, not `profiles.role`); non-practitioners → `/care/unauthorised`; other statuses → holding pages.

| Route / Screen | Status | Notes |
|---|---|---|
| /cases | LIVE | Work inbox — deployed and functional, but currently holds no real work (0 active client links; only the Founder demo bundle's 3 demo work items exist) |
| /cases/[caseId]/work/[workId] | LIVE | Case review workspace — same "no real work yet" caveat |
| /cases/[caseId]/reasoning | LIVE | Reasoning trace view |
| /care/pending-review, /care/pending-activation, /care/suspended, /care/access-revoked, /care/unauthorised | LIVE | Status holding pages |

## Client / Member (web app)

**Landing:** web login → `/dashboard` (roles `user` / `member`; both exist in the `user_role` enum).
**Enforcement:** web middleware public-route allowlist + per-page auth; role redirects keep practitioners out of member-only tools.

| Route / Screen | Status | Notes |
|---|---|---|
| /dashboard | LIVE | Member home |
| /dashboard/intake | BUILT-NOT-LIVE | Fully built, but flag-gated OFF (`INTAKE_COLLECTION_ENABLED` unset): the route renders a calm "intake unavailable" notice and server actions refuse writes. Practitioner routing separately gated off by `INTAKE_ASSIGNMENT_ENABLED`. |
| /dashboard/synopsis, /dashboard/story | LIVE | AI outputs of intake — unreachable for new data while intake collection is off |
| /dashboard/biohub, /dashboard/biohub/[id] | LIVE | Lab report hub |
| /dashboard/dailypath, /dashboard/dailypath/[protocolId] | LIVE | Protocol tracking |
| /dashboard/lifetracker | LIVE | Check-ins and goals |
| /dashboard/rootfinder, /dashboard/rootfinder/[sessionId] | LIVE | Root-cause explorer |
| /dashboard/trajectory | LIVE | Biomarker trajectory |
| /dashboard/requests | LIVE | Support requests |
| /dashboard/workshops | LIVE | Registered workshops |
| /dashboard/profile | LIVE | Account profile |

## Student

**Landing:** none — no student login path exists.
**Enforcement:** none — `student` is not in the `user_role` enum ("user", "practitioner", "admin", "member").

| Route / Screen | Status | Notes |
|---|---|---|
| Any student role, route or view | NOT FOUND | Confirmed by repo-wide search; the only mention is a welcome-survey option label `practitioner_student`. Honestly not built — do not fake a student view. |

## Public (logged out)

**Landing:** `natural-intelligence.uk` — no account required.
**Enforcement:** web middleware `PUBLIC_ROUTES` allowlist; everything else redirects to login.

| Route / Screen | Status | Notes |
|---|---|---|
| /, /about, /workshops, /apply, /support, /legal/* , /auth/* | LIVE | Public front door (Brand System V1) |
| /resources ("The Library") | LIVE | Currently showing seeded demo articles — founder ruling pending on replacement |
| /directory | LIVE | Honest coming-soon state; profile URLs redirect back; synthetic practitioners hidden |
