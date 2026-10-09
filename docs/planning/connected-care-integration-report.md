# Connected Care — integration & promotion report

**Branch:** `release/connected-care-integration`, cut from `origin/main` @ `14330c15`
**Source:** `care-journey-v4-connected` @ `f6a1465` (frozen, unaltered)
**Date:** 2026-10-09
**Status:** promotion *recommendation*. Nothing was merged, deployed, applied or enabled.

---

## A. The five overnight commits

| Hash | Plain English | Files |
|---|---|---|
| `1082fa9` | The factual record: 10-chapter journey over the existing V2 registry; provenance widened 4 → 11 states; influences that refuse to infer causation; the Concern Card; branch lifecycle; dated updates; the factual Synopsis generator. | 10 |
| `6834398` | The three founder preview screens, plus a fix to the Care V2 preview chip map that the provenance widening broke. | 6 |
| `cccb146` | Call Sheet assembly; nutrition's three separated layers + therapeutic aims + outcome measures; the safety review workflow machinery. | 5 |
| `58abb4f` | The Stage 0 delta map and the prepared (unapplied) migration. | 2 |
| `f6a1465` | The morning report. | 1 |

Branch head `f6a1465`. Merge base with `main` is `2747f83` — i.e. the branch diverged *before* main's workshop commits, and main's `86dccdc`/`14330c1` are cherry-picks of the branch's `f8721b3`/`1a5815e`. That is why a whole-branch merge would have looked deceptively small.

**Parents inherited from the earlier Care V2 / Sprint 4–6 branch: 20 commits.** All of Sprint 4, 5 and 6 application code, the solicitor-controls work, the Field Registry work, the three older design previews, and duplicate copies of the two workshop commits.

The source branch was **not altered**.

## B. Dependency map

Traced from the import graph of all 10 Connected Care modules, not from commit boundaries.

**Class A — already on main, no action:** `types.ts`, `registry.ts`, `flow.ts`, `callSheet.ts`, `autosaveQueue.ts`.

**Class B — branch-only and genuinely required (6 modules):**

| Module | Required by | Why |
|---|---|---|
| `provenance.ts` | influences, concerns, synopsis, nutrition | The 11 provenance states everything is built on. Leaf, no imports. |
| `caseSnapshot.ts` | updates, synopsis | The frozen submitted snapshot updates are measured against. Leaf. |
| `fieldRegistry.ts` | synopsisMapping | The canonical field list. Leaf. |
| `synopsisMapping.ts` | callSheetBuilder, safetyWorkflow | `V2SafetyReviewItem` + `deriveV2SafetyReviewItems`. Imports fieldRegistry + registry. |
| `governanceControls.ts` | `connectedCare.test.ts`, and §8's governance proofs | `canSignClinicalConclusions`, `canVerifyClinicalFacts`. Leaf. |
| `careTeam.ts` | §8's one-Lead and Category 3 proofs | `validateLeadAssignment`, role rules. Imports fieldRegistry + governanceControls. |

All six are **pure domain modules** — types, constants and functions. None touches the database, none renders UI, none is reachable by a client.

**Class C — branch-only and unrelated, excluded.** Listed in section D.

**Class D — unclear, resolved:** `wordingReview.ts` looked required because `synopsisMapping.test.ts` imports it. Investigation showed it is needed by **one `describe` block only**, and it drags in `wordingReviewPurpose.ts` → `fieldGovernance.ts`. Resolved as Class C; see section H.

Dependency tree:

```
Connected Care (10 modules)
├── registry.ts ·········· A (on main)
├── types.ts ············· A
├── callSheet.ts ········· A
├── provenance.ts ········ B  (leaf)
├── caseSnapshot.ts ······ B  (leaf)
└── synopsisMapping.ts ··· B
    ├── fieldRegistry.ts · B  (leaf)
    └── registry.ts ······ A

Governance proofs required by mission §8
├── governanceControls.ts  B  (leaf)
└── careTeam.ts ·········· B
    ├── fieldRegistry.ts · B
    └── governanceControls.ts B
```

## C. Clean integration branch

`release/connected-care-integration`, cut from `origin/main` @ `14330c15`. The old branch was **not merged**.

Reconstructed: 6 dependency modules + 4 of their test files, 10 Connected Care modules + 2 test files, 4 preview files, a reconstructed barrel, a new route-map preview block, the delta map, and the amended migration. **30 files.**

Two compatibility fixes were required because main differs:

1. **The barrel was rewritten, not copied.** The overnight `index.ts` re-exported the whole Sprint 4–6 domain layer, so importing Connected Care from it would have been equivalent to promoting Sprint 4–6. The reconstructed barrel is main's barrel plus exactly the Class B modules.
2. **`_connected/shared.tsx` was made self-contained.** It imported its palette and `SyntheticBanner` from `_careV2/ui`, whose fixtures pull in the field registry, case snapshot and synopsis mapping — the whole Care V2 preview architecture, for a colour table and a six-line banner. The palette is now declared locally, which is the established NI preview pattern (the pricing preview already on main does the same). This also made the overnight fix to `_careV2/ui.tsx` unnecessary here: that file does not exist on this branch.

## D. Unrelated work explicitly excluded

Nothing below rides into this release.

**Domain:** `fieldGovernance.ts`, `legalProfiles.ts`, `wordingReview.ts`, `wordingReviewPurpose.ts` (+ their tests).
**Practitioner layer:** `credentialing.ts`, `careTeamLive.ts`, `packModeE2E.test.ts`, `__test-helpers__/makeAssignable.ts`, and the modifications to `assignWork`, `listWorkForInbox`, `createClientPractitionerLink`, `practitioners/types.ts`, `practitioners/index.ts` and ~12 practitioner test files.
**Admin UI:** `CredentialingPanel.tsx` and the `practitioners/[id]` change; the `_careV2` preview set; the care-team, intake-v2 and synopsis-v2 previews.
**Web:** the `IntakeV2Flow.tsx` modification.
**RLS:** `attack0052.test.ts`, the `negative.test.ts` modification.
**Migrations:** the `0056` and `0057` files (their DB migrations are already applied; only the files are absent from main).
**Types:** `packages/db/src/types.ts` — see section F.
**Docs:** the Sprint 4/5/6 planning docs, the safeguarding SOP, the wording-review doc, the solicitor-rulings modification.
**Commits:** the two duplicate workshop commits.
**Whole lane:** practitioner agreements and the Corporate Prospectus, untouched on `sprint/agreements-prospectus` @ `3ab4192`.

## E. Migration numbering

Read from the live applied list, not from files.

- Newest applied: `20261003015129` = **`0058_agreements_public_and_prospectus`** (3 Oct). Its *file* lives only on `sprint/agreements-prospectus`.
- `0056` and `0057` are applied; their files exist only on `care-journey-v4-connected`. **Main's migrations folder is three behind the database.**
- `0055_functional_ranges_source_metadata.sql` exists as a file and is **not applied** — a genuine gap.
- No `0059` is applied, and no branch other than this one claims `0059`.

**`0059` remains correct.** No collision, no renumbering needed. The file is renamed `0059_protocol_signing.sql` to match its reduced scope.

## F. DailyPath schema truth — and why the three sources diverged

Live catalogue, read 2026-10-09:

```
daily_adherence: id, member_id, protocol_id, item_name, item_type, dose,
                 timing, log_date, completed, completed_at, skipped,
                 skip_reason, notes, created_at
UNIQUE (member_id, protocol_id, item_name, log_date)
FK protocol_id → member_protocols(id) ON DELETE CASCADE
RLS on; "Members manage own adherence" ALL, member_id = auth.uid()
```

**There is no `item_id`, and there never was.** The live key is `item_name`.

| Source | Says | Verdict |
|---|---|---|
| Live catalogue | `item_name` key, no `item_id` | **Authoritative** |
| `0029_sprint11_dailypath_schema.sql` | `item_id uuid not null`, `unique(…item_id…)`, `sort_order`, `adherence_streaks.protocol_id` | Wrong, and says so itself |
| `packages/db/src/types.ts` (branch) | matches live — no `item_id` | Correct |
| Application code | selects and upserts on `item_id` | **Wrong — this is the bug** |

**Why they diverged:** `0029` is a *retrospective record* of tables created by hand in the Supabase dashboard; its own header says "Tables created directly in Supabase dashboard… do NOT re-run". The hand-made tables never matched the file, and not only for `item_id` — live `protocol_items` has `display_order` (file says `sort_order`), live `protocol_templates` has `created_by`/`is_published` (file says `status`/`duration_weeks`), and live `adherence_streaks` has no `protocol_id` at all and is unique on `member_id` alone. The generated types later captured reality correctly. Anyone reading the migrations folder — which is the natural thing to do — gets a false picture.

**This changes the fix.** The objective "a DailyPath row is tied to its protocol item" is **already met** by `item_name`, which the live unique constraint uses and which the insert path at `page.tsx:60-68` already writes. The defect is three places naming a column that never existed:

- `page.tsx:46,75` — `select('id, item_id, …')`
- `page.tsx:71`, `actions.ts:255` — `onConflict: 'member_id,protocol_id,item_id,log_date'`
- `page.tsx:90,95` — `itemMeta` keyed by `protocol_items.id`, read with `a.item_id` → always `undefined`, so **dose, timing, notes and sort order silently fall back to defaults** even when the page does render

No migration is required. The fix is to use `item_name`. It is a change to `apps/web` and is **deliberately not in this release** — bundling an unrelated production fix into the Connected Care promotion is exactly the failure mode this mission exists to prevent. It should go as its own small branch.

## G. Prepared migration — final status

`supabase/migrations/0059_protocol_signing.sql`. **Prepared, never executed against any database.**

In plain English it would: add a version number, a signature state (`draft`/`signed`/`superseded`), who signed and when, a link to the version it replaces, and a case reference to `member_protocols`; add two database triggers so a signed protocol **cannot be edited in place and cannot be deleted** (only superseded); and add two optional columns to `daily_adherence` so a day's action can record which signed version and which practitioner it came from.

Review outcome:

- **Every referenced table and column verified against the live catalogue.** The overnight draft's "unverified" warning no longer applies.
- **The DailyPath section was removed** for the reason in section F. The file shrank from four sections to three and was renamed.
- **Additive only.** No column dropped, no type narrowed, no row rewritten or deleted. Existing rows default to `draft` with no signature, which is accurate — nothing live was ever signed.
- **`protocol_state` added alongside `status`, not replacing it.** Live `status` is constrained to `active|paused|completed|archived` and is a different axis; an active protocol can be an unsigned draft. Reusing it would mean rewriting rows and widening a CHECK other code reads.
- **`onConflict` compatibility:** no longer applicable — the partial-unique-index risk disappeared with the DailyPath section.
- **RLS:** untouched. Nothing granted to anon. Note the existing `member_protocols` policy *"Practitioners can view assigned member protocols" USING (assigned_by = auth.uid())* already exists but can never match, because `assigned_by` is never written.
- **Failure characteristics:** wrapped in a transaction, `if not exists` throughout, so re-running is safe. A full rollback script is included and is safe precisely because every object is additive.
- **Could it be avoided?** For signing, no. Live `member_protocols` has 12 columns and not one could carry a signature, a version or a supersession link.

## H. Regression tests

**149 passing, 9 files, on the clean branch.** Type-checks clean across `packages/db`, `packages/ui`, `apps/web`, `apps/care`, `apps/admin`. `apps/admin` builds clean. Lint clean.

The source branch had 168. The 19-test delta is fully accounted for and contains no Connected Care coverage: `fieldGovernance.test.ts` (11) and `legalProfiles.test.ts` (6) are Class C and absent; and 2 tests in the `task 10 — question-wording review pack` block of `synopsisMapping.test.ts` were removed because they need `wordingReview` → `wordingReviewPurpose` → `fieldGovernance`. Importing three unrelated governance modules to keep two tests would have widened the release; that coverage stays on `care-journey-v4-connected`. The removal is commented in place, not silent.

Against the mission's §8 list:

| Required proof | Result |
|---|---|
| Canonical V4 journey compiles | ✅ `unmappedSections()` asserts complete coverage of the V2 registry |
| V2 persistence not broken | ✅ `flow.ts`, `registry.ts`, `autosaveQueue` untouched; `registry.test.ts` 17/17, `autosaveQueue.test.ts` 9/9 |
| Concern Card works | ✅ holds references not copies; `deriveClarificationItems` covered |
| Provenance states work | ✅ `fieldRegistry.test.ts` asserts the original four survive in order as the base, plus a no-removal test |
| Factual Synopsis from synthetic answers | ✅ 11 sections, `factual-synopsis.v1` |
| **No Analysis & Plan generated** | ✅ synopsis filters out `practitioner_interpreted` and never emits "systems under stress" |
| One Lead rule preserved | ✅ `careTeam.test.ts` 11/11 |
| Category 3 sole-Lead prohibition | ✅ same suite |
| Student cannot approve/sign | ✅ `governanceControls.test.ts` 8/8 |
| Practitioner attribution preserved | ✅ corrections sit beside originals; Call Sheet entry test asserts **object identity** of `clientAnswer` |
| NI can only create/open a human-review item | ✅ `open` is the only state NI can create; `raised` the only audit event without an actor |
| Software cannot choose disposition | ✅ decision needs prior acknowledgement, a named reviewer and the practitioner's own words; no NI decision vocabulary exists |
| Newer safety content not overwritten | ✅ no safety rule content touched at all; the 36-rule candidate bundle was not loaded |
| Signed presentation immutable | ✅ demonstrated in preview C; database enforcement pending 0059 |
| Revision creates a new version | ✅ same |
| No silent clinical-content mutation | ✅ DailyPath has no control that can alter dose, amount, frequency or instruction |
| Migration-dependent behaviour clearly pending | ✅ preview C states on its face that the live schema does not support the contract |

## I. Rendered UX / accessibility

The admin middleware requires auth on **every** route and has no dev bypass (`PUBLIC_ROUTES` is `/login` and `/auth/*` only). I did not circumvent it. Instead the three components were rendered in isolation with `react-dom/server` plus the Tailwind CSS compiled from those exact files, served over HTTP, and measured in a real browser. This tests the real components' output.

| Check | Client Today | Case Overview | Signed Protocol |
|---|---|---|---|
| 320px — horizontal scroll | none | none | none |
| 320px — elements overflowing viewport | 0 | 0 | 0 |
| 640px (≡ 1280px @ 200%) | none | none | none |
| Focusable controls | 14 | 11 | 2 |
| Targets under 44px | 0 | 0 | — |
| Status conveyed by colour alone | no | no (11 chips, all text-labelled) | no (`Current`/`Superseded` are text) |

Keyboard and focus, on real `Tab` presses: first stop is the `Today` tab with `aria-current="page"`; `:focus-visible` matches and the computed `box-shadow` is the intended two-ring indicator (`#FBF7EF` 2px offset, `#7D6128` 2px ring). Fifth stop is the `Done` control, `role="button"`, `aria-disabled="true"`, same visible ring. Tab order follows reading order.

`member_protocols.assigned_by` — the longest unbreakable token — renders 200px wide inside a 248px content box at 320px, with `break-words` as the safety net.

One honest limitation: the previews use `px` type, matching every other NI preview, so they satisfy resize-to-200% via **page zoom** (the normative technique) rather than text-only zoom. Doubling the root font size showed no overflow, but px text does not scale from that setting.

## J. Minimum safe promotion sequence — NOT executed

1. Review this branch's 30-file diff against `origin/main`. It is the whole proposal.
2. Confirm the Class B six are acceptable as **dormant domain code** — pure types and functions, no DB access, no route, no UI, unreachable by any client. This is the one genuine judgement call; see section K.
3. Open a PR from `release/connected-care-integration` to `main`. Do not merge `care-journey-v4-connected`, ever.
4. Let CI run type-checks, the 149 tests, and builds for all three apps.
5. Merge **only after** step 2 is answered. Deploy is a separate decision from merge.
6. Deploy `apps/admin` alone. The previews are admin-only, noindex and inert; `apps/web` and `apps/care` are unchanged by this branch and need no deploy.
7. Founder walkthrough of the three previews at `/route-map`.
8. **Separately and independently**, fix the DailyPath `item_name` bug on its own branch. Do not attach it to this release.
9. **Separately again**, if and when protocol signing is wanted: run 0059's pre-apply block, apply, run the post-apply block, regenerate types.

Flags stay off throughout. `PRACTITIONER_REVIEW_PACKS_ENABLED` remains OFF. No client sees anything new at any step.

## K. Founder decisions

1. **Promote six dormant Sprint 4–6 domain modules?** Connected Care genuinely cannot compile without `provenance`, `caseSnapshot`, `fieldRegistry` and `synopsisMapping`; `governanceControls` and `careTeam` are there because you asked for the governance rules to be proven. All six are pure types and functions — no database access, no route, no UI, nothing a client can reach. *Dependency is not activation.* But it does put Sprint 4–6 code on `main` for the first time, so it is your call, not mine.

2. **DailyPath is broken in production right now.** Not a Connected Care issue — it predates this work. Clients on an active protocol hit a page that queries a non-existent column, and even where it renders, dose/timing/notes are silently lost. The fix is ~4 lines and needs no migration. Do you want it as its own change now, ahead of this release?

3. **Main's migrations folder is three behind the database** (`0056`, `0057`, `0058` applied, files elsewhere) and `0055` is a file that was never applied. Separately, `0029` actively misdescribes four live tables. Reading the folder gives a false picture of production — which is precisely how the DailyPath bug survived. Worth a reconciliation pass as its own task.

4. **Protocol signing: wanted now, or later?** It is the one place a migration is genuinely unavoidable, and until it lands the signed-protocol screen is a demonstration. Not urgent unless practitioners are about to issue protocols.

5. **Sprint 4–6 application code remains absent from `main`** while its migrations are applied. This branch does not resolve that, and deliberately so. It still needs its own reviewed decision.
