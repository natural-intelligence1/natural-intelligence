# supabase/migrations — how to read this folder

**This folder is a change log, not a description of the live schema.**
The live database catalogue is the only authority. If you need to know what
production actually contains, read the catalogue — never this folder. The
generated `packages/db/src/types.ts` is produced from the catalogue and is
reliable for typed schema (tables, columns, types), but it does not describe
triggers, RLS policies, constraints, grants, indexes or function bodies; for
those, query the catalogue itself.

That is not a style preference. A real production defect survived for months
because `0029` declares a column that has never existed, and application code
was written from the file in good faith.

## Rules

1. **Numeric order is not apply order.** Numbered migrations applied in
   ascending order up to `0043`. From `0053` onward the actual applied
   sequence was:

   `0053 → 0054 → 0051 → 0056 → 0052 → 0057 → 0058 → 0059 → 0060 → 0063 → 0064 → 0065`

   `0051` landed after `0053/0054`; `0052` after `0056`; `0063`, `0064` and
   `0065` all landed while `0061` and `0062` were still unapplied. The latest
   applied migration is `0065` (`20261103202530`). `0055` has never been
   applied. `0062` has not been applied. **`0061` has not been applied and is
   BLOCKED — see the release dependency below.** Nothing in the apply mechanism
   reads this folder or compares numeric prefixes: the recorded `version` is
   the apply timestamp and the file's number survives only in the free-text
   `name`.

   Current applied state, as a table, because this is now the thing people get
   wrong:

   | Migration | State | Production record |
   |---|---|---|
   | `0063_practitioner_taxonomy_reconciliation` | APPLIED / CLOSED | `20261027052734` |
   | `0064_practitioner_eligibility_spine` | **APPLIED / LIVE** | `20261103202418` |
   | `0065_case_events_access_alignment` | **APPLIED / LIVE** | `20261103202530` |
   | `0061_protocol_version_items` | **UNAPPLIED / BLOCKED** | — |
   | `0062_case_events_client_authorship` | UNAPPLIED | — |
   | `0055_functional_ranges_source_metadata` | never applied | — |
   This list goes stale the moment anything is applied — it is a worked
   illustration, not a substitute for querying the history.
2. **A file header cannot tell you whether a migration is applied.** Status
   changes after the file is written, so the header goes stale. Several files
   here still say "NOT YET APPLIED" and are applied. Ask the database.
3. **Never hand-create schema in the dashboard.** If an emergency forces it,
   write and apply the matching migration the same day.
4. **Regenerate `packages/db/src/types.ts` immediately after every apply.**
   Its diff is the authoritative typed-schema record of what changed in the
   live catalogue. It does not prove triggers, RLS policies, constraints,
   grants, indexes or function bodies; verify those directly in the
   catalogue where the migration depends on them — see question 3 below.

## Files that are NOT safe to run

**Never decide that a migration is safe to run from the presence or wording
of its file.** Before executing anything in this folder, query the live
migration history. An already-applied migration must not be re-run merely
because its file is still here — most files in this folder are already
applied, and the table below names only the ones with a specific trap.

This matters here more than in most repositories: NI has applied migrations
from feature branches *before* their files reached `main`, so a file's
absence from history — or its presence as an apparently unapplied new file —
proves nothing about the database. `0056`, `0057` and `0058` were all live in
production while absent from `main`. Only the live migration history settles
it.

| File | Why |
|---|---|
| `0029_sprint11_dailypath_schema.sql` | Retrospective hand-written record of tables created by hand in the dashboard. Never executed, and materially wrong about four live tables. See its header. **Running it would damage production.** |
| `0056`, `0057`, `0058` | Already applied. Restored here as historical records only — see below. |
| `0059_protocol_signing.sql` | Already applied (`20261010062725`). |
| `0060_lead_class_demotion_guard.sql` | Already applied (`20261011170031`). Its trigger and function are live; re-running is unnecessary and `create or replace` would silently rewrite a live governance control. |
| `0061_protocol_version_items.sql` | **BLOCKED — must be patched before it is ever applied.** Unapplied, lives only on `feat/protocol-adoption-signing`. It `create or replace`s `enforce_protocol_signature_authority()` and, at line 280, calls the role-neutral `practitioner_assignment_eligibility(auth.uid())`. `0064` **is now live** and replaced that same function with role-aware Lead eligibility, so **applying 0061 today would silently revert protocol-signing authority to the role-neutral question.** Verified by running 0061's function against a post-0064 database. See the release dependency below. |
| `0064_practitioner_eligibility_spine.sql` | **Already applied (`20261103202418`).** Its own header still says "NOT YET APPLIED at the time of writing" — rule 2 in action, not a fact. It creates four evidence tables, the canonical `practitioner_eligibility(uuid, text)`, the compatibility wrapper, and rewires six callers. Re-running would `create or replace` six live governance functions. Verify instead: the eight function hashes are asserted in `packages/db/src/practitioners/eligibility0064.db.test.ts` and `eligibilityRoles0064.db.test.ts`. |
| `0065_case_events_access_alignment.sql` | **Already applied (`20261103202530`).** Replaces the practitioner `case_events` SELECT policy with `can_access_case_care_profile(case_id)`. It refuses to run without 0064, so re-running is harmless but pointless. Verify via `packages/db/src/practitioners/caseEventsRls0065.db.test.ts` and `caseEventsThreeState.db.test.ts`. |
| `0063_practitioner_taxonomy_reconciliation.sql` | **Already applied (`20261027052734`).** Its own header still says "NOT YET APPLIED at the time of writing" — that is rule 2 in action, not a fact. It is re-runnable by design and would be a no-op, but it `create or replace`s three live governance functions and suspends two governance triggers around its translation, so do not run it to "check" anything. Verify instead: the three function hashes are recorded in its header and asserted in `packages/db/src/practitioners/taxonomy0063.db.test.ts`. |
| `0066_case_taking_persistence.sql` | **APPLIED 7 Nov 2026 (`20261106234131`).** **Not re-runnable**: `CREATE TABLE` without `IF NOT EXISTS`, and `ALTER TABLE case_contributions ADD COLUMN` without it either, so a second run fails. It `create or replace`d one live governance function (`block_contribution_rewrite`), widening it by three frozen columns. Applied on its own, never through an apply-all-pending run, because `0055`, `0061` and `0062` must stay unapplied. Verify via the 93 tests in `packages/db/src/intakeV2/caseTaking0066.db.test.ts`, which execute this exact file against PGlite. **Note on the applied text:** the committed file wraps its DDL in `BEGIN; … COMMIT;` and carries extensive comments; what was submitted to `apply_migration` was the same DDL with comments stripped and that envelope removed, because the tool supplies its own transaction and a nested `COMMIT` would have broken atomicity. Every resulting object was verified against this file — see the Track 2 report. |

## Choosing a filename for a new migration

**Do not take the highest number in this folder and add one.** The numeric
namespace is not contiguous and this folder is not the authority:

| Number | File here? | On `main`? | Applied? |
|---|---|---|---|
| `0055` | yes | yes | **no**, never applied — deferred |
| `0061` | **no** | **no** | no — written, sitting on `feat/protocol-adoption-signing` |
| `0062` | **no** (branch only) | **no** | no — written on `feat/care-path-foundations` |
| `0064`, `0065` | yes | yes | **yes — live** |
| `0066` | yes | yes | see the live history — applied 7 Nov 2026 |

**This table is a worked example of a trap, not a static fact.** It was true in
this shape on 7 November 2026; it goes stale the moment anything is applied or
a branch diverges. Always check all three sources yourself.

The trap in its own words: `ux/calm-client-and-cockpit` was cut from `main`
*before* the commit that reconciled the live `0064` and `0065` into it, so
that branch's folder appeared to stop at `0063` while the database already had
`0065` applied. Taking "0064" there would have collided with an applied
migration. (`0059` already exists under two different filenames in two
different refs — the same mistake, already made once.) That branch has since
been reconciled by merging `main`, which is why `0064` and `0065` now read
"yes" above.

Before naming a new file, check all three: every ref
(`git log --all --diff-filter=A --name-only -- 'supabase/migrations/00NN*'`),
`main`, and the live migration history.

## Release dependency — 0061 must not be applied after 0064

**0061 MUST NOT BE APPLIED AFTER 0064 UNTIL ITS PROTOCOL-SIGNING ELIGIBILITY
CALL IS RECONCILED TO ROLE-AWARE LEAD ELIGIBILITY.**

**This is live, not hypothetical. 0064 was applied to Production on 3 Nov 2026
(`20261103202418`), so the hazard below is active right now.**

`0064` made eligibility role-aware. Protocol signing is Lead authority — the
function establishes an active `team_role = 'lead'` before it asks about
eligibility at all — so it now asks
`practitioner_eligibility(auth.uid(), 'lead')`.

`0061` predates that and redefines the same function with the role-neutral
call. Applying it today reverts the check to "eligible for *any* role", which
would let a practitioner scoped only to `care_team` sign a Protocol as Lead.
This is not theoretical: it was reproduced against a post-0064 database.

Two call sites must be patched together, in the same coordinated Protocol
release:

| File | Site | Change |
|---|---|---|
| `supabase/migrations/0061_protocol_version_items.sql` | line 280, inside the function created at line 244 | `practitioner_assignment_eligibility(auth.uid())` → `practitioner_eligibility(auth.uid(), 'lead')` |
| `packages/db/src/intakeV2/protocolSigning.ts` | `rpcEligibilityResolver` | calls the role-neutral RPC; must pass the Lead role |

Neither was changed when this was found: 0061 is reserved and unapplied, and
`intakeV2` sits inside the Intake/Protocol review boundary. They belong to the
Protocol release, not to 0064.

The same caution applies to any other unapplied migration that redefines a
function `0064` rewires. Before applying anything from a branch written before
0064, diff its `create or replace function` list against 0064 section 8.

## Historical records restored 2026-10-10

`0056`, `0057` and `0058` were **applied to production from feature branches
whose files never reached `main`**, so this folder was three migrations behind
the database. The exact historical files have been restored, unmodified, so
the repository reflects what production has already applied.

**They were not executed, and none of their SQL was edited.** Nothing was
"repaired" to resemble today's schema.

| File | Applied | Source commit | SHA-256 of file content |
|---|---|---|---|
| `0056_practitioner_credentialing_gate.sql` | `20260919195711` | `24aa30b` (`care-journey-v4-connected`) | `ae34566a…bac7bf73` |
| `0057_care_team_live_wiring.sql` | `20260920210017` | `1c1479b` (`care-journey-v4-connected`) | `e6e7b955…9dfa90a` |
| `0058_agreements_public_and_prospectus.sql` | `20261003015129` | `3ab4192` (`sprint/agreements-prospectus`) | `15297ebb…e74b6e2b` |

In plain English:

- **0056** — the practitioner credential, agreement and indemnity eligibility
  gate for assignment. Creates the one authoritative
  `practitioner_assignment_eligibility()` function.
- **0057** — Care Team live wiring and practitioner-facing case-access
  hardening: per-case team roles with exactly one active Lead, the scoped care
  team health profile, append-only contributions, and Lead-gated care-plan
  release.
- **0058** — practitioner agreement public version history and the Corporate
  Prospectus enquiry infrastructure.

### Choosing the right 0057

`0057` went through four revisions before it was applied; three are drafts that
were never run. The restored file is the version at `1c1479b`, confirmed by
SHA-256 against the hash KR authorised at apply time
(`e6e7b955c317c0a29989a88a9b6c21194293d1ee8de08875638098dc9fafd90a`). The
commit that recorded the apply (`ada758b`) did not change the file, which is
why the content at `1c1479b` is what production received. The superseded
drafts — `7a372c2c…`, `6db97b29…`, `0b2b0aea…` — are deliberately not here.

### Known limits of these records

Their headline objects were verified present in the live catalogue on
2026-10-09 (`practitioners.category`, `credentials_verification_status`,
`practitioner_assignment_eligibility()`, `case_team_roles`,
`care_team_health_profile`, `case_contributions`, `care_plan_coordination`,
`release_care_plan()`, `prospectus_enquiries`).

That is **not** a claim that re-running these files would reproduce the live
schema exactly. They were applied out of numeric order and later migrations
may have altered what they created. Treat them as the historical record of
what was run, and the catalogue as the description of what exists.

## Standing drift check — run this at every release

Schema and code drift in **both** directions, and we have been bitten by each:

- **DailyPath** — application code read `daily_adherence.item_id`, a column
  that has never existed live. Code ahead of the database.
- **Release A** — migration `0060` was applied to production on 2026-10-11
  while the guard code that completes it sat unmerged on a branch for six
  days. Database ahead of the code.

So before calling any release closed, answer all three questions explicitly.
The answer is never "the files look right" — ask the database and ask the
deployment.

**1. Is any applied migration missing its application code in production?**

List what production has applied, and for the recent ones confirm the code
that depends on them is on `main` *and* in a deployment that reached READY.

```
mcp list_migrations                       # what the database has applied
git log --oneline origin/main -- supabase/migrations/   # what main records
```

A migration whose companion code is unmerged is a half-finished release: the
constraint is live but the application behaviour it was meant to enable is
not. Name the gap rather than assuming the migration is self-sufficient.

**2. Does live application code depend on a schema change that is not applied?**

Regenerate types from the live catalogue and type-check. A column or function
that code expects but production lacks shows up as a type error or, worse, a
runtime failure on a path tests do not cover.

```
mcp generate_typescript_types > packages/db/src/types.ts
git diff -- packages/db/src/types.ts
# Any unexpected diff requires reconciliation.
# A clean diff means generated types match the live catalogue;
# it does NOT prove triggers, RLS, constraints or other non-type behaviour.
pnpm -r exec tsc --noEmit
```

Deployment matters as much as merge: code on `main` that has not reached a
READY deployment is not live. Check the deployed commit, not the branch.

**3. Does the live catalogue contain the non-type schema behaviour the release
expects?**

Generated TypeScript types do not describe every database control. They do
not, by themselves, prove the live presence or exact behaviour of:

- triggers;
- RLS policies;
- constraints;
- grants;
- indexes;
- function bodies;
- security-definer / security-invoker behaviour.

For migrations that depend on any of those, inspect the relevant live
catalogue objects directly and compare them with the release expectation.
This matters most for governance and safety migrations, which are usually
*entirely* composed of things types cannot see.

`0060` is the worked example. It is not proven live because generated types
match — types say nothing about it. Its protection is a `BEFORE UPDATE`
trigger and trigger function preventing a practitioner from being changed to
Category 3 while they remain an active Lead on a case. So the check must
confirm the live trigger and function themselves:

```sql
select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'enforce_practitioner_class_vs_lead_role';

select 1 from pg_trigger
 where tgname = 'trg_practitioner_class_vs_lead_role' and not tgisinternal;
```

For a function whose *body* matters, read it back with `pg_get_functiondef()`
rather than trusting that a name exists — a `create or replace` from a later
migration can leave the name intact and the behaviour changed.

**The rule:** type parity proves typed schema compatibility. Catalogue
verification proves database behaviour. A release that depends on triggers,
policies, constraints or function behaviour needs both.

## Still outstanding

`0055_functional_ranges_source_metadata.sql` is a file that was **never
applied** (confirmed: `functional_ranges.range_type` and `source_label` are
both absent live). It is deferred by founder ruling and is not a dependency of
any current release. Do not apply it as part of unrelated work.

## Reserved identifiers — unapplied migrations on other branches

**`ls` in this folder does not tell you which identifier is free.** NI keeps
unapplied migrations on feature branches, so a number can be taken by a file
that is not on your branch and not in the live history either.

| Id | File | Where it lives | Status |
|---|---|---|---|
| `0061` | `0061_protocol_version_items.sql` | `feat/protocol-adoption-signing` only | Written, **not applied**. Reserved. |
| `0062` | `0062_case_events_client_authorship.sql` | `feat/care-path-foundations` | Written and tested, **not applied**. |

`0062` took the next free number rather than `0061` for exactly this reason:
on `feat/care-path-foundations` the folder ends at `0060`, which makes `0061`
look free when it is not. Two migrations sharing an identifier — one of them
touching protocol signing — is the kind of collision that is cheap to avoid
now and expensive to untangle later.

`0061` and `0062` are independent and may be applied in either order.

**Before writing a new migration**, check every branch, not just yours:

```bash
for b in $(git branch -a --format='%(refname:short)'); do
  git ls-tree --name-only "$b" supabase/migrations/ 2>/dev/null
done | sort -u | tail -15
```

### `0062_case_events_client_authorship.sql`

Additive change to `case_events` that lets a client record their own dated
update: a narrow INSERT policy (`follow_up_answer` only, own case only, self
attributed only), first-class actor attribution (`actor_user_id`,
`actor_capacity`), `occurred_at` separate from `created_at`, and structural
append-only enforcement for every role including `service_role`.

Every column is nullable with no default and every new CHECK passes for a NULL
capacity, so the existing rows and the existing `complete_practitioner_work`
writer are unaffected and **no backfill is required**.

Behaviour is covered by 30 PGlite tests in
`packages/db/src/careRecord/caseEvents.db.test.ts`, which execute this file
verbatim against a real Postgres — including RLS, which the `0061` suite could
not exercise. Those tests found two defects in earlier drafts of this file: an
unconditional append-only guard that refused its own `ON DELETE SET NULL`, and
an actor-coherence CHECK that would have blocked erasing a person. Both are
fixed and both have a test.
