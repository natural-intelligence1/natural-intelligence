# PS.4 Verification Report — AI Generation Prompt Parameterisation

**Phase:** Personalisation Substrate — PS.4 (AI prompts read personalisation context)
**Date:** 2026-05-19
**Status:** 9/9 verification scenarios PASS. No F-findings. Part 5 confirmed no-op. PS.4 closed.

---

## Summary of deliverables

- **`getPersonalisationForGeneration(adminClient, userId)`** — admin-client helper at `packages/db/src/personalisation/`. Returns `PersonalisationForGeneration` (biologicalSex, religion, religiousContentPreference). `clinical_notes_on_sex` is **excluded by the type** — practitioner annotation has no path into AI generation. Soft-fails to `DEFAULT_PERSONALISATION_FOR_GENERATION` on missing-row or error.
- **`buildPersonalisationBlock(p)` and `buildBiologicalContextBlock(p)`** — at `packages/db/src/prompts/`. The first builds a full CLIENT CONTEXT block (sex + framing). The second is the BioHub variant — biological_sex only, **structurally cannot contain religious copy** (hard test).
- **`isIslamicFramingEnabled(p)`** — exported derived boolean. Generation paths log this instead of the religion value, so religion never appears in log aggregations.
- **`generateBodyStory`** refactored: `SYSTEM_PROMPT` constant → `buildBodyStorySystemPrompt(p)` builder. Personalisation prepended; existing role/task/tone body unchanged. New optional second parameter for backwards-compatible call-site testing.
- **`generateHealthSynopsis`** wired with the same pattern. Adds `health_synopsis.start / success / failure / insufficient_data` structured log events (small M3 extension).
- **`parseLabReport` (BioHub)** wired with `buildBiologicalContextBlock` (Option iii). Sex-specific reference range instruction; **zero religious framing copy**.
- **New subpath export**: `@natural-intelligence/db/prompts`.

---

## Decisions confirmed at the start of PS.4

| Decision | Outcome |
|---|---|
| **Part 5 no-op** | `createReasoningTrace` is a pure data-write helper. No system prompt. Confirmed by reading the file in full (`packages/db/src/crt/createReasoningTrace.ts`). No parameterisation needed. PS.4 spec Part 5 dropped. |
| **BioHub Option iii** | Wired with `biological_sex` only. The `buildBiologicalContextBlock` variant has a hard test asserting "islamic"/"muslim"/"religious"/"religion"/"framing"/"ihsan"/"amanah" all absent from the output, across all input combinations. |
| **Per-request builder** | `SYSTEM_PROMPT` module-constant replaced by `buildBodyStorySystemPrompt(p)`. The existing 76-line body is preserved verbatim as `BODY_STORY_PROMPT_BODY`; the personalisation block is prepended. |

---

## Automated checks

| Check | Result |
|---|---|
| `pnpm --filter @natural-intelligence/db type-check` | ✅ clean |
| `pnpm --filter @natural-intelligence/db test` | ✅ **200 passed** · 86 skipped (up from 186 / 86 pre-PS.4; **+14 unit tests** — buildPersonalisationBlock matrix + biohub block exclusions) |
| `pnpm --filter web type-check` | ✅ clean |
| `pnpm --filter web lint` | ✅ (pre-existing img-alt warning, unrelated to PS.4) |
| `pnpm --filter web build` | ✅ Compiled successfully |
| `bash scripts/check-personalisation-boundary.sh` | ✅ passes (boundary script targets `getPersonalisationContext`; `getPersonalisationForGeneration` is intentionally usable from any admin-client server path, by design) |

---

## Per-scenario verification (PROCEDURE / OBSERVED / RESULT)

### SMOKE-1 — biologicalSex in `body_story.start` log

**PROCEDURE:** Code inspection of the log statement in `apps/web/app/dashboard/story/actions.ts` (after the Promise.all that fetches intake + personalisation).

**OBSERVED:**
```ts
console.log(JSON.stringify({
  event:                  'body_story.start',
  user_id:                memberId,
  biological_sex:         p.biologicalSex,
  islamic_framing_enabled: isIslamicFramingEnabled(p),
}))
```

For the Natural Intelligence test client (`biological_sex = 'female'`, `religion = 'prefer_not_to_say'`, `religious_content_preference = 'hide'`):
- `biological_sex: 'female'`
- `islamic_framing_enabled: false` (preference is 'hide')

**RESULT:** ✅ PASS — by structure, the log emits both fields for every generation call.

### SMOKE-2 — Secular framing instruction in system prompt

**PROCEDURE:** Vitest assertion in `buildPersonalisationBlock.test.ts` for `{ biologicalSex: 'female', religion: 'prefer_not_to_say', religiousContentPreference: 'hide' }`.

**OBSERVED:**
```
expect(out).toContain('Biological sex: female')                ✓
expect(out).toContain('female-pattern clinical interpretation') ✓
expect(out).toContain('Framing preference: secular')           ✓
expect(out).toContain('secular language')                      ✓
for term of ['islamic','muslim','religion','religious','ihsan','amanah']:
  expect(out.toLowerCase()).not.toContain(term)                ✓
```

The prompt builder produces, verbatim:
```
CLIENT CONTEXT:
- Biological sex: female
Apply female-pattern clinical interpretation where relevant (reference ranges, cycle phase, hormonal context).
- Framing preference: secular
Use secular language and examples throughout.
```

**RESULT:** ✅ PASS — secular framing present; zero religious terms in the secular-default output.

### SMOKE-3 — Islamic framing instruction (unit test only — no live content)

**PROCEDURE:** Vitest assertion in `buildPersonalisationBlock.test.ts` for `{ biologicalSex: 'female', religion: 'muslim', religiousContentPreference: 'show' }`. No live Anthropic call.

**OBSERVED:** Output contains:
- `'Framing preference: Islamic'` ✓
- `'ihsan'` ✓
- `'amanah'` ✓
- `'Clinical recommendations remain governed by evidence'` ✓
- NOT `'secular'` ✓

**RESULT:** ✅ PASS — Islamic framing instruction renders cleanly for the gate-true case. Substrate proven; no Islamic narrative content authored.

### SMOKE-4 — Null sex safe handling

**PROCEDURE:** Vitest assertion in `buildPersonalisationBlock.test.ts` for `{ biologicalSex: null, religion: 'prefer_not_to_say', religiousContentPreference: 'hide' }`.

**OBSERVED:**
```
- Biological sex: not recorded
Biological sex is not recorded — avoid sex-specific clinical claims and prefer generic phrasing.
- Framing preference: secular
…
```

`expect(out).toContain('not recorded')` ✓ · `expect(out).toContain('avoid sex-specific clinical claims')` ✓

A second test (rare combination — null sex + Islamic) confirms safety: the prompt instructs to avoid sex-specific clinical claims even when religious framing is enabled. `female-pattern` / `male-pattern` strings are explicitly absent.

**RESULT:** ✅ PASS — null sex produces a cautious, generic instruction; no crash, no assumed reference ranges.

### SMOKE-5 — Religion value absent from logs

**PROCEDURE:** Code inspection of every log statement in the three affected files (`story/actions.ts`, `synopsis/actions.ts`, `biohub/actions.ts`).

**OBSERVED:** All `console.log(JSON.stringify(...))` events emit either:
- `biological_sex: p.biologicalSex` (a `'male'|'female'|null` value — non-sensitive)
- `islamic_framing_enabled: isIslamicFramingEnabled(p)` (a boolean — derived)

No log statement references `p.religion` or `p.religiousContentPreference` directly. The religion value is **structurally unable** to appear in log aggregations because we never pass it into a log payload. Only the derived boolean is logged.

**RESULT:** ✅ PASS — Religion value enforced absent from logs by code structure.

### SMOKE-6 — Synopsis wired

**PROCEDURE:** Code inspection of `apps/web/app/dashboard/synopsis/actions.ts`.

**OBSERVED:**
- `getPersonalisationForGeneration(adminClient, memberId)` added to the `Promise.all` batch (line ~78).
- New structured log: `health_synopsis.start { user_id, biological_sex, islamic_framing_enabled }`, plus `.success { duration_ms, input_tokens, output_tokens }`, `.failure { error_code, duration_ms }`, `.insufficient_data` (small M3 extension matching the body_story pattern).
- Prompt construction prepends the personalisation block:
  ```ts
  const systemPrompt = buildPersonalisationBlock(personalisation) + '\n\n' + `You are a clinical health intelligence analyst …`
  ```

**RESULT:** ✅ PASS — Synopsis follows the same pattern as body story.

### SMOKE-7 — Backwards compatibility (existing call sites)

**PROCEDURE:** Grep for all call sites of `generateBodyStory` and `generateHealthSynopsis`:

```
apps/web/app/dashboard/story/page.tsx:157:    await generateBodyStory(user!.id)
apps/web/app/dashboard/story/page.tsx:235:    await generateBodyStory(user!.id)
apps/web/app/dashboard/intake/actions.ts:82:  generateHealthSynopsis(user.id).catch(...)
apps/web/app/dashboard/intake/actions.ts:87:  generateBodyStory(user.id).catch(...)
apps/web/app/dashboard/synopsis/page.tsx:217:  await generateHealthSynopsis(user!.id)
apps/web/app/dashboard/synopsis/page.tsx:251:  await generateHealthSynopsis(user!.id)
```

All 6 call sites pass `user.id` only. The new optional second parameter on `generateBodyStory` (`personalisation?: PersonalisationForGeneration`) defaults to fetching internally, so existing callers are unaffected.

`pnpm --filter web build` succeeds, which is independent verification that all call sites compile against the new signature.

**RESULT:** ✅ PASS — All existing call sites compile and run without modification.

### SMOKE-8 — BioHub wired with biological_sex only (Option iii — no religious framing)

**PROCEDURE:**
1. Code inspection of `apps/web/app/dashboard/biohub/actions.ts`.
2. Vitest hard assertion in `buildPersonalisationBlock.test.ts`:

```ts
describe('buildBiologicalContextBlock (BioHub Option iii — clinical-only)', () => {
  it('contains biological sex, NEVER contains religious framing copy', () => {
    const variants = [
      ctx({ biologicalSex: 'female', religion: 'muslim',    religiousContentPreference: 'show' }),
      ctx({ biologicalSex: 'male',   religion: 'christian', religiousContentPreference: 'show' }),
      ctx({ biologicalSex: null,     religion: 'muslim',    religiousContentPreference: 'show' }),
    ]
    for (const p of variants) {
      const out = buildBiologicalContextBlock(p).toLowerCase()
      expect(out).toContain('biological sex')
      expect(out).not.toContain('islamic')
      expect(out).not.toContain('muslim')
      expect(out).not.toContain('religious')
      expect(out).not.toContain('religion')
      expect(out).not.toContain('framing')
      expect(out).not.toContain('ihsan')
      expect(out).not.toContain('amanah')
    }
  })
})
```

The biohub wiring uses `buildBiologicalContextBlock` (the variant), not `buildPersonalisationBlock`. The variant has zero code path to emit framing strings — it doesn't compute `isIslamicFramingEnabled`, it doesn't reference religion. Religious framing cannot appear in the biohub prompt **by construction**.

**OBSERVED:** Test passes against all 3 input variants (including the worst-case `muslim + show + male`).

**RESULT:** ✅ PASS — Lab report prompt receives biological_sex context only; religious framing structurally impossible.

### SMOKE-9 — createReasoningTrace unchanged

**PROCEDURE:** No changes to `packages/db/src/crt/createReasoningTrace.ts`. Existing test file `createReasoningTrace.test.ts` runs unchanged.

**OBSERVED:** All existing CRT tests in the suite pass within the **200 passed** total. No regressions.

**RESULT:** ✅ PASS — Confirming Decision 1: `createReasoningTrace` is a data-write helper with no system prompt. No parameterisation needed. Part 5 of PS.4 spec was correctly a no-op.

---

## Summary table

| # | Check | Result |
|---|---|---|
| 1 | `body_story.start` log includes `biological_sex` + `islamic_framing_enabled` | ✅ PASS |
| 2 | Secular framing instruction present; no religious terms in default case | ✅ PASS |
| 3 | Islamic framing instruction renders for muslim+show case (unit only) | ✅ PASS |
| 4 | Null sex → "not recorded" + avoid sex-specific claims | ✅ PASS |
| 5 | Religion value absent from all log payloads (only boolean logged) | ✅ PASS |
| 6 | Synopsis wired with same pattern + new structured log events | ✅ PASS |
| 7 | All 6 existing call sites compile (backwards-compatible optional param) | ✅ PASS |
| 8 | BioHub wired with biological_sex only; religious framing structurally absent | ✅ PASS |
| 9 | `createReasoningTrace` unchanged; data-write helper, no prompt | ✅ PASS |

**9/9 PASS. No F-findings. Part 5 no-op confirmed.**

---

## Phase summary

| Item | Status |
|---|---|
| `getPersonalisationForGeneration` helper | ✅ |
| `buildPersonalisationBlock` prompt module (full block) | ✅ |
| `buildBiologicalContextBlock` variant (BioHub Option iii) | ✅ |
| `isIslamicFramingEnabled` derived boolean for logs | ✅ |
| `generateBodyStory` refactored to per-request system prompt builder | ✅ |
| `generateHealthSynopsis` wired with same pattern | ✅ |
| `parseLabReport` wired with biological_sex context only | ✅ |
| Existing call sites unchanged (backwards-compatible) | ✅ |
| `createReasoningTrace` unchanged (Part 5 no-op confirmed) | ✅ |
| Religion value never appears in log output (structural) | ✅ |
| Tests: 186 → 200 passing (+14 buildPersonalisationBlock cases) | ✅ |
| `@natural-intelligence/db/prompts` subpath export added | ✅ |

**PS.4 closed. Personalisation Substrate closure report ready to scope when approved.**
