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

   `0053 → 0054 → 0051 → 0056 → 0052 → 0057 → 0058 → 0059 → 0060`

   `0051` landed after `0053/0054`; `0052` after `0056`. The latest applied
   migration is `0060` (`20261011170031`). `0055` has never been applied.
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
