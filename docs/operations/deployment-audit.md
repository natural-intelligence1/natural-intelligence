# Deployment Audit

**Date:** 2026-05-09  
**Scope:** Operational visibility — what is deployed where, current as of today  
**Method:** Vercel MCP enumeration, local .env.local inspection, source review  
**Out of scope:** Fixes, deploys, env var changes, code changes

---

## 1. Executive Summary

The situation is **partially healthy**. All three Vercel projects are currently READY in production and all three are building and deploying automatically from `main`. No project is broken right now. However, the audit identified two environment variable gaps that would cause silent runtime failures for the AI-powered features in production: `ANTHROPIC_API_KEY` is not present in `apps/web`'s local environment (commented out, status on Vercel production is unknown and cannot be verified remotely), and `RESEND_API_KEY` is absent from `apps/care`'s local environment (meaning the waitlist email sending at `care.natural-intelligence.uk` may be silently failing).

**Landing page question:** `natural-intelligence.uk` is served by `apps/web` root route (`app/page.tsx`). The headline "The space between normal and thriving." is the current, intentional homepage design — not a stale deployment. It has been present since the project's early sprints and has not been updated through the G.1 sprint. The full authenticated dashboard (intake, BioHub, story, DailyPath, etc.) is at `natural-intelligence.uk/dashboard/*`. There is no separate marketing site. `apps/care` is deployed at `care.natural-intelligence.uk` and serves the practitioner-facing portal.

---

## 2. Project Inventory

| Vercel Project | Production Domain | App | Last Successful Deploy | Commit | Pipeline |
|----------------|-------------------|-----|------------------------|--------|----------|
| `natural-intelligence-web` | `natural-intelligence.uk` | `apps/web` | 2026-05-09 | `778dfc3` | ✅ READY |
| `natural-intelligence-care` | `care.natural-intelligence.uk` | `apps/care` | 2026-05-09 | `778dfc3` | ✅ READY |
| `natural-intelligence-admin` | `admin.natural-intelligence.uk` | `apps/admin` | 2026-05-09 | `778dfc3` | ✅ READY |

**Team:** `natural-intelligence1's projects` (`team_WQ8csPUM677tmV1pRKPvqySU`)  
**Repository:** `github.com/natural-intelligence1/natural-intelligence` (public, monorepo)  
**Connected branch:** `main` on all three projects  
**Node version:** 24.x on all three  
**Framework:** Next.js 14.2.29 on all three

### Additional domains per project

| Project | All domains |
|---------|-------------|
| `natural-intelligence-web` | `natural-intelligence.uk`, `natural-intelligence-web.vercel.app`, `natural-intelligence-web-natural-intelligence1s-projects.vercel.app`, `natural-intelligence-git-6bfcb6-natural-intelligence1s-projects.vercel.app` |
| `natural-intelligence-care` | `care.natural-intelligence.uk`, `natural-intelligence-care.vercel.app`, `natural-intelligence-care-natural-intelligence1s-projects.vercel.app`, `natural-intelligence-git-6d19db-natural-intelligence1s-projects.vercel.app` |
| `natural-intelligence-admin` | `admin.natural-intelligence.uk`, `natural-intelligence-admin.vercel.app`, `natural-intelligence-admin-natural-intelligence1s-projects.vercel.app`, `natural-intelligence-git-a337d8-natural-intelligence1s-projects.vercel.app` |

The `natural-intelligence-git-*-natural-intelligence1s-projects.vercel.app` aliases are the main-branch preview URLs auto-assigned by Vercel. They point to the same production deployment as the custom domain. No other branches are deploying.

---

## 3. Live State for Each App

### 3.1 `apps/web` → `natural-intelligence.uk`

- **Production URL:** `https://natural-intelligence.uk`
- **Dashboard URLs:** `https://natural-intelligence.uk/dashboard/*`
- **Current production commit:** `778dfc3` (feat(ui): brand lockup on care landing; story page intro reflection block)
- **HEAD of main:** `dfd796b` (docs: G1 final report)
- **Gap:** 1 commit behind HEAD. The missing commit is docs-only (`docs/practitioners/G1-final-report.md`). No application code affected. Not a functional gap.
- **Deployment state:** READY (`dpl_HMsW3McGEkFovH5ZHXr1ZEyQP7ke`)
- **Note on dfd796b:** The G1 final report commit triggered a CANCELED build on web (Vercel likely detected no app code changed and superseded it with the 778dfc3 build which was queued simultaneously). `latestDeployment` correctly reflects 778dfc3.
- **Build output (web):** 6 Lambda functions (`nodejs`), Middleware 79.3 kB

**Routes in production:**
- `/` — Marketing landing page (public)
- `/auth/*` — Supabase Auth callbacks
- `/dashboard` — Member dashboard (auth-gated)
- `/dashboard/intake` — Health intake form
- `/dashboard/synopsis` — AI health synopsis
- `/dashboard/story` — My Body's Story + Your Future Self (AI-generated)
- `/dashboard/biohub` — Lab report upload + AI parsing
- `/dashboard/rootfinder` — Symptom analysis + RootFinder
- `/dashboard/dailypath` — Protocol engine + daily checklist
- `/dashboard/lifetracker` — Vitality tracking + goals
- `/dashboard/trajectory` — Biomarker trajectory chart
- `/directory`, `/workshops`, `/resources` — Public-facing pages

---

### 3.2 `apps/care` → `care.natural-intelligence.uk`

- **Production URL:** `https://care.natural-intelligence.uk`
- **Current production commit:** `778dfc3`
- **HEAD of main:** `dfd796b` (1 commit behind, docs-only, not a functional gap)
- **Deployment state:** READY (`dpl_t3h35N84KfvdrYv9zhUE2bj8RMkN`)
- **Build output (care):** 3 Lambda functions, Middleware 79 kB

**Routes in production:**
- `/` — Practitioner landing page + waitlist form (public)
- `/waitlist` — Waitlist confirmation (public)
- `/auth/signin` — Practitioner sign-in
- `/auth/callback` — Auth callback handler
- `/cases` — Active cases list (auth-gated, RLS-scoped)
- `/cases/[caseId]/reasoning` — Reasoning trace view (auth-gated, RLS-scoped)

**Historical ERROR pattern:** The care project has the highest ERROR rate in the 20-deployment window. Sprints 16.2 (C2, C3, plan), Sprint 17-20 big commit, and the G.1.2 design proposal commits all triggered ERRORS. All were resolved by subsequent `fix(build)` or feature commits. The current build is clean. The ERRORs represent development-era typecheck failures, not a systemic pipeline problem.

---

### 3.3 `apps/admin` → `admin.natural-intelligence.uk`

- **Production URL:** `https://admin.natural-intelligence.uk`
- **Current production commit:** `778dfc3`
- **HEAD of main:** `dfd796b` (1 commit behind, docs-only, not a functional gap)
- **Deployment state:** READY (`dpl_H2UCkomgkhnMu2x6DKERDmYpLxkq`)
- **Build output (admin):** 3 Lambda functions, Middleware 78.8 kB

**Routes in production:**
- `/` → redirects to `/dashboard`
- `/dashboard` — Admin dashboard
- `/applications` — Practitioner application queue
- `/practitioners` — Practitioner management
- `/members` — Member management
- `/support` — Support requests
- `/resources`, `/workshops` — Content management
- `/dev/seed` — Seed tooling (dev mode)
- `/login` — Admin login

**Historical ERRORs:** Same two commits (G.1.2 design proposal, Sprint 17-20) failed on admin too. Resolved by subsequent commits. Current build is clean.

---

## 4. The Landing Page Situation

### What is serving at `natural-intelligence.uk`?

`apps/web` deployed at `natural-intelligence.uk`. The root route (`/`) is `apps/web/app/page.tsx`. This page is the marketing landing page for the NI platform.

### Is the page intentional?

Yes. The hero headline `"The space between / normal and thriving."` has been in place since the early sprints and has not been updated during G.1 work. It is the current intentional design. The landing page also renders:
- A hero dashboard component with VitalityRings animation (shows real data for logged-in members, demo values for visitors)
- A practitioner directory preview (top 3 active, `is_directory_ready=true`)
- Upcoming workshops preview (next 3 events)
- Three-pillar "How it works" section
- A "Members" and "Practitioners" sign-up/sign-in section

### Why did it look dated?

The landing page text has not been refreshed since it was written. The sophisticated work that shipped across Sprints 9–G.1 (BioHub, RootFinder, DailyPath, intake, story, practitioner module) all lives at `/dashboard/*` or `care.natural-intelligence.uk/*`. The public-facing root page was not part of any sprint scope.

### Where does the authenticated member work render?

Entirely at `natural-intelligence.uk/dashboard/*` behind the Next.js auth middleware (`dashboard/layout.tsx` auth guard). A member signs in at `natural-intelligence.uk/auth/signin` and lands at `/dashboard`. All intake, story, BioHub, etc. are live there.

### Where does apps/care render?

`care.natural-intelligence.uk`. An unauthenticated practitioner sees the landing/waitlist page. An authenticated practitioner lands on `/cases`. There is no `app.`, no staging subdomain, no preview URL in regular use beyond the auto-generated Vercel ones.

---

## 5. Environment Variable Findings

The Vercel MCP does not expose the ability to read environment variable names from production projects remotely. The findings below are based on local `.env.local` files and source code analysis. Whether these variables are correctly configured in each project's Vercel production environment cannot be confirmed without visiting the Vercel dashboard directly.

### Variables by app (from local .env.local)

| Variable | web | care | admin | Notes |
|----------|-----|------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | Required everywhere |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ | Required everywhere |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ | Server-only; needed where service-role is used |
| `RESEND_API_KEY` | ✅ | ⚠️ absent | ✅ | care calls sendEmail in waitlist action |
| `NOTIFY_EMAIL` | ✅ | ⚠️ absent | ✅ | Used by sendEmail notification template |
| `EMAIL_FROM` | ✅ | ⚠️ absent | ✅ | Used by sendEmail as sender address |
| `NEXT_PUBLIC_SITE_URL` | ✅ | — | — | Used in web for canonical URLs |
| `ADMIN_SECRET` | — | — | ✅ | Admin auth guard |
| `ANTHROPIC_API_KEY` | ⚠️ commented out | — | — | Required for BioHub, synopsis, story generation |

### Gap 1 — `ANTHROPIC_API_KEY` (web project)

**Status locally:** Commented out in `apps/web/.env.local` with note `# ANTHROPIC_API_KEY=sk-ant-... (required for BioHub lab report parsing)`.

**Impact:** Three server actions in `apps/web` throw `Error: ANTHROPIC_API_KEY not configured` at runtime if this key is absent:
- `dashboard/biohub/actions.ts` → `parseLabReport` (lab report AI parsing via `claude-opus-4-5`)
- `dashboard/synopsis/actions.ts` → `generateHealthSynopsis` (health synopsis via `claude-opus-4-5`)
- `dashboard/story/actions.ts` → `generateBodyStory` (body story + future self via `claude-sonnet-4-6`)

All three use runtime guards (`if (!process.env.ANTHROPIC_API_KEY) throw new Error(...)`). The builds do not fail — the absence is only detectable at runtime when a user triggers these actions. Status in Vercel production: **unknown — must be verified in the dashboard**.

### Gap 2 — `RESEND_API_KEY`, `NOTIFY_EMAIL`, `EMAIL_FROM` (care project)

**Status locally:** All three are absent from `apps/care/.env.local`.

**Impact:** `apps/care/app/actions.ts → submitWaitlist` calls `sendEmail()` from `@natural-intelligence/db`. `sendEmail` reads `RESEND_API_KEY` from the environment and silently no-ops (`console.warn('[email] RESEND_API_KEY not set — skipping email send')`) if the key is missing. The `support_requests` INSERT still succeeds, so waitlist sign-ups are captured. But both the admin notification email and the applicant confirmation email are silently dropped.

**Status in Vercel production:** Unknown — must be verified.

### Pre-G.1 / post-G.1 var hygiene

No vars were added or removed by the G.1 sprint that would create mismatches. The care Vercel project was created during the sprint and its env vars were presumably set at that time. The `SUPABASE_SERVICE_ROLE_KEY` is correctly present in care locally (needed for the waitlist action's legitimate `createAdminClient()` call).

---

## 6. Findings and Recommended Fixes

### Urgent — fix before next forward sprint

| # | Finding | Action |
|---|---------|--------|
| U1 | `ANTHROPIC_API_KEY` status in web Vercel project is unknown. If absent, BioHub, synopsis, and body story generation all fail silently at runtime for all members on production. | Verify the key is set in `natural-intelligence-web` Vercel project → Settings → Environment Variables. If absent, add it. |
| U2 | `RESEND_API_KEY`, `NOTIFY_EMAIL`, `EMAIL_FROM` status in care Vercel project is unknown. If absent, waitlist confirmation and admin notification emails from `care.natural-intelligence.uk` are silently dropped (sign-ups are still recorded). | Verify these three vars are set in `natural-intelligence-care` Vercel project → Settings → Environment Variables. |

### Useful — improves developer experience or visibility

| # | Finding | Action |
|---|---------|--------|
| V1 | Every commit triggers builds on all three Vercel projects, including docs-only commits that do not touch any app code. This costs build minutes and creates noise in deployment history (CANCELED builds, redundant READY builds). | Add `ignoreCommand` in each project's Vercel settings (or a turbo-based git diff check) to skip builds when only `docs/` or `packages/db/src/.../*.sql` changed. This is a Vercel pro feature via `vercel.json` `ignoreCommand`. |
| V2 | `apps/web/.env.local` has `ANTHROPIC_API_KEY` commented out with a placeholder. This means a local dev environment cannot test BioHub or story generation without manually uncommenting. | Either provide a dev key or keep the comment but add a note in the README/onboarding guide so new developers know what to obtain. |
| V3 | `apps/care/.env.local` is missing `RESEND_API_KEY`, `NOTIFY_EMAIL`, `EMAIL_FROM`. Local testing of the waitlist form will not send emails. | Add the email vars to `apps/care/.env.local` locally (not committed). |
| V4 | The web project's `latestDeployment` is at `778dfc3`, not at HEAD (`dfd796b`). The G1 final report commit's web build was CANCELED. This is functionally fine (docs-only) but means the deployment history has a persistent 1-commit lag on web. | No immediate action, but if docs commits continue to CANCEL on web while building READY on admin/care, investigate whether Vercel's monorepo detection is misconfigured for the web project. |

### Future — aware of, no action needed yet

| # | Finding | Action |
|---|---------|--------|
| F1 | The landing page (`natural-intelligence.uk`) headline and copy have not been updated since the early sprints. As more member-facing features ship, the public landing page may need a refresh to reflect current capabilities. | Scope a marketing page update sprint when the product is ready for broader exposure. |
| F2 | There is no staging environment. All merges to main go directly to production. | Acceptable for current scale. Worth a conversation before onboarding real practitioners or members. |
| F3 | `apps/admin/app/dev/seed` is a route in production (`admin.natural-intelligence.uk/dev/seed`). It is presumably guarded by the admin auth middleware, but it is publicly routable. | Confirm the seed route is properly auth-gated. Consider removing it or gating it behind `NODE_ENV === 'development'` before any external access to admin is granted. |
| F4 | The care project historically shows the highest ERROR build rate (6+ ERRORs in the visible 20-deployment window). All are historical development failures now resolved, but the pattern suggests care changes are more likely to break the build than web or admin. | No action now, but monitor: if new care sprints produce ERRORs, investigate whether Vercel's build cache for care should be cleared or whether the Turbo root detection is causing stale cache hits. |

---

## 7. Open Questions

| # | Question | Why it matters |
|---|----------|----------------|
| OQ1 | Is `ANTHROPIC_API_KEY` actually set in the `natural-intelligence-web` Vercel project's production environment? | Determines whether BioHub, synopsis, and story features work for any current production user. Cannot be verified remotely via MCP. |
| OQ2 | Are `RESEND_API_KEY`, `NOTIFY_EMAIL`, `EMAIL_FROM` set in the `natural-intelligence-care` Vercel project? | Determines whether waitlist applicants receive confirmation emails. Cannot be verified remotely. |
| OQ3 | Has any real member or practitioner used the production environment yet? | If yes, any AI feature failures would already be surfacing. If no, the env var gaps are not yet user-impacting but need resolution before onboarding begins. |
| OQ4 | Is the `admin.natural-intelligence.uk/dev/seed` route properly gated or intended to remain accessible in production? | Security consideration before any real-user access to admin is granted. |
| OQ5 | Is the landing page headline ("The space between normal and thriving.") considered current, or is a homepage refresh intended as part of a near-term sprint? | Determines whether this is a known state or an accidental omission. |
