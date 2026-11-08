# NI Role–Route Map

Canonical record of what screens each login type actually has. This document is
the single source of truth for the admin Route Map panel — the panel parses and
renders THIS file and holds no route data of its own, including the internal
preview links at the foot.

Keep the format intact: sections start with `## `, then per-role `**Landing:**`,
`**Enforcement:**` and `**Last verified:**` lines, then one pipe table of routes
with the columns `Route / Screen | Status | Flag | Notes`.

Statuses, and more than one may apply — write them as `LIVE + DORMANT`:
  LIVE — reachable on a production domain
  WIRED — reads or writes canonical live data
  HELD — built and deployed, but refusing to run by design
  DORMANT — built and deployed, but switched off or holding no data
  REVIEW — internal review surface only, not a client-facing product
  FIXTURE — renders invented data
  BLOCKED — cannot proceed without a decision or an unapplied migration
  BUILT-NOT-LIVE — built but not deployed
  STUB — placeholder
  NOT FOUND — does not exist, and must not be faked

The Flag column names the environment variable that decides reachability. It is
the single most load-bearing fact about a built route and it used to be buried
in prose; an em dash means the route has no flag.

## Admin (admin app)

**Landing:** `admin.natural-intelligence.uk/login` → `/dashboard`. On the public web app an admin has no special routing and lands on the ordinary member dashboard.
**Enforcement:** admin middleware (session) + `(protected)/layout.tsx` requires `profiles.role === 'admin'` for the whole tree, repeated per-page; RLS admin checks in `supabase/migrations/0002_rls_policies.sql`.
**Last verified:** 8 November 2026

| Route / Screen | Status | Flag | Notes |
|---|---|---|---|
| /dashboard | LIVE + WIRED | — | Admin overview |
| /applications, /applications/[id] | LIVE + WIRED | — | Practitioner application review + decisions. No category control exists on this screen — see the practitioner note below |
| /practitioners, /practitioners/[id] | LIVE + WIRED | — | Practitioner management (status, directory readiness) |
| /members | LIVE + WIRED | — | Member listing |
| /resources, /resources/new, /resources/[id]/edit | LIVE + WIRED | — | The Library CMS (draft → published → archived) |
| /workshops, /workshops/new, /workshops/[id]/edit | LIVE + WIRED | — | Platform events CMS |
| /support, /support/[id] | LIVE + WIRED | — | Support requests + referral matching |
| /review-packs | LIVE + WIRED | PRACTITIONER_REVIEW_PACKS_ENABLED | Admin-only de-identified pack queue. Reads client_cases and intake_responses through service-role under the admin guard. The flag gates practitioner-side pack ACCESS, not this page |
| /review-packs/founder-review | LIVE + WIRED | — | Founder Review Mode — case picker. Lists ONLY cases whose client profile has is_test_data = true; the filter is applied to profiles first, so a real member cannot appear. Read-only |
| /review-packs/founder-review/[caseId] | LIVE + WIRED | — | Founder Review Mode — the real canonical case as the practitioner will receive it. Answers come from the SHARED canonical Intake projection (packages/db getCanonicalIntake): intake_answers is primary, the intake_responses column is fallback only, latest answer across sessions wins. This route resolves nothing itself. REFUSES any case whose client is not test data, before reading a single health row. No server action, no form, no mutation verb, no fixture — asserted by packages/db/src/crt/founderReviewBoundary.test.ts. Confers no practitioner, Lead or LRP authority |
| /dev/seed | LIVE + WIRED | — | Test-data seeding; nav link shown outside production only. Creates practitioners, applications, support requests, events and resources — never client_cases |
| /route-map | LIVE | — | This panel — read-only render of this document |

## Internal previews (admin app)

**Landing:** reached from this panel; admin login required.
**Enforcement:** inside the admin `(protected)` tree, repeated per-page; every one is noindexed and linked from no public surface.
**Last verified:** 8 November 2026

| Route / Screen | Status | Flag | Notes |
|---|---|---|---|
| /route-map/preview/client-today | LIVE + REVIEW + FIXTURE | — | Screen A — Client Today, one agreed next step. Synthetic; every control inert |
| /route-map/preview/case-overview | LIVE + REVIEW + FIXTURE | — | Screen B — practitioner case overview, "Since last review". Runs the real buildSinceLastReview over synthetic updates |
| /route-map/preview/signed-protocol | LIVE + REVIEW + FIXTURE | — | Screen C — signed protocol → DailyPath versioning contract. Demonstrates a contract the live schema does not yet support, and says so on the page |
| /route-map/preview/pricing | LIVE + REVIEW | — | Pricing page v7. Working prices; every CTA inert. Tags controlled by PRICING_PREVIEW.showWorkingPrices in the pricing catalogue |

## Practitioner (web app)

**Landing:** web login → `/dashboard` → auto-redirect to `/dashboard/practitioner` (`dashboard/page.tsx` when `role === 'practitioner'`).
**Enforcement:** `profiles.role` guards in web dashboard pages; member-only tools redirect practitioners away; `/dashboard/practitioner` redirects non-practitioners back.
**Last verified:** 8 November 2026

| Route / Screen | Status | Flag | Notes |
|---|---|---|---|
| /dashboard/practitioner | LIVE + WIRED | — | Practitioner home on the member site |
| /dashboard/practitioner/profile | LIVE + WIRED | — | Public directory-profile editor (profiles currently hidden from the public directory, which is in its coming-soon state) |
| /dashboard/workshops, /dashboard/requests, /dashboard/profile | LIVE + WIRED | — | Shared dashboard screens |

## Practitioner (care app)

**Landing:** `care.natural-intelligence.uk/auth/signin` → `/cases` inbox.
**Enforcement:** care middleware gates paths beginning `/cases` only; requires a `practitioners` row with `status = 'active'` (table-based, not `profiles.role`); non-practitioners → `/care/unauthorised`; other statuses → holding pages.
**Last verified:** 8 November 2026

| Route / Screen | Status | Flag | Notes |
|---|---|---|---|
| / | LIVE | — | Care front page. No sign-in form; links to the public site |
| /auth/signin | LIVE + WIRED | — | Practitioner sign-in |
| /cases | LIVE + WIRED + DORMANT | — | Work inbox — deployed and functional, but holds no real work: 0 client_practitioner_links and 0 case_team_roles. Only the 3 May demo work rows exist. Unauthenticated access now redirects here to /auth/signin (fixed 8 Nov) |
| /cases/[caseId]/work/[workId] | LIVE + WIRED + DORMANT | — | Case review workspace — same "no real work yet" caveat |
| /cases/[caseId]/reasoning | LIVE + WIRED | — | Reasoning trace view |
| /care/agreement | LIVE | PRACTITIONER_AGREEMENT_GATE | Agreement holding page. 0 practitioner_agreements rows exist |
| /care/pending-review, /care/pending-activation, /care/suspended, /care/access-revoked, /care/unauthorised | LIVE | — | Status holding pages |
| /cases/[caseId]/(workspace)/* (10 tabs) | BUILT-NOT-LIVE + FIXTURE | — | Client Case Workspace — exists only on ux/calm-client-and-cockpit and feat/care-path-foundations, neither deployed. Overview and Team read live data; the rest are fixtures |
| /review/cockpit | BUILT-NOT-LIVE + REVIEW + FIXTURE | COCKPIT_PILOT_REVIEW_ENABLED | Founder-review Consultation Cockpit. Not on main — 404 in production. Fictional case, persists nothing |

## Client / Member (web app)

**Landing:** web login → `/dashboard` (roles `user` / `member`; both exist in the `user_role` enum).
**Enforcement:** web middleware public-route allowlist + per-page auth; role redirects keep practitioners out of member-only tools. The dashboard layout additionally runs a consent re-affirmation gate.
**Last verified:** 8 November 2026

| Route / Screen | Status | Flag | Notes |
|---|---|---|---|
| /dashboard | LIVE + WIRED | — | Member home |
| /dashboard/intake | LIVE + WIRED | INTAKE_COLLECTION_ENABLED | **Collection is ON.** Corrected 8 Nov: this row previously read BUILT-NOT-LIVE, which had been wrong since the 13 September ruling. Completing it does NOT create a client_cases row — both case-creating paths downstream are currently switched off |
| /dashboard/intake-v2 | DORMANT + BLOCKED | INTAKE_V2_ENABLED (+ INTAKE_COLLECTION_ENABLED) | Pre-consultation intake V2. Needs BOTH flags; 404s otherwise. Zero V2-shaped answers exist. Awaiting Founder copy approval and a V1 switchover decision |
| /dashboard/synopsis | LIVE + HELD | AI_INTERPRETATION_ENABLED | Page is reachable; generation refuses and renders the held state. 8 health_synopsis rows exist, newest 13 Sep 2026 |
| /dashboard/story | LIVE + HELD | AI_INTERPRETATION_ENABLED | As above. This is also the **only client-facing path that creates a client_cases row**, so while the hold is on, no case is created by intake. Zero body_story rows have ever been generated |
| /dashboard/privacy | LIVE + WIRED | — | Privacy & Data Controls — the member rights channel: see what NI holds, manage consents, export, correct or delete. Stays reachable while a member is otherwise consent-gated |
| /dashboard/biohub, /dashboard/biohub/[id] | LIVE + WIRED | — | Lab report hub |
| /dashboard/dailypath, /dashboard/dailypath/[protocolId] | LIVE + WIRED | — | Protocol tracking |
| /dashboard/lifetracker | LIVE + WIRED | — | Check-ins and goals |
| /dashboard/rootfinder, /dashboard/rootfinder/[sessionId] | LIVE + WIRED | — | Root-cause explorer |
| /dashboard/trajectory | LIVE + WIRED | — | Biomarker trajectory |
| /dashboard/requests | LIVE + WIRED | — | Support requests |
| /dashboard/workshops | LIVE + WIRED | — | Registered workshops |
| /dashboard/profile | LIVE + WIRED | — | Account profile |
| /welcome | LIVE + WIRED | — | Welcome survey. Auth-gated |
| /my, /my/health, /my/plan, /my/progress, /my/story, /my/team, /my/more | BUILT-NOT-LIVE + FIXTURE | — | Calm client shell — exists only on ux/calm-client-and-cockpit, not deployed. /my/team is the one genuinely wired route (reads case_team_roles, correctly empty); /my/story holds answers in the browser only. An unauthenticated request to /my today returns 307 to login because middleware catches unknown paths — signing in gives a 404 |
| /review/client-shell/[[...path]] | BUILT-NOT-LIVE + REVIEW + FIXTURE | CLIENT_SHELL_REVIEW_ENABLED | Founder-review route for the client shell. Not on main |

## Student

**Landing:** none — no student login path exists.
**Enforcement:** none — `student` is not in the `user_role` enum ("user", "practitioner", "admin", "member").
**Last verified:** 8 November 2026

| Route / Screen | Status | Flag | Notes |
|---|---|---|---|
| Any student login, route or view | NOT FOUND | — | Honestly not built — do not fake a student view |
| Student as a CASE ROLE | DORMANT | — | Partially superseded: `case_team_roles.team_role` now accepts `student`, with supervision rules and a supervisor requirement, and 0064 deliberately exempts the student role from needing a practitioner category. That is a case role, never a login and never a category. 0 rows exist |

## Public (logged out)

**Landing:** `natural-intelligence.uk` — no account required.
**Enforcement:** web middleware `PUBLIC_ROUTES` allowlist; everything else redirects to login.
**Last verified:** 8 November 2026

| Route / Screen | Status | Flag | Notes |
|---|---|---|---|
| /, /about, /community, /apply, /support, /legal/*, /auth/* | LIVE + WIRED | — | Public front door (Brand System V1) |
| /workshops, /workshops/[slug] | LIVE + WIRED | — | Workshops from the canonical registry in lib/communityWorkshops.ts |
| /resources, /resources/[id] | LIVE + WIRED | — | "The Library" — currently showing seeded demo articles; accepted as-is by Founder ruling |
| /directory, /directory/[id] | LIVE + DORMANT | — | Honest coming-soon state; profile URLs redirect back; synthetic practitioners hidden |
| /labs/galaxy | LIVE | NEXT_PUBLIC_FEATURE_GALAXY | Living Galaxy QA/reference route. **Publicly reachable (200) and noindexed.** Keep public by Founder ruling. It 404s only when the flag is explicitly `0` |
| /sitemap.xml, /robots.txt | LIVE | — | Crawler surfaces, deliberately un-gated |
| /pricing | NOT FOUND | — | No public pricing route exists and none may be added to PUBLIC_ROUTES. The pricing page lives only as the admin preview above |
