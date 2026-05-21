# Personalisation Substrate — Final Report

**Sprint:** Personalisation Substrate (a bounded phase between Phase B closure and Phase C onboarding)
**Sub-phases:** PS.1 Schema → PS.2 Practitioner UX → PS.3 Dashboard gating → PS.4 AI generation
**Date opened:** 2026-05-19 (design proposal `42777ff`)
**Date closed:** 2026-05-19 (PS.4 verification report `9303da7`)
**Status:** Closed

---

## 1. What the Personalisation Substrate delivers

Before this sprint, NI had no way to ask a member their biological sex or religious framing preference, and no architectural place to store the answer. Sex-specific intake questions (the existing `menstrual_flow_heaviness` branching rule) were shown to every intake-taker because the platform had no sex gate. Body story narration, lab interpretation, and synopsis generation were sex-blind and religiously-neutral by default — adequate for v1 but clinically lossy. The Personalisation Substrate closes that gap end-to-end.

The schema substrate now exists: `user_personalisation` carries `biological_sex`, `religion`, `religious_content_preference`, and (practitioner-only) `clinical_notes_on_sex`. Row creation is eager and automatic — `handle_new_user()` was extended to create a defaults-filled row whenever a new auth user is provisioned, and a one-time backfill ensured every existing profile has a row. Defaults are conservative: `religion='prefer_not_to_say'`, `religious_content_preference='hide'`, `biological_sex=null`. The platform fails safe to secular, sex-neutral output when no answers exist.

Practitioners can now see clinical context for their assigned clients. The care app workspace renders a Clinical context subsection in the ClientSummaryPanel showing `Sex: Female / Male / Not recorded` and an inline-editable `clinical_notes_on_sex` field for trans/intersex/edge-case nuance. Religion and content preference are **not** surfaced to practitioners — they are preferences, not clinical facts. Access is enforced by a column-scoped `practitioner_client_personalisation` view (F2 pattern) and a SECURITY DEFINER RPC for writes.

Dashboard rendering and AI generation paths both read personalisation through dedicated helpers and architectural boundaries. `PersonalisationProvider` mounted only in the dashboard layout (provider absent on public routes — verified by code structure and a CI grep boundary script). AI prompts (body story, synopsis, BioHub lab interpretation) receive a CLIENT CONTEXT block prepended to their system prompts — sex-keyed clinical instruction for all three, and religious framing instruction for the two narrative paths (BioHub gets sex-only, Option iii — lab data isn't narrative). The Islamic framing gate is the explicit two-condition rule `religion === 'muslim' AND religiousContentPreference === 'show'`; every other combination produces secular framing. Logs emit only the derived boolean (`islamic_framing_enabled`) — the religion value itself never enters any log payload.

The substrate is proven by one production-rendered surface (`BiohubReferenceNote`) and four AI generation paths with unit-tested prompt builders. Islamic narrative content has not yet been authored, by design — the substrate is *ready* for content; authoring is a separate phase. Public marketing surfaces stay secular by architecture (not convention): the provider isn't mounted there, the helpers can't be imported there (CI script enforces), and a runtime grep against the public marketing HTML confirms zero religion-related strings appear.

---

## 2. Sub-phase commit log

### Design (pre-implementation)

| Commit | Title |
|---|---|
| `42777ff` | docs(intake): Personalisation Substrate design proposal — biological sex, religion, content gating |
| `bbbb305` | docs(intake): Personalisation Substrate addendum — RLS, RPC, trigger, decision confirmations |

### PS.1 — Schema + capture substrate

| Commit | Title |
|---|---|
| `0ef9678` | feat(db): user_personalisation — table, RLS, view, RPC, trigger, handle_new_user extension, backfill (PS.1) |
| `af01b81` | feat(db): user_personalisation types + tests (PS.1) |
| `4cd1506` | docs(intake): future-sensitive-columns architectural contract + PS.1 verification report |

### PS.2 — Practitioner workspace UI

| Commit | Title |
|---|---|
| `e4bb838` | feat(db): getClientPersonalisation helper + tests (PS.2) |
| `aab332d` | feat(care): updateClinicalNotesOnSex server action (PS.2) |
| `65cbe87` | feat(care): Clinical context subsection in ClientSummaryPanel with inline edit (PS.2) |
| `b50cee4` | docs(intake): PS.2 verification report — 10/10 PASS, no F-findings |

### PS.3 — Dashboard PersonalisationProvider + worked example

| Commit | Title |
|---|---|
| `8b0b9bc` | feat(db): getPersonalisationContext helper + Islamic gate tests (PS.3) |
| `21dcea0` | feat(web): PersonalisationProvider + usePersonalisation hook (PS.3) |
| `8e389c1` | feat(web): mount PersonalisationProvider in dashboard layout (PS.3) |
| `5a6f0e6` | feat(web): gate BiohubReferenceNote on biologicalSex (PS.3 worked example) |
| `c6366a5` | chore: CI boundary grep for getPersonalisationContext (PS.3) |
| `72736d1` | docs(intake): PS.3 verification report — 8/8 PASS, dashboard substrate live |

### PS.4 — AI generation prompt parameterisation

| Commit | Title |
|---|---|
| `bc2acf3` | feat(db): getPersonalisationForGeneration + buildPersonalisationBlock + tests (PS.4) |
| `7883815` | feat(web): wire generateBodyStory with per-request personalisation system prompt (PS.4) |
| `e08fb5f` | feat(web): wire generateHealthSynopsis with personalisation context (PS.4) |
| `479aae5` | feat(web): wire biohub lab interpretation with biological_sex context (PS.4 Option iii) |
| `9303da7` | docs(intake): PS.4 verification report — 9/9 PASS, AI generation parameterised |

**Total Personalisation Substrate commits: 20** (2 design + 3 PS.1 + 4 PS.2 + 6 PS.3 + 5 PS.4)

---

## 3. Migration applied

| Sub-phase | Migration name | File in repo | Description |
|---|---|---|---|
| PS.1 | `ps1_user_personalisation` | `supabase/migrations/0047_ps1_user_personalisation.sql` | Single migration covering `user_personalisation` table + RLS enable + 4 base-table policies (member SELECT/INSERT/UPDATE + admin ALL; no DELETE) + `set_user_personalisation_updated_at` trigger via `handle_updated_at()` + `set_clinical_notes_on_sex(uuid, text)` SECURITY DEFINER RPC + `practitioner_client_personalisation` view (column-scoped, F2 pattern) + `handle_new_user()` extension (eager row creation for new auth users) + one-time backfill for existing profiles. |

All statements idempotent (`CREATE IF NOT EXISTS` / `DROP IF EXISTS` / `CREATE OR REPLACE` / `ON CONFLICT DO NOTHING`). **No drift** between live DB and `supabase/migrations/`: the migration applied via MCP carries a matching numbered file in the repo. `supabase db reset` from a clean checkout reproduces the live state — every existing profile gets a defaults-filled personalisation row, the view exposes only the four practitioner-safe columns, and the RPC enforces the two-layer auth check.

This is the only migration in the Personalisation Substrate phase. No other DDL was applied.

---

## 4. New helpers and modules

All exported via subpath barrels in `packages/db`.

| Helper / module | Location | Purpose | Sub-phase |
|---|---|---|---|
| `getClientPersonalisation` | `packages/db/src/personalisation/getClientPersonalisation.ts` | Practitioner-side read of `practitioner_client_personalisation` view — returns biologicalSex + clinicalNotesOnSex for an assigned client; null when view yields zero rows. | PS.2 |
| `setClinicalNotesOnSex` | `packages/db/src/personalisation/setClinicalNotesOnSex.ts` | Typed wrapper around the `set_clinical_notes_on_sex` RPC. Throws on RPC error. | PS.1 |
| `getPersonalisationContext` | `packages/db/src/personalisation/getPersonalisationContext.ts` | Authenticated user reads own row for dashboard rendering. Returns `PersonalisationContext` (biologicalSex, religion, religiousContentPreference) — clinical_notes_on_sex absent by type. Soft-fails to safe defaults. | PS.3 |
| `isIslamicContentEnabled` | `packages/db/src/personalisation/getPersonalisationContext.ts` | Pure function: `religion === 'muslim' && religiousContentPreference === 'show'`. The single source of truth for the Islamic gate boolean used by dashboard rendering. | PS.3 |
| `getPersonalisationForGeneration` | `packages/db/src/personalisation/getPersonalisationForGeneration.ts` | Admin-client read of personalisation row for AI generation paths. Same shape as `PersonalisationContext`; distinct helper because it runs admin-side and may target a memberId other than the calling user. Soft-fails to defaults. | PS.4 |
| `buildPersonalisationBlock` | `packages/db/src/prompts/buildPersonalisationBlock.ts` | Builds the full CLIENT CONTEXT text block for AI system prompts — sex line + sex-pattern instruction + framing instruction (Islamic or secular). | PS.4 |
| `buildBiologicalContextBlock` | `packages/db/src/prompts/buildPersonalisationBlock.ts` | BioHub variant (Option iii) — biological_sex only. Structurally cannot emit religious framing copy (hard test asserts). | PS.4 |
| `isIslamicFramingEnabled` | `packages/db/src/prompts/buildPersonalisationBlock.ts` | Same gate boolean as `isIslamicContentEnabled` but typed for the generation context. Used in log payloads so religion value never appears in logs. | PS.4 |
| `updateClinicalNotesOnSex` (server action) | `apps/care/app/cases/actions.ts` | Three-layer auth wrapper around `set_clinical_notes_on_sex` RPC. Server-side `getUser()` check + RPC layer 2 + no client-trusted practitioner_id. | PS.2 |
| `ClinicalNoteEditor` (client component) | `apps/care/components/workspace/ClinicalNoteEditor.tsx` | Inline edit affordance for `clinical_notes_on_sex` in the practitioner workspace. Idle / editing / saving states; no page reload. | PS.2 |
| `PersonalisationProvider` + `usePersonalisation` | `apps/web/app/dashboard/_components/PersonalisationProvider.tsx` | React context provider mounted only in the dashboard layout. `usePersonalisation()` throws if called outside the provider. | PS.3 |
| `BiohubReferenceNote` (client component) | `apps/web/app/dashboard/biohub/BiohubReferenceNote.tsx` | First production surface gated on `biologicalSex`. Renders female / male / neutral reference-range copy. | PS.3 |
| CI boundary script | `scripts/check-personalisation-boundary.sh` | Fails CI if `getPersonalisationContext` is imported outside the allow-list (`apps/web/app/dashboard/**`, `apps/care/**`, `packages/db/src/personalisation/**`). | PS.3 |

**New package subpath exports:** `@natural-intelligence/db/personalisation` (PS.1) and `@natural-intelligence/db/prompts` (PS.4).

---

## 5. Architectural contracts established

Two contracts now bind future work on personalisation. Both are committed to the design proposal as canonical references.

### Future-Sensitive Columns Rule

**Where it's documented:** `docs/intake/personalisation-substrate-design-proposal.md` — "Architectural Contract — Future-Sensitive Columns Rule" section (appended after the addendum).

**What it says:** New columns added to `user_personalisation` are NOT automatically exposed anywhere. Every future field must be:
1. Explicitly classified as practitioner-visible / AI-only / client-only / none.
2. Practitioner visibility requires explicit DDL change to `practitioner_client_personalisation` view.
3. AI access requires explicit addition to `packages/db/src/prompts/` builders.
4. Dashboard exposure requires explicit addition to `PersonalisationContext` shape and `getPersonalisationContext` helper.
5. Every PR adding a column must state in its description which exposure surfaces it's wiring up and why.

**Information exposure is opt-in per surface, never inherited from the base table.**

**Tested in CI by:**
- PS.1 SMOKE-8 — `information_schema.columns` query asserts `practitioner_client_personalisation` exposes exactly `(user_id, biological_sex, clinical_notes_on_sex, updated_at)`; fails the build if `religion` or `religious_content_preference` ever appear.
- PS.3 type-level `@ts-expect-error` test — `PersonalisationContext` does not accept `clinical_notes_on_sex`.
- PS.3 runtime test — `Object.keys(getPersonalisationContext(...))` equals exactly `['biologicalSex','religion','religiousContentPreference']`.
- PS.4 hard test on `buildBiologicalContextBlock` — 7 religion-related substrings asserted absent across 3 worst-case input variants.

### Public Frontend Boundary

**Where it's documented:** Design proposal §8 and addendum Part 4.

**What it says:**
- `<PersonalisationProvider>` is mounted **only** in `apps/web/app/dashboard/layout.tsx`.
- `getPersonalisationContext` is namespaced to authenticated use.
- A CI grep script enforces the import boundary (`scripts/check-personalisation-boundary.sh`).
- Marketing OpenGraph, sitemap, and root metadata are static and structurally cannot incorporate personalisation.

**Tested in CI by:**
- `bash scripts/check-personalisation-boundary.sh` — exits 1 with file/line info if `getPersonalisationContext` is imported outside the allow-list. Verified in PS.3 SMOKE-7 by deliberately introducing a violation and confirming the script catches it.
- PS.3 SMOKE-8 — runtime grep against `https://natural-intelligence.uk/` confirmed zero matches for each of `religion / muslim / christian / jewish / hindu / buddhist / sikh / religious / religious_content_preference` across DOM HTML, DOM text, and raw HTTP response (3 layers).

---

## 6. Privacy and access summary

| Field | Client | Practitioner | Admin | AI generation | Dashboard UI | Public |
|---|---|---|---|---|---|---|
| `biological_sex` | own row | yes (via view) | yes | yes (all 3 AI paths) | yes (PersonalisationContext) | **never** |
| `religion` | own row | **no** (deliberate) | yes | derived boolean only (`islamic_framing_enabled`) | yes (for rendering gate) | **never** |
| `religious_content_preference` | own row | **no** (deliberate) | yes | via boolean only | yes (for rendering gate) | **never** |
| `clinical_notes_on_sex` | **hidden** (practitioner-write, chart annotation) | yes — read/write via view + RPC | yes | **never** | **never** | **never** |

**Notes:**
- The "no" on practitioner visibility for `religion` and `religious_content_preference` is the decision recorded in Q4 of the design proposal. Practitioners have what they clinically need (sex + chart note); preferences stay with the client.
- "AI generation: derived boolean only" means the prompt builder reads `religion` and `religiousContentPreference` to compute `isIslamicFramingEnabled`, but log payloads only ever carry the boolean. The religion value itself never enters any logged JSON.
- `clinical_notes_on_sex` is excluded from `PersonalisationContext` *by type*. Adding it would fail TypeScript compilation (`@ts-expect-error` test enforces). This is the strongest tier of the Future-Sensitive Columns Rule.
- Public surfaces are negated at all four columns. Marketing, /community, /directory, /resources, /legal, /login, /signup, /welcome have no access to any personalisation field at any layer.

---

## 7. Test count progression

| Stage | Passing tests | Skipped | Delta |
|---|---|---|---|
| End of Phase B | 169 | 69 | — |
| After PS.1 | 174 | 82 | +5 unit / +13 integration-skipped |
| After PS.2 | 177 | 84 | +3 unit / +2 integration-skipped |
| After PS.3 | 186 | 84 | +9 unit (1 type-scope + 3 helper + 5 Islamic gate matrix) |
| After PS.4 | 200 | 86 | +14 unit (buildPersonalisationBlock 5-case matrix + biohub block exclusion matrix + gate cases) |
| **Net new** | **+31** | **+17** | — |

All new tests run via `pnpm --filter @natural-intelligence/db test`. Unit tests always run (5 PS.1 type-safety + 3 PS.2 / PS.3 / PS.4 helper unit + 5 PS.3 Islamic gate + 14 PS.4 prompt-builder = 27); integration tests skip without `NEXT_PUBLIC_SUPABASE_URL` env.

`apps/web` and `apps/care` have no test infrastructure — they're verified via type-check + lint + build + live SMOKE.

---

## 8. Integration suite final state

All checks against `9303da7` on `main`:

| Check | Result |
|---|---|
| `pnpm --filter @natural-intelligence/db type-check` | ✅ clean |
| `pnpm --filter @natural-intelligence/db test` | ✅ 200 passing · 86 skipped (286 total) |
| `pnpm --filter web type-check` | ✅ clean |
| `pnpm --filter web lint` | ✅ no errors (pre-existing img-alt info notice unrelated) |
| `pnpm --filter web build` | ✅ Compiled successfully |
| `pnpm --filter care type-check` | ✅ clean |
| `pnpm --filter care lint` | ✅ No ESLint warnings or errors |
| `pnpm --filter care build` | ✅ Compiled successfully |
| `bash scripts/check-personalisation-boundary.sh` | ✅ passes (validated negative case in PS.3 SMOKE-7) |

### Architectural greps confirmed during the phase

| Assertion | Mechanism | Verified in |
|---|---|---|
| `clinical_notes_on_sex` absent from `PersonalisationContext` shape | `@ts-expect-error` test + runtime `Object.keys` assertion + DOM grep against dashboard HTML (0 hits) | PS.1 SMOKE-8 + PS.3 SMOKE-6 |
| Religion value never appears in AI generation logs | Code inspection — only `islamic_framing_enabled: boolean` is passed to `JSON.stringify`; religion field is never in any log payload (structural guarantee) | PS.4 SMOKE-5 |
| Religion terms absent from public marketing HTML | Runtime check against `https://natural-intelligence.uk/` for 9 terms across 3 layers (DOM HTML, DOM text, raw HTTP) → 0 hits | PS.3 SMOKE-8 |
| `buildBiologicalContextBlock` cannot emit religious content | Vitest negative assertion across 3 worst-case input variants (including muslim + show + female) → 7 religion-related substrings all absent | PS.4 SMOKE-8 |

---

## 9. What is deliberately not built yet

The substrate enables content; it does not author it. Explicit deferrals:

### Islamic narrative copy

The framing instruction (`Where relevant and enriching, you may reference Islamic concepts of ihsan, amanah, or similar. Clinical recommendations remain governed by evidence. Framing is narrative only.`) exists in `buildPersonalisationBlock` and the gate boolean fires correctly for `religion='muslim' AND preference='show'`. But:
- No prompt example library of well-formed Islamic-framed responses exists yet
- No tone/style guide for Islamic framing has been authored
- No content review process is in place
- No Islamic-framed UI copy variants exist on the dashboard

A content phase — separate from any technical phase — is needed before Islamic framing becomes a meaningful experience rather than a model-improvised one. The substrate is ready; the content is not.

### Sex-specific clinical content beyond reference notes

The PS.3 worked example (`BiohubReferenceNote`) and the PS.4 prompt context (sex-pattern instruction in AI prompts) demonstrate the substrate works end-to-end. But:
- The pre-existing `menstrual_flow_heaviness` intake question is still shown to every intake-taker — gating it on `biological_sex = 'female'` is an intake-content change, not a substrate change
- Full reproductive-system interpretation in body story narration would benefit from sex-specific narrative templates
- Cycle-phase framing for female clients is not yet authored
- Sex-keyed BioHub reference ranges (the obvious clinical win) are not yet populated in the reference-range tables

These are intake-content and clinical-content phases. The substrate provides them what they need (sex value, sex-aware AI prompts); the content layer must do the actual authoring.

### Settings UI for editing personalisation

Data-layer editability exists from PS.1 — `religion` and `religious_content_preference` are updatable via the member SELECT/UPDATE RLS policies. `biological_sex` is locked post-intake by convention (the data layer allows update; we just don't surface an edit affordance). But:
- No user-facing settings page exists for editing any of these fields
- There is no "change framing preference" toggle anywhere in the dashboard
- The opt-in choice for `religious_content_preference` will, in practice, come from the intake form questions — not from a settings page

A small post-substrate UX phase will add a Settings page when needed. For v1, intake captures the answer once and it persists.

### Intake question UI

The `user_personalisation` row exists with defaults for every member from PS.1 onward. But the intake form questions that populate `biological_sex`, `religion`, and `religious_content_preference` have not been added. The proposal §4 specifies a dedicated `section0_demographics` section but that's an intake-content phase, not a substrate phase. Until those questions ship, every member's personalisation row stays at defaults (sex null, religion `'prefer_not_to_say'`, preference `'hide'`).

This means: as of PS.4 close, **every member sees secular framing and sex-neutral copy**. The substrate is wired and ready; the input pipeline that feeds it the real values is the next content phase.

---

## 10. Gate conditions for next phases

### Before Phase C (external practitioner invitation flow)

**Required:**
- [ ] **Q6 Option A migration landed and verified.** Practitioner-scoped RLS on `intake_responses`, `intake_answers`, `biomarker_results`, `biomarker_trajectory`, `lab_reports`. Admin-client exception removed from `getIntakeSummary` and `getBioHubSignals` once policies are in place. (Required since external practitioners change the risk profile beyond what internal admin-client exception tolerates.)
- [x] **Personalisation Substrate closure confirmed.** (This report.)

**Recommended:**
- [ ] **Intake content phase** (`section0_demographics`). Add `biological_sex`, `religion`, `religious_content_preference` questions to the intake form so that first-invited practitioners see real personalisation data, not just defaults. Gate the existing `menstrual_flow_*` questions on `biological_sex = 'female'` in the same phase.

The intake content phase can land in parallel with Phase C scoping; it doesn't block invitation flow design, but it does block the user-visible benefit of the substrate.

---

## 11. Standing rules reaffirmed

The substrate inherits and extends Phase B's discipline. Two specific rules worth restating because they were enforced architecturally in this phase rather than by convention:

- **Opt-in per surface, never inherited.** The Future-Sensitive Columns Rule means that adding a column to `user_personalisation` exposes it nowhere by default. Every surface — practitioner view, AI prompts, dashboard provider — must be explicitly wired. CI tests enforce this for the three columns currently in the table.
- **Boolean derivation in logs.** Sensitive values (religion specifically) never enter log payloads. The derived `islamic_framing_enabled` boolean is what logs receive. This is a structural guarantee: the code never passes the religion value into a `JSON.stringify` argument. Confirmed by code inspection in PS.4 SMOKE-5.

These extend the Phase B standing rules (RLS-is-the-truth-layer, surface-before-implement, F-finding closure at source, three-layer auth) without modification.

---

## 12. Roadmap forward

Directional, not committed.

1. **Next immediate — Q6 Option A migration.**
   Unblocks Phase C. One migration adding practitioner-scoped RLS to 5 tables (`intake_responses`, `intake_answers`, `biomarker_results`, `biomarker_trajectory`, `lab_reports`). Estimated: 1 day including verification sweep that removes the admin-client exception from `getIntakeSummary` and `getBioHubSignals`.

2. **Then — Intake content phase** (small, can run parallel to Phase C scoping).
   Adds `section0_demographics` to the intake flow: `biological_sex` (required radio), `religion` (optional dropdown, full 9-value enum), `religious_content_preference` (conditional opt-in for Muslim). Gates the existing `menstrual_flow_*` questions on `biological_sex = 'female'` — closes the gap noted in the proposal investigation where sex-specific questions show to everyone. Populates real personalisation values rather than relying on defaults.

3. **Then — Phase C — Invitation flow + external practitioner onboarding.**
   External practitioner invitation, vetting, activation, onboarding journey, admin tooling surfaces around the vetting queue.

4. **Then — Islamic content authoring** (separate content phase).
   Authors the actual narrative variants for body story, synopsis, and future protocol framing. Requires a content review process before deployment — the substrate gate fires correctly but the content it gates on doesn't exist yet.

5. **Then — Phase D — Protocol layer + CNM clinical synthesis.**
   Builds on the AI generation paths PS.4 wired. Receives biological_sex context (clinical) and framing context (narrative) through the same prompt builders established here.

6. **Then — Phase E (directory) and Phase F (CareTeam Builder)** as previously sketched.

---

*Personalisation Substrate closed. PS.1 schema + PS.2 practitioner UX + PS.3 dashboard gating + PS.4 AI generation all live and verified. 20 commits across 4 sub-phases plus design. 1 migration. 13 new helpers/modules. 31 new tests. Two architectural contracts in force. Awaiting explicit approval before Q6 Option A migration begins.*
