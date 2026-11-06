# AI interpretation containment — exact path and the smallest fail-closed guard

**Status: IMPLEMENTED on `ux/calm-client-and-cockpit`. Not merged, not deployed.**
Proposed Mission 19, approved and built Mission 20, both 6 November 2026.

Neither intake flag was changed. No existing synopsis, trace or historical
record was deleted or rewritten. No Intake clinical question was altered.

## What was built

| | |
|---|---|
| `packages/db/src/ai/interpretationFlag.ts` | `isAiInterpretationEnabled()` — exact-string `=== 'true'`, default-off |
| `packages/db/src/ai/generationGuard.ts` | `claimGeneration()` — in-flight claim + 60s recency check |
| `apps/web/app/dashboard/synopsis/actions.ts` | three gates at the head of `generateHealthSynopsis`, `claim.release()` in `finally` |
| `apps/web/app/dashboard/story/actions.ts` | the same three gates in `generateBodyStory` |
| `apps/web/app/dashboard/_components/InterpretationHeldState.tsx` | the honest held state — no polling, no retry control |
| `apps/web/app/dashboard/synopsis/page.tsx`, `story/page.tsx` | held branch before the generating state; regenerate control hidden while held |
| `apps/web/app/dashboard/intake/actions.ts` | stale comment corrected (comment only) |

67 tests across three suites: flag semantics, the concurrency guard, and a
structural suite that reads the application source and fails if any
generation path stops being gated — including a pipeline added later.

Environment configuration: `docs/operations/environment-configuration.md`.
**No variable needs setting to activate the hold**; the flag is default-off.

### The three gates, in order

```ts
// 1. global hold — before any client exists, so a held call reads and writes nothing
if (!isAiInterpretationEnabled()) return { status: 'held' }

const adminClient = createAdminClient()

// 2. the member's own restriction / withdrawal — moved here from completeIntake
if (await isProcessingBlocked(adminClient, memberId, 'ai_assisted_processing'))
  return { status: 'restricted' }

// 3. duplicate / burst generation
const claim = await claimGeneration(adminClient, memberId, '<output>')
if (!claim.allowed) return { status: 'throttled' }
```

Each refusal is a distinct status, logged as its own event, and never dressed
up as a generation failure.

---

## Original analysis (Mission 19), unchanged below

Founder position being implemented: raw Intake **collection stays ON**; automatic
AI health-synopsis / interpretation generation for new real intakes goes on
**HOLD** pending the outstanding Legal/MHRA review. Existing synopses are not
deleted and no historical record is rewritten.

---

## 1. The exact generation path

### 1.1 Function

| | |
|---|---|
| **Function** | `generateHealthSynopsis(memberId)` |
| **File** | `apps/web/app/dashboard/synopsis/actions.ts:43` |
| **Kind** | `'use server'` server action, exported |
| **Model** | `claude-opus-4-5`, `max_tokens: 2000` |
| **Writes** | `ai_summaries` (`summary_type='health_synopsis'`) via `createAdminClient()` — **service role, so RLS does not apply** |
| **Reads** | `intake_responses`, `intake_answers`, `rootfinder_results`, `biomarker_results`, `profiles`, personalisation |

The sibling pipeline is `generateBodyStory(memberId)` at
`apps/web/app/dashboard/story/actions.ts:29`, which writes `reasoning_traces` +
`reasoning_trace_entries` (`system_area='body_story'`). The 13 September
founder ruling names **both** as awaiting Legal/MHRA review, and both derive
from Intake, so both are in scope.

### 1.2 Trigger conditions — there are THREE entry points, not one

| # | Entry point | Automatic? |
|---|---|---|
| 1 | `completeIntake()` → `apps/web/app/dashboard/intake/actions.ts:148` (synopsis) and `:153` (body story) | **Yes** — fires on intake completion |
| 2 | `apps/web/app/dashboard/synopsis/page.tsx:218` — State C "Regenerate now" / "Try again" | User click |
| 3 | `apps/web/app/dashboard/synopsis/page.tsx:244` — State D "Regenerate" | User click |

Body story has the same shape at `story/page.tsx:161` and `:196`.

Entry point 1 runs only after: the collection kill-switch, `getUser()`,
`assertIntakeConsents()`, the `intake_responses` write, and a
`isProcessingBlocked(…, 'ai_assisted_processing')` check.

**Entry points 2 and 3 run none of those checks.** They call the generator
directly. This matters for the guard design and is covered in §3.2.

### 1.3 Synchronous or asynchronous

**Neither, strictly — and this is the operationally important finding.**

Entry point 1 is *fire-and-forget in-process*:

```ts
generateHealthSynopsis(user.id).catch(…)   // not awaited
generateBodyStory(user.id).catch(…)        // not awaited
```

There is **no queue, no job runner and no cron**. The promise is simply not
awaited, so `completeIntake` returns immediately and the work continues inside
the same serverless invocation — which on Vercel may be frozen or terminated
once the response is sent. Entry points 2 and 3 *are* awaited, inside a form
action, so those reliably complete.

The live data fits that reading:

- The September member's `intake_responses` row was created **2026-09-13 09:38:25Z**.
- Their four synopses were generated **2026-09-13 23:38:02 → 23:38:46Z** — fourteen hours later, four generations inside **44 seconds**.

Four generations in 44 seconds cannot be four intake completions. At most one
came from the completion trigger; the rest came from the regenerate control.
And the body story produced **nothing at all** for that member despite 31
`intake_answers` — no third `client_cases` row exists, so
`getOrCreateClientCase` was never reached.

So in practice the user-clicked path is the one that actually generates, and
the automatic path is unreliable. **A guard placed only on `completeIntake`
would contain almost nothing.**

### 1.4 Does a feature flag already exist? — **No**

Full inventory of every `process.env.*` read across `apps/` and `packages/`:

```
NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY ·
NEXT_PUBLIC_SUPABASE_ANON_KEY · NOTIFY_EMAIL · ANTHROPIC_API_KEY ·
PRACTITIONER_AGREEMENT_GATE · NODE_ENV · NEXT_PUBLIC_SITE_URL ·
NEXT_PUBLIC_FEATURE_GALAXY · GALAXY_URL · GALAXY_FLAG ·
CLIENT_SHELL_REVIEW_ENABLED · COCKPIT_PILOT_REVIEW_ENABLED ·
PRACTITIONER_REVIEW_PACKS_ENABLED · RESEND_API_KEY · EMAIL_FROM · BASE_URL ·
NI_ALLOW_SIGNING_LIVE_TEST · INTAKE_V2_ENABLED · INTAKE_COLLECTION_ENABLED ·
INTAKE_ASSIGNMENT_ENABLED
```

**There is no AI / interpretation / synopsis flag of any kind.** The only
AI-related variable is `ANTHROPIC_API_KEY`, and it is shared with a third
pipeline (biohub lab parsing).

The nearest existing control is `isProcessingBlocked(client, memberId,
'ai_assisted_processing')` (`packages/db/src/rights/requests.ts:176`). It is
**not** usable as a hold:

- it is **per-member and consent-driven**, not a global switch;
- it is checked in `completeIntake` only, so entry points 2 and 3 ignore it;
- `client_rights_requests` currently holds **0 rows**, so today it returns
  false for everyone and has no effect at all.

---

## 2. Recommended guard — one flag, asserted inside the generators

**`AI_INTERPRETATION_ENABLED`**, matching the existing exact-string
convention (`=== 'true'`), **default-off**. Unset means held, so a typo, a
missing variable or a brand-new environment all fail closed.

New module, mirroring the shape of `packages/db/src/intake/collectionFlag.ts`:

```ts
// packages/db/src/ai/interpretationFlag.ts
export function isAiInterpretationEnabled(): boolean {
  return process.env.AI_INTERPRETATION_ENABLED === 'true'
}
```

### 2.1 Where the assert goes

Inside each **generator**, as its first statement — not at the trigger sites:

- `generateHealthSynopsis()` — `apps/web/app/dashboard/synopsis/actions.ts:43`
- `generateBodyStory()` — `apps/web/app/dashboard/story/actions.ts:29`

Both already return a status union, so the guard widens it rather than throwing
(the fire-and-forget callers swallow throws, which would hide the hold):

```ts
if (!isAiInterpretationEnabled()) {
  console.log(JSON.stringify({ event: 'health_synopsis.held', user_id: memberId }))
  return { status: 'held' }
}
```

Two generators, two lines each. **That is the whole containment.** One assert
covers all three entry points for each pipeline, because every entry point
funnels through the generator.

### 2.2 One honest-UI change is required, not optional

With generation held, `synopsis/page.tsx` State C would show
*"Generating your synopsis…"* and poll for five minutes before claiming *"We
couldn't put this together this time."* Both statements would be false.

So the pages must read the flag and render a calm held state instead:

> **Your synopsis is not available yet.** We have safely recorded everything
> you shared. The part that writes your personalised overview is paused while
> it completes an external review, and nothing you have entered is lost.

Same change in `story/page.tsx`. Without this the guard is technically correct
and tells the member something untrue.

### 2.3 What this guard does and does not stop

| | |
|---|---|
| Raw Intake collection | **UNAFFECTED** — `assertIntakeCollectionEnabled()` untouched, questions untouched, `intake_answers` / `intake_responses` keep writing |
| New automatic synopsis on completion | Stopped |
| User-clicked regenerate | Stopped — same generator |
| New body story / reasoning traces | Stopped |
| Existing 8 `ai_summaries` rows | Untouched, still readable in State D |
| Existing 8 `reasoning_traces` | Untouched |
| Biohub lab parsing | Unaffected — separate pipeline, not Intake-derived, not named in the ruling |
| `client_cases` creation via `getOrCreateClientCase` | Also stopped, since it lives inside the body-story generator |

That last row is a bonus: holding body-story generation also stops the only
code path that would create a new `client_cases` row from Intake, which aligns
with "do not create assignment/routing artefacts".

---

## 3. Alternatives assessed and rejected

### 3.1 Remove `ANTHROPIC_API_KEY` from Production — rejected

Zero code change, which is attractive. But it is over-broad and noisy: it also
breaks **biohub lab-report parsing** (`apps/web/app/dashboard/biohub/actions.ts`),
which the Founder did not ask to stop, and it fails by `throw`, so members get
errors rather than a calm held state. It is a blunt instrument where a flag is
precise.

### 3.2 Guard `completeIntake` only — rejected, NOT fail-closed

This is the obvious small change and it is the wrong one. Entry points 2 and 3
call the generators directly from the page, bypassing every check in
`completeIntake`. The live evidence (§1.3) indicates that is the path which
actually produced all four September synopses.

### 3.3 Revoke write access to `ai_summaries` — rejected, would not work

The inserts use `createAdminClient()` (service role), which **bypasses RLS by
design**. A policy change would not stop them.

### 3.4 Reuse `isProcessingBlocked` as the hold — rejected

Per-member and consent-driven, not a global hold; currently inert (0
`client_rights_requests` rows); and ignored by two of the three entry points.

---

## 4. Two live defects found on this path — BOTH NOW FIXED

Both were approved for repair in the same containment change (Mission 20).

**4.1 The member's own AI-processing restriction was bypassable.** — **FIXED.**
`isProcessingBlocked(…, 'ai_assisted_processing')` now runs inside both
generators, so manual "Regenerate" / "Try again" and automatic completion obey
the same restriction. The check is retained in `completeIntake` as well,
because it additionally suppresses the assignment bridge, which the generators
know nothing about. The structural suite asserts the restriction check precedes
the Anthropic call in both generators.

**4.2 No concurrency guard or rate limit.** — **FIXED**, with the precise
mechanism recorded in §6 below.

### The original finding, for the record

**4.1 (as found) The member's own AI-processing restriction is bypassable.**
`isProcessingBlocked(…, 'ai_assisted_processing')` is checked in
`completeIntake` but **not inside the generators**, so the page's "Regenerate
now" button generates regardless of whether the member has withdrawn
AI-processing consent or has an active processing restriction. Recommendation:
move that check into the generators alongside the flag assert — same two call
sites, and it closes the bypass permanently.

**4.2 There is no concurrency guard or rate limit on generation.**
Each click starts a fresh Opus call and inserts another row, retiring the
previous via `is_current=false`. The September burst produced four full
generations in 44 seconds for one member. Cheap fix (ignore a request while one
is in flight), but outside the named scope.

**Note on a stale comment:** `apps/web/app/dashboard/intake/actions.ts:135-139`
says the restriction check returns false "pre-migration" and that this is
"acceptable only because both intake kill-switches are additionally
default-off". `client_rights_requests` now exists (0051 is applied), so the
first clause is obsolete — and the second was overtaken by the 13 September
ruling, since collection is no longer default-off.

---

## 5. Founder decisions — all taken

1. `AI_INTERPRETATION_ENABLED` flag and in-generator assert — **approved, built.**
2. Held-state copy — **approved**, wording from the Orchestrator: *"Your
   information has been saved. This summary is not currently being
   generated."* Built as `InterpretationHeldState`, with a third line
   confirming nothing is lost.
3. Defect 4.1 — **approved, fixed in the same change.**
4. No environment variable needs setting to activate the hold.

---

## 6. The concurrency guard — the precise mechanism

Two layers, because neither alone is sufficient.

**Layer 1 — in-flight claim (in-process).** A module-level `Map` keyed
`<memberId>:<output>`, claimed **synchronously before the first `await`**. The
event loop is single-threaded, so a second concurrent call in the same
instance sees the claim and is refused. Entries carry a 5-minute TTL
(`IN_FLIGHT_TTL_MS`, matching the generating UI's own timeout) and are purged
on read, so a frozen or crashed invocation cannot lock a member out — which
matters because the intake path is fire-and-forget and Vercel may freeze it
mid-generation. `claim.release()` runs in a `finally`, so a failed generation
never blocks the retry.

**Layer 2 — recency check (shared database).** The timestamp of the member's
most recent output of that type; a second generation inside
`GENERATION_COOLDOWN_MS` (60 seconds) is refused. This is the cross-instance
layer: the map is per-instance and empty after a cold start, but every
instance reads the same database. `ai_summaries` is read by
`(member_id, summary_type)`; body story is read via the member's active case
to `reasoning_traces (case_id, trace_type='intake_analysis')` — **read-only,
deliberately not `getOrCreateClientCase`, so the guard can never create a
case**.

**Why 60 seconds.** The observed burst spanned 44 seconds end to end, so the
window must exceed it; a test asserts `> 44_000`. It is also capped at two
minutes by test, so it stays a cooldown rather than a lockout.

**A legitimate later regeneration is never discarded.** A member returning
minutes later regenerates normally. A refusal returns
`{status: 'throttled'}` with `retryAfterMs` and its own log event. A future
timestamp (clock skew between instances) is tolerated rather than treated as a
permanent refusal.

**A guard read failure refuses rather than generating blind**, releasing the
claim first so the next attempt is free to try immediately. The cost of
refusing is a control that works again; the cost of proceeding blind is
another Opus call and another row.

**Honest residual gap.** Two genuinely simultaneous requests landing on two
different warm instances, both before either has written a row, are not
prevented — layer 1 is per-instance and layer 2 has nothing to see yet.
Closing that needs a database claim (a Postgres advisory lock or a
generation-runs table), which is schema work and outside the approved scope.
The observed failure was sequential clicks seconds apart, which both layers
catch.
