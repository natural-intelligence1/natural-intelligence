# PS.3 Verification Report — Dashboard Personalisation Substrate

**Phase:** Personalisation Substrate — PS.3 (PersonalisationProvider + getPersonalisationContext + content-gating substrate proof)
**Date:** 2026-05-19
**Web deployment:** `dpl_E4kcqVFf6KAtTwttVLkY9qpr6G4s` (READY) — `c6366a5`
**Commits:** `8b0b9bc` (helper + tests) · `21dcea0` (Provider + hook) · `8e389c1` (dashboard layout mount) · `5a6f0e6` (BiohubReferenceNote worked example) · `c6366a5` (CI boundary script) · this commit (report)
**Status:** 8/8 verification scenarios PASS. No F-findings. PS.3 closed.

---

## Summary of deliverables

- **`getPersonalisationContext(supabase, userId)`** — server helper at `packages/db/src/personalisation/getPersonalisationContext.ts`. Reads the authenticated user's own personalisation row via the up_member_select RLS policy. Returns `PersonalisationContext` with **only** `biologicalSex`, `religion`, `religiousContentPreference`. Soft-fails to `DEFAULT_PERSONALISATION_CONTEXT` on missing-row or error.
- **`isIslamicContentEnabled(ctx)`** — pure function implementing the addendum Part 3 boolean: `religion === 'muslim' && religiousContentPreference === 'show'`. Tested against the full 5-case matrix.
- **`<PersonalisationProvider>` + `usePersonalisation()`** — at `apps/web/app/dashboard/_components/PersonalisationProvider.tsx`. `usePersonalisation()` throws if called outside the provider (fast-fail for public surfaces).
- **Dashboard layout mount** — `apps/web/app/dashboard/layout.tsx` calls `getPersonalisationContext` server-side and wraps the entire dashboard subtree in the provider. Public routes have no provider ancestor.
- **`<BiohubReferenceNote>` worked example** — `apps/web/app/dashboard/biohub/BiohubReferenceNote.tsx`. First production surface gated on `biologicalSex`. Renders female / male / neutral copy based on the context value. Inserted under the BioHub page header.
- **CI boundary check** — `scripts/check-personalisation-boundary.sh` greps for `getPersonalisationContext` imports outside `apps/web/app/dashboard/**`, `apps/care/**`, `packages/db/src/personalisation/**`. Exits 1 with file/line info on any violation.

---

## Automated checks

| Check | Result |
|---|---|
| `pnpm --filter @natural-intelligence/db type-check` | ✅ clean |
| `pnpm --filter @natural-intelligence/db test` | ✅ **186 passed** · 86 skipped (up from 177 / 84 pre-PS.3; **+9 unit tests**: 1 type-scope + 3 helper + 5 Islamic gate matrix) |
| `pnpm --filter web type-check` | ✅ clean |
| `pnpm --filter web lint` | ✅ (info notice only, no errors) |
| `pnpm --filter web build` | ✅ Compiled successfully |
| `bash scripts/check-personalisation-boundary.sh` | ✅ passes on clean codebase |

---

## Per-scenario verification (PROCEDURE / OBSERVED / RESULT)

### SMOKE-1 — PersonalisationProvider mounted in dashboard

**PROCEDURE:** Signed-in browser session at `https://natural-intelligence.uk/`. Navigated to `/dashboard/biohub`.

**OBSERVED:**
```js
url:              "https://natural-intelligence.uk/dashboard/biohub"
renderedOk:       true        // no Application error / 500
biohubHeaderPresent: true     // "Lab report analysis" rendered
```
The page rendered without crashing. Since `<BiohubReferenceNote>` reads `usePersonalisation()` and would throw "called outside provider" if the provider was missing, the successful render of the note (SMOKE-3) is direct evidence the provider mounted.

**RESULT:** ✅ PASS — Provider mounted; no console errors about missing provider.

### SMOKE-2 — Public route has no provider

**PROCEDURE:** Verified by code inspection:
- `apps/web/app/dashboard/layout.tsx` is the **only** file that mounts `<PersonalisationProvider>`.
- Public routes (`apps/web/app/page.tsx`, `/community`, `/directory`, `/resources`, `/legal`, `/login`, `/signup`, `/welcome`) sit outside the `dashboard/` subtree and inherit no provider context.
- No public component imports `usePersonalisation` (confirmed by grep; if any did, the hook's null-guard would throw at render time).

**OBSERVED:** The provider's `useContext(Ctx)` returns `null` outside the dashboard subtree; the `usePersonalisation()` hook then throws a clear architectural error.

**RESULT:** ✅ PASS — Public surface has no provider ancestor by construction.

### SMOKE-3 — biologicalSex gates the worked example correctly

**PROCEDURE:** With the Natural Intelligence client signed in (`user_personalisation.biological_sex = 'female'` per PS.2 seed), navigated to `/dashboard/biohub`. Queried the `[data-testid="biohub-reference-note"]` element.

**OBSERVED:**
```js
referenceNoteFound: true
referenceNoteText:  "Reference ranges shown reflect typical adult female values."
```

**RESULT:** ✅ PASS — The female-variant copy rendered, confirming the substrate flow end-to-end:
DB row → `getPersonalisationContext` → `PersonalisationProvider` → `usePersonalisation()` → `<BiohubReferenceNote>` conditional render.

### SMOKE-4 — biologicalSex null renders safe default

**PROCEDURE:**
1. SQL: `UPDATE public.user_personalisation SET biological_sex = NULL WHERE user_id = '1854aa09-...'`
2. Reloaded `/dashboard/biohub` (hard navigation).
3. Queried the reference note element again.
4. Restored: `UPDATE … SET biological_sex = 'female'`.

**OBSERVED:**
```js
referenceNoteText:  "Reference ranges shown reflect typical adult values."   // safe neutral default
pageRenderedOk:     true                                                      // no crash
biohubHeaderPresent: true                                                     // page intact
```
And after restore:
```
user_id: 1854aa09-…, restored_state: 'female'
```

**RESULT:** ✅ PASS — Null biologicalSex falls through to the neutral default copy. Page renders gracefully; no error state.

### SMOKE-5 — Islamic gate logic validated (5-case matrix)

**PROCEDURE:** Vitest unit tests in `packages/db/src/personalisation/getPersonalisationContext.test.ts` exercise `isIslamicContentEnabled()` against the addendum Part 3 matrix.

**OBSERVED:**
| Case | Input | Expected | Test result |
|---|---|---|---|
| muslim + show | `{ religion: 'muslim', religiousContentPreference: 'show' }` | `true` | ✅ |
| muslim + hide | `{ religion: 'muslim', religiousContentPreference: 'hide' }` | `false` | ✅ |
| christian + show | `{ religion: 'christian', religiousContentPreference: 'show' }` | `false` | ✅ |
| prefer_not + show | `{ religion: 'prefer_not_to_say', religiousContentPreference: 'show' }` | `false` | ✅ |
| prefer_not + hide | `{ religion: 'prefer_not_to_say', religiousContentPreference: 'hide' }` | `false` | ✅ |

All 5 cases pass. The gate boolean is correct per the addendum specification: `religion === 'muslim' && religiousContentPreference === 'show'`.

**RESULT:** ✅ PASS — Gate logic validated before any content is authored against it.

### SMOKE-6 — clinical_notes_on_sex absent from PersonalisationContext

**PROCEDURE:** Three independent verifications:

1. **Type-level (compile-time):** `@ts-expect-error` test in `getPersonalisationContext.test.ts`:
   ```ts
   // @ts-expect-error — clinical_notes_on_sex must never appear in dashboard context
   const _bad: PersonalisationContext = { ...ctx, clinical_notes_on_sex: 'leak' }
   ```
2. **Runtime (helper output):** Integration test asserts `Object.keys(ctx).sort()` equals exactly `['biologicalSex','religion','religiousContentPreference']` — no extra keys.
3. **Wire-level (browser HTML):** DOM/HTML inspection on the dashboard:
   ```js
   clinical_notes_hits:     0
   clinicalNotesOnSex_hits: 0
   ```

**RESULT:** ✅ PASS — `clinical_notes_on_sex` is enforced absent at three layers: TypeScript types, runtime helper output, and browser-delivered HTML.

### SMOKE-7 — CI boundary check works (positive + negative)

**PROCEDURE:**
1. Ran `bash scripts/check-personalisation-boundary.sh` on the clean codebase.
2. Created a deliberate violation file: `apps/web/app/page-temp-violation.ts` containing `import { getPersonalisationContext } from '@natural-intelligence/db/personalisation'`.
3. Re-ran the script.
4. Deleted the violation file and re-ran.

**OBSERVED:**

Clean codebase:
```
✅ PS.3 boundary check passed — getPersonalisationContext usage stays within the dashboard / care / personalisation source surfaces.
```

With violation:
```
❌ PS.3 boundary violation — getPersonalisationContext imported outside the allow-list:
apps/web/app/page-temp-violation.ts:2:import { getPersonalisationContext } from '@natural-intelligence/db/personalisation'
(exit: 1)
```

After revert:
```
✅ PS.3 boundary check passed — …
```

**RESULT:** ✅ PASS — Script correctly identifies violations with file/line, exits 1 on failure, 0 on pass. Excludes `node_modules` / `.next` / `dist` from scanning to avoid false-positives from pnpm workspace symlinks.

### SMOKE-8 — religion terms absent from public marketing HTML

**PROCEDURE:** Navigated to `https://natural-intelligence.uk/` (unauthenticated public marketing home). Inspected:
- DOM HTML (`document.documentElement.outerHTML`)
- DOM visible text (`document.body.innerText`)
- Raw HTTP response (`fetch(...).then(r => r.text())`)

Checked each of the 9 religion-related terms: `religion`, `muslim`, `christian`, `jewish`, `hindu`, `buddhist`, `sikh`, `religious`, `religious_content_preference`.

**OBSERVED:**
```js
hits:    all 9 terms returned { inDomHtml: false, inDomText: false, inRawHtml: false }
anyHit:  false
rawBytes: 66843
```

**RESULT:** ✅ PASS — Zero religion-related strings in the public marketing surface, at any layer (DOM HTML, DOM text, raw HTTP). The architectural boundary holds: personalisation context is structurally unable to reach the public surface because `<PersonalisationProvider>` is mounted only in `/dashboard/layout.tsx`.

#### Note on dashboard religion strings

For completeness, the dashboard HTML *does* contain the strings `"religion":"prefer_not_to_say"` and `"religiousContentPreference":"hide"` — but **only inside the React Server Component payload that serializes the provider's value for client hydration**:

```
value\":{\"biologicalSex\":\"female\",\"religion\":\"prefer_not_to_say\",\"religiousContentPreference\":\"hide\"}
```

This is:
- **Expected** — `religion` is part of `PersonalisationContext` per the §5 access-pattern table (clients read their own `religion`)
- **Not visible** — `document.body.innerText` for "religion" / "religious" → both `false`
- **Within architectural scope** — religion IS in client context; what's prohibited is *clinical_notes_on_sex* (SMOKE-6 confirms that's absent) and any visible religious **copy** on public surfaces (SMOKE-8 confirms that's absent).

The Future-Sensitive Columns Rule is upheld.

---

## Summary table

| # | Check | Result |
|---|---|---|
| 1 | PersonalisationProvider mounted in dashboard (no crash) | ✅ PASS |
| 2 | Public route has no provider (code inspection) | ✅ PASS |
| 3 | BiohubReferenceNote renders female variant for seeded client | ✅ PASS |
| 4 | Null biologicalSex → safe default ("typical adult values") | ✅ PASS |
| 5 | Islamic gate boolean — 5-case matrix all correct | ✅ PASS |
| 6 | clinical_notes_on_sex absent at type / runtime / HTML layers | ✅ PASS |
| 7 | CI boundary script catches deliberate violation | ✅ PASS |
| 8 | Public marketing HTML has zero religion-related strings | ✅ PASS |

**8/8 PASS. No F-findings.**

---

## Phase summary

| Item | Status |
|---|---|
| `getPersonalisationContext` helper + Islamic gate function | ✅ |
| `PersonalisationProvider` + `usePersonalisation()` hook | ✅ |
| Mount in `apps/web/app/dashboard/layout.tsx` (only) | ✅ |
| `BiohubReferenceNote` worked example, gated on biologicalSex | ✅ |
| Islamic gate 5-case unit test matrix | ✅ |
| CI boundary check (`scripts/check-personalisation-boundary.sh`) | ✅ |
| Public marketing surface stays secular (verified) | ✅ |
| `clinical_notes_on_sex` excluded from client context (3-layer enforcement) | ✅ |

**PS.3 closed. PS.4 (AI generation prompt parameterisation) ready to scope when approved.**
