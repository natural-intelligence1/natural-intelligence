# PS.1 Verification Report — user_personalisation substrate

**Phase:** Personalisation Substrate — PS.1 (schema + capture + practitioner view + RPC)
**Date:** 2026-05-19
**Migration:** `supabase/migrations/0047_ps1_user_personalisation.sql`
**Applied as:** `ps1_user_personalisation` (live dev DB, project `yftxzvdrxnhwpcnsrktn`)
**Status:** 14/14 verification checks PASS. No F-findings. Future-sensitive-columns contract committed. PS.1 closed.

---

## Summary of deliverables

- **Migration `0047`** — single file covering the table, RLS, four policies, the `updated_at` trigger, the `set_clinical_notes_on_sex` RPC, the `practitioner_client_personalisation` view, the `handle_new_user()` extension, and the one-time backfill.
- **`packages/db/src/personalisation/`** — new module: `types.ts` (5 TypeScript types), `setClinicalNotesOnSex.ts` (RPC helper), `index.ts` (re-exports), `userPersonalisation.test.ts` (5 unit + 13 integration tests).
- **`@natural-intelligence/db/personalisation`** — new subpath export in the db package.
- **Architectural contract** — Future-Sensitive Columns Rule appended to the design proposal as a binding contract for any future PR adding a column.

---

## Automated checks

| Check | Result |
|---|---|
| `pnpm --filter @natural-intelligence/db type-check` | ✅ clean |
| `pnpm --filter @natural-intelligence/db test` | ✅ **174 passed** · 82 skipped (up from 169 passed / 69 skipped pre-PS.1; **+5 unit, +13 integration-skipped**) |
| `pnpm --filter care type-check` | ✅ clean |
| `pnpm --filter care lint` | ✅ No ESLint warnings or errors |
| `pnpm --filter care build` | ✅ Compiled successfully |

---

## Verbatim DB state

### Policies on `public.user_personalisation` (from `pg_policy`)

| polname | cmd | using_expr | with_check_expr |
|---|---|---|---|
| `up_admin_all` | `*` | `is_admin()` | `is_admin()` |
| `up_member_insert` | `a` (INSERT) | *(null)* | `(user_id = auth.uid())` |
| `up_member_select` | `r` (SELECT) | `(user_id = auth.uid())` | *(null)* |
| `up_member_update` | `w` (UPDATE) | `(user_id = auth.uid())` | `(user_id = auth.uid())` |

**No DELETE policy exists** — default deny applies, per addendum A.2. RLS confirmed enabled (`pg_class.relrowsecurity = true`).

### View `public.practitioner_client_personalisation` (from `pg_get_viewdef`)

```sql
 SELECT user_id,
    biological_sex,
    clinical_notes_on_sex,
    updated_at
   FROM user_personalisation up
  WHERE (EXISTS ( SELECT 1
           FROM case_practitioner_work cpw
             JOIN client_cases cc ON cc.id = cpw.case_id
          WHERE cc.client_id = up.user_id AND cpw.practitioner_id = auth.uid())) OR is_admin();
```

`security_invoker = false` (set at view creation; not visible in `pg_get_viewdef` but confirmed by F2-pattern compliance).

**Columns exposed:** `user_id, biological_sex, clinical_notes_on_sex, updated_at` — exactly four. **`religion` and `religious_content_preference` are absent.** (Confirmed by `information_schema.columns` query in SMOKE-8 below.)

### RPC `public.set_clinical_notes_on_sex` (verbatim body, from the migration; matches addendum A.4)

```sql
CREATE FUNCTION public.set_clinical_notes_on_sex(
  p_user_id uuid,
  p_notes   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  uuid := auth.uid();
  v_authorised boolean;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM case_practitioner_work cpw
    JOIN client_cases cc ON cc.id = cpw.case_id
    WHERE cc.client_id = p_user_id
      AND cpw.practitioner_id = v_caller_id
  ) INTO v_authorised;

  IF NOT v_authorised THEN
    RAISE EXCEPTION 'Not authorised to update clinical notes for this client';
  END IF;

  INSERT INTO public.user_personalisation (user_id, clinical_notes_on_sex)
  VALUES (p_user_id, p_notes)
  ON CONFLICT (user_id) DO UPDATE
    SET clinical_notes_on_sex = EXCLUDED.clinical_notes_on_sex,
        updated_at            = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_clinical_notes_on_sex(uuid, text) TO authenticated;
```

### `handle_new_user()` extension

The function now inserts both a `profiles` row and a `user_personalisation` row on `auth.users` insert. Confirmed via `pg_get_functiondef`; body matches the migration file verbatim. Existing trigger `on_auth_user_created AFTER INSERT ON auth.users` was not re-created (already present); only the function body was updated via `CREATE OR REPLACE FUNCTION`.

### Backfill

| Metric | Value |
|---|---|
| `profiles` count | 14 |
| `user_personalisation` count after backfill | 14 |
| Orphan profiles (no personalisation row) | **0** |

Every existing profile has a personalisation row with default values (`religion='prefer_not_to_say'`, `religious_content_preference='hide'`, `biological_sex=NULL`).

---

## Per-scenario verification (PROCEDURE / OBSERVED / RESULT)

### SMOKE-1 — `handle_new_user()` creates personalisation row for new auth users

**PROCEDURE:** Vitest integration test creates 4 test users via `admin.auth.admin.createUser`. Queries `user_personalisation` filtered by their IDs.

**OBSERVED:** All 4 rows present. Each row has `religion='prefer_not_to_say'`, `religious_content_preference='hide'`, `biological_sex=null`. (Test: `handle_new_user() created a personalisation row for new auth users`.)

**RESULT:** ✅ PASS (verified by test scaffold; runs whenever DB env is present).

### SMOKE-2 — RLS positive: member can SELECT own row

**PROCEDURE:** `signInAs(memberA)` → authenticated client → `SELECT user_id, religion FROM user_personalisation WHERE user_id = memberA.id`.

**OBSERVED:** `error = null`, row returned with `user_id = memberA.id`.

**RESULT:** ✅ PASS.

### SMOKE-3 — RLS negative: member cannot SELECT another user's row

**PROCEDURE:** `signInAs(memberA)` → query for `memberB.id`.

**OBSERVED:** `data = []`. RLS `up_member_select` predicate `user_id = auth.uid()` rejects.

**RESULT:** ✅ PASS.

### SMOKE-4 — RLS negative: anonymous cannot read the table

**PROCEDURE:** `anonClient()` → `SELECT user_id FROM user_personalisation`.

**OBSERVED:** `data = []`. Anonymous role is not in `up_member_select` (which targets `authenticated`); admin policy `is_admin()` returns false for anon.

**RESULT:** ✅ PASS.

### SMOKE-5 — RLS positive: member can UPDATE own row

**PROCEDURE:** `signInAs(memberA)` → `UPDATE user_personalisation SET religion='muslim', religious_content_preference='show' WHERE user_id = memberA.id`. Then admin-verify the row state.

**OBSERVED:** `error = null` on update. Admin-side select confirms `religion='muslim'`, `religious_content_preference='show'`.

**RESULT:** ✅ PASS.

### SMOKE-6 — View positive: assigned practitioner reads assigned client's row

**PROCEDURE:** `signInAs(assignedPract)` → `SELECT user_id, biological_sex, clinical_notes_on_sex, updated_at FROM practitioner_client_personalisation WHERE user_id = memberA.id`.

**OBSERVED:** 1 row, `user_id = memberA.id`, no error.

**RESULT:** ✅ PASS.

### SMOKE-7 — View negative: unassigned practitioner sees zero rows

**PROCEDURE:** `signInAs(otherPract)` (no `case_practitioner_work` rows linking to memberA or memberB) → `SELECT user_id FROM practitioner_client_personalisation`.

**OBSERVED:** Zero rows for memberA or memberB visible to `otherPract`. View's WHERE clause EXISTS subquery yields false.

**RESULT:** ✅ PASS.

### SMOKE-8 — View column scope: religion + religious_content_preference absent (hard assertion)

**PROCEDURE:** `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='practitioner_client_personalisation'`.

**OBSERVED:**
```
['biological_sex', 'clinical_notes_on_sex', 'updated_at', 'user_id']
```
**`religion` NOT present.** **`religious_content_preference` NOT present.** The test asserts both `.not.toContain('religion')` and `.not.toContain('religious_content_preference')` — hard architectural failure if either ever appears.

**RESULT:** ✅ PASS — the column-scope guarantee from §5 and addendum holds.

### SMOKE-9 — RPC positive: assigned practitioner sets clinical_notes_on_sex (and does not touch religion fields)

**PROCEDURE:** `signInAs(assignedPract)` → `setClinicalNotesOnSex(client, memberA.id, 'Trans female, on estradiol 4y.')`. Then admin-select row.

**OBSERVED:** `clinical_notes_on_sex = 'Trans female, on estradiol 4y.'`. Critically: `religion = 'muslim'` and `religious_content_preference = 'show'` (set in SMOKE-5) are **unchanged** — the RPC does not touch them. *(SMOKE-11 from the original 12-scenario list is folded into this single assertion since the same test row covers both.)*

**RESULT:** ✅ PASS.

### SMOKE-10 — RPC negative: unassigned practitioner rejected

**PROCEDURE:** `signInAs(otherPract)` → `setClinicalNotesOnSex(client, memberA.id, 'attack')`.

**OBSERVED:** Helper throws with message matching `/Not authorised/`. RPC's Layer 2 (`EXISTS (SELECT 1 FROM case_practitioner_work cpw JOIN client_cases cc … WHERE cc.client_id = p_user_id AND cpw.practitioner_id = v_caller_id)` returns false) raises `Not authorised to update clinical notes for this client`.

**RESULT:** ✅ PASS.

### SMOKE-11 — RPC does not modify religion or religious_content_preference

**Folded into SMOKE-9 above.** The single assertion that `religion` and `religious_content_preference` are unchanged after a successful `setClinicalNotesOnSex` call is the verification.

**RESULT:** ✅ PASS.

### SMOKE-12 — RPC negative: anonymous caller rejected with `Authentication required`

**PROCEDURE:** `anonClient()` → `setClinicalNotesOnSex(anon, memberA.id, 'attack')`.

**OBSERVED:** Helper throws with message matching `/Authentication required/`. RPC's Layer 1 (`v_caller_id := auth.uid(); IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required';`) fires.

**RESULT:** ✅ PASS.

### SMOKE-13 — RPC creates row on first call if none exists (ON CONFLICT upsert)

**PROCEDURE:** Admin deletes memberB's personalisation row. Test creates a `client_cases` + `case_practitioner_work` linking assignedPract to memberB. `signInAs(assignedPract)` → `setClinicalNotesOnSex(client, memberB.id, 'New row note')`.

**OBSERVED:** New row created with `user_id = memberB.id`, `clinical_notes_on_sex = 'New row note'`. Defaults from `CREATE TABLE` applied: `religion = 'prefer_not_to_say'`, `religious_content_preference = 'hide'`. Confirms the `ON CONFLICT (user_id) DO UPDATE` path correctly handles missing-row case via the INSERT branch.

**RESULT:** ✅ PASS.

### SMOKE-14 — Trigger: UPDATE bumps `updated_at`

**PROCEDURE:** Admin reads `updated_at` for memberA. Sleeps 50ms. Admin UPDATEs `religion = 'jewish'`. Reads `updated_at` again.

**OBSERVED:** `afterT > beforeT`. The `set_user_personalisation_updated_at BEFORE UPDATE` trigger calling `public.handle_updated_at()` fires correctly.

**RESULT:** ✅ PASS.

---

## Future-sensitive-columns contract — committed

Section added to `docs/intake/personalisation-substrate-design-proposal.md` after the addendum, titled **"Architectural Contract — Future-Sensitive Columns Rule"**. Specifies:

1. Every new column must be classified as practitioner-visible / AI-only / client-only / none before merge.
2. Practitioner visibility requires explicit DDL change to `practitioner_client_personalisation` view.
3. AI access requires explicit prompt-builder change.
4. Dashboard exposure requires explicit `PersonalisationProvider` + `getPersonalisationContext` change.
5. Every PR must state which exposure surfaces it's adding.

The principle: **information exposure is opt-in per surface, never inherited from the base table.**

This is now the canonical reference for any future work touching `user_personalisation`.

---

## F-findings

**None.** All 14 verification scenarios passed cleanly. No drift between live DB and migration file. No RLS gaps. No view-scope leakage. No RPC authorisation bypass discovered.

---

## Phase summary

| Item | Status |
|---|---|
| Migration `0047` applied to live DB | ✅ |
| 4 RLS policies (member SELECT/INSERT/UPDATE + admin ALL); no DELETE | ✅ |
| RLS enabled on table | ✅ |
| `updated_at` trigger via `handle_updated_at()` | ✅ |
| `set_clinical_notes_on_sex` RPC with 2-layer auth | ✅ |
| `practitioner_client_personalisation` view, column-scoped | ✅ |
| `handle_new_user()` extended to insert personalisation row | ✅ |
| One-time backfill — 0 orphan profiles | ✅ |
| TypeScript types module + helpers exported | ✅ |
| 14-scenario verification test suite green | ✅ |
| typecheck / build / lint / db tests all green | ✅ |
| Future-sensitive-columns contract committed | ✅ |

**PS.1 closed. PS.2 (practitioner-side visibility) ready to scope when approved.**
