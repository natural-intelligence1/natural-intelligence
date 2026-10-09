# Migration history reconciliation — files vs live production database

**Read-only audit, 2026-10-09.** Live catalogue + `supabase_migrations` read on
project `yftxzvdrxnhwpcnsrktn`. **No database change was made.** No migration
was applied, re-applied or repaired.

The reason this exists: the migrations folder is **not** production truth. A
developer reading it in good faith gets a false picture — which is exactly how
the DailyPath `item_id` defect survived for months.

---

## The headline problems

1. **Numeric order ≠ apply order.** Applied sequence by timestamp was
   `0053 → 0054 → 0051 → 0056 → 0052 → 0057 → 0058`. `0051` landed *after*
   `0053/0054`, and `0052` *after* `0056`.
2. **Four file headers are stale.** `0051`, `0052`, `0053` each say
   "⚠ COMMITTED AS A FILE ONLY — NOT YET APPLIED". All three **are applied**.
3. **`0029` materially misdescribes four live tables** and was never executed.
4. **Three applied migrations have no file on `main`** (`0056`, `0057`, `0058`).
5. **`0055` is a file that was never applied** — a real gap in the sequence.

## The matrix

| Migration | Intended purpose (plain English) | File exists | Applied live | Live matches intent? | Action |
|---|---|:--:|:--:|---|---|
| **0029** `sprint11_dailypath_schema` | Create the DailyPath tables: protocol templates, the items in them, a member's protocol, daily tick-offs, and streaks. | ✅ `main` | ❌ never executed | **No — materially wrong.** `daily_adherence.item_id` absent (live keys on `item_name`); `protocol_items.sort_order` is actually `display_order`; `adherence_streaks` has no `protocol_id` and is unique on `member_id` alone; `protocol_templates` has `created_by`/`is_published`, not `status`/`duration_weeks`. | **Done** — header notice added in the DailyPath hotfix recording that it is not evidence of live schema. SQL untouched. **Do not re-apply.** |
| **0051** `sprint3_safety_floor` | The Sprint 3 safety floor: versioned consent records, client data-rights requests, practitioner agreements, and de-identified practitioner review packs. | ✅ `main` | ✅ `20260913061409` | **Yes** — all five objects present. | Correct the stale "NOT YET APPLIED" header. |
| **0052** `narrow_practitioner_reads` | Narrow what practitioners can read before anonymisation, so they see review packs rather than raw client records. | ✅ `main` | ✅ `20260919215426` | **Yes.** | Correct the stale header. Note it applied *after* 0056. |
| **0053** `founder_preview_intake_allowlist` | Temporary: let one named founder account walk the intake journey while intake was closed to everyone else. | ✅ `main` | ✅ `20260912220213` | **Yes**, and correctly superseded by 0054. | Correct the stale header. No further action — it is spent. |
| **0054** `revert_founder_preview_intake_allowlist` | Undo 0053 after the founder ruling opened intake to everyone. | ✅ `main` | ✅ `20260913000439` | **Yes.** | None. The only file whose header matches reality. |
| **0055** `functional_ranges_source_metadata` | Add source and methodology fields to BioHub comparison ranges, so an educational range can only display when it carries an identifiable source. | ✅ `main` | ❌ **not applied** | **Consistent** — `functional_ranges.range_type` and `source_label` are both absent, exactly as expected for an unapplied migration. | **Founder decision.** It was written to satisfy a legal clearance condition. Either apply it or record why it is not needed. Not actioned here. |
| **0056** `practitioner_credentialing_gate` | Practitioner class, credential verification, indemnity and registration checks, plus one authoritative `practitioner_assignment_eligibility()` function. | ⚠️ **only** on `care-journey-v4-connected` | ✅ `20260919195711` | **Yes** — class, verification columns and the function are all live. | Bring the file onto `main` so the folder reflects production. |
| **0057** `care_team_live_wiring` | Per-case care team roles with one active Lead, the scoped care-team health profile, append-only contributions, and Lead-gated care-plan release. | ⚠️ **only** on `care-journey-v4-connected` | ✅ `20260920210017` | **Yes** — `case_team_roles`, `care_team_health_profile`, `case_contributions`, `care_plan_coordination`, `release_care_plan()` all live. | Bring the file onto `main`. |
| **0058** `agreements_public_and_prospectus` | Let the public read current practitioner agreements, and add the corporate prospectus enquiry table and private bucket. | ⚠️ **only** on `sprint/agreements-prospectus` | ✅ `20261003015129` | **Yes** — `prospectus_enquiries` live. | Bring the file onto `main` when that lane lands. |
| **0059** `protocol_signing` | Protocol signing and versioning: version number, signature, signatory, supersession link, case link, immutability and signing-authority triggers. | ✅ `release/connected-care-integration` | ❌ **not applied, by instruction** | n/a — nothing applied | Hold. Unchanged by this audit. |

## Where live differs: cause, as far as the evidence supports

| Difference | Cause | Confidence |
|---|---|---|
| `0029` vs live (4 tables) | **Manual historical creation.** The file states it on its face: "Tables created directly in Supabase dashboard… This file exists for auditability; do NOT re-run." The tables were hand-built; the file was written afterwards from memory and never reconciled. | **High** — self-documented. |
| `0051/0052/0053` headers say unapplied | **Process drift.** Each was authored under a "file only, needs founder authorisation" rule; authorisation was later given and the migration applied, but nobody went back to amend the header. | **High** — the applied timestamps exist and all objects are present. |
| `0056/0057` files absent from `main` | **Branch divergence.** Both were authored and applied from `care-journey-v4-connected`; the DB migration landed, the file never reached `main` because the branch was never merged. | **High.** |
| `0058` file absent from `main` | Same pattern on `sprint/agreements-prospectus`. | **High.** |
| Apply order ≠ numeric order | **Unknown in detail.** The timestamps prove it happened; nothing in the repo records why `0051` was applied after `0053/0054`, or `0052` after `0056`. Most likely sequential founder authorisations granted out of numeric order. | **Low — evidence cannot determine it.** Not asserted as fact. |
| `0055` unapplied | **Deliberate or forgotten — cannot tell.** The header says it awaits authorisation; no record shows authorisation being given or withheld. | **Low.** Needs a human answer. |

Nothing here is "repaired" by applying an old migration. Re-running `0029`
would actively damage production, and re-running `0051–0054` would be
meaningless at best.

## Recommendation — one canonical source of truth

**The live database catalogue is the only authority. The migrations folder is
a change log, not a schema description.** Three changes make that safe:

1. **Make the generated types the working source of truth for developers.**
   `packages/db/src/types.ts` is generated from the live database and was
   correct about `daily_adherence` throughout — it is the artefact that would
   have prevented this bug. Regenerate it immediately after every apply, and
   treat a diff in it as the real record of what a migration did.

2. **Never hand-create schema in the dashboard again.** Every change goes
   through a migration file that is actually executed. If an emergency forces
   a manual change, the follow-up migration is written and applied the same
   day so the file and the database agree.

3. **Retire the stale-header problem structurally.** A header cannot state
   applied-status reliably, because status changes after the file is written.
   Drop "NOT YET APPLIED" banners entirely and let the applied list answer
   that question — one place, always current. Where a file must not be run,
   say *that* (as `0029` now does), which never goes stale.

Two smaller follow-ups, each needing authorisation and **not** done here:
bring the `0056`/`0057`/`0058` files onto `main` so the folder stops hiding
three applied migrations; and resolve `0055` one way or the other.
