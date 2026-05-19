# Personalisation Substrate — Design Proposal

**Phase:** Personalisation Substrate (a bounded phase between Phase B closure and Phase C onboarding)
**Status:** Design proposal — no code, no schema changes
**Date:** 2026-05-19
**Author:** drafted by Claude, awaiting review and addendum cycle

---

## 1. Investigation summary

### Current intake schema state

Three tables hold intake data today (verified against live dev DB, project `yftxzvdrxnhwpcnsrktn`):

**`intake_responses`** — typed summary row per member (53 columns). Holds structured clinical facts: `primary_concerns`, `concern_duration`, `symptom_pattern`, `sleep_hours`, `stress_level`, `diet_description`, `health_goals`, `arrival_emotion`, `primary_system`, `psychosocial_impact`, etc. No demographic columns.

**`intake_answers`** — generic question→answer log. Schema: `(id, session_id, member_id, question_id, section_id, answer jsonb, answered_at, clinical_objective, mapped_systems, mapped_hypotheses)`. Append-only by convention; one row per question answered.

**`intake_sessions`** — session-level state: `current_section`, `visible_question_ids`, `answered_question_ids`, `completion_percentage`, `red_flag_count`.

**`profiles`** — identity-only after the F2 corrective phase. Columns: `id`, `role`, `full_name`, `avatar_url`, `bio`, `is_test_data`, `onboarding_intent`, `heard_about`, `onboarding_completed_at`. Explicitly does **not** carry sensitive client attributes; the F2 view (`practitioner_client_identity`) exposes only `(id, full_name, avatar_url, role)` and any new sensitive field must go elsewhere by precedent.

### Where biological sex / gender currently live

**Nowhere formally.** Verified by schema scan and code grep — no `biological_sex`, `sex`, or `gender` column exists in any table.

This is significant because sex-specific intake content already exists in the platform. The Sprint 16.3 Tier 1 branching rules (`packages/db/src/intake/branchingRules.parity.test.ts`) include a `menstrual_flow_heaviness` question with a `flag_menstrual_flow_high` branching rule. That question is currently shown to every intake-taker regardless of sex — the platform has no way to gate it. Practitioners reviewing male clients see a null answer for menstrual flow and have to infer that the question simply didn't apply.

Adding `biological_sex` solves a real gap that already exists in the product.

### Where religion currently lives

**Nowhere.** No `religion`, `faith`, `religious_*`, or `content_preference` column exists. No code path consumes any religious context. The platform currently treats every user as religiously neutral.

### Existing content-rendering surfaces that might need gating

Surveyed `apps/web/app/dashboard/*` and `apps/care/app/*`. Surfaces that today render copy or AI-generated narrative that could vary by personalisation:

| Surface | Path | Current behaviour | Gating relevance |
|---|---|---|---|
| Body Story | `apps/web/app/dashboard/story/` | AI-generated narrative explaining the user's intake in narrative form | High — narrative tone, examples, reproductive-system framing |
| Synopsis | `apps/web/app/dashboard/synopsis/` | AI-summarised intake | Medium — tone, examples |
| BioHub | `apps/web/app/dashboard/biohub/` | Lab uploads, biomarker trajectory | High — reference ranges by sex; framing minor |
| DailyPath | `apps/web/app/dashboard/dailypath/` | Placeholder; protocol surface | Medium — when Phase D lands |
| Intake | `apps/web/app/dashboard/intake/` | Branching questionnaire | High — `biological_sex` can drive question visibility (e.g., the menstrual_flow gap above) |
| Care workspace | `apps/care/app/cases/[caseId]/work/[workId]/` | Practitioner-side review | Practitioner needs to see biological_sex; religion is a policy choice |

### AI generation paths and their current context

**`generateBodyStory`** (`apps/web/app/dashboard/story/actions.ts`) — reads intake_answers + intake_responses + `profiles.full_name`, builds a flat prompt, calls `claude-sonnet-4-6`. **No demographic context consumed.** The system prompt (line 184+) frames the model as a clinical narrator but doesn't know the client's sex or any religious context. Output is generic.

**Reasoning trace generation** (`packages/db/src/crt/createReasoningTrace.ts`) — similar pattern. Consumes intake context for clinical reasoning; no demographic awareness.

Other AI paths (future Phase D protocol generation) inherit the same default: no demographic context, no framing parameter.

This means **every AI generation path needs to be extended** as part of the Personalisation Substrate, not just the body story.

---

## 2. Field decisions

### `biological_sex`

| | |
|---|---|
| Type | `text` with CHECK constraint |
| Enum | `'male'` \| `'female'` |
| Required at intake | **Required** (early in flow so it can drive branching) |
| Default if skipped | None — cannot be skipped in the form |
| Editability | **Locked after intake completion.** Editable via practitioner-recorded `clinical_notes_on_sex` (see edge-case handling). Re-editable client-side only by support escalation. |
| Storage | `user_personalisation.biological_sex` (see §3) |

**Edge-case handling — recommendation: Option (b).**

Strict binary in the form, plus an optional **practitioner-side** field `user_personalisation.clinical_notes_on_sex` (free text) that practitioners populate when a case requires it (intersex conditions, trans patient on hormone therapy with non-trivial clinical implications, etc.).

**Rationale:**
- Option (a) — strict binary with no edge-case handling — collapses clinical reality. A trans woman on long-term estrogen has metabolic and biomarker patterns that differ meaningfully from both cis male and cis female reference defaults. Forcing the user to pick "male" or "female" without any clinical capture for the difference makes the platform clinically wrong for those users.
- Option (b) keeps the user-facing form simple for the 99% case (binary radio, one click) while giving practitioners a place to record the nuance when it matters. The free-text field is practitioner-write, client-read, never surfaced in public copy.
- This pattern mirrors how an experienced clinician handles intake forms: tick the box, then write a note in the chart. The "note in the chart" is the `clinical_notes_on_sex` field.

The practitioner UI for this field is out of PS.1 scope and lands in PS.2.

### `religion`

| | |
|---|---|
| Type | `text` with CHECK constraint |
| Enum (v1) | `'muslim'` \| `'christian'` \| `'jewish'` \| `'hindu'` \| `'buddhist'` \| `'sikh'` \| `'secular'` \| `'prefer_not_to_say'` \| `'other'` |
| Required at intake | **Optional**; skipping defaults to `'prefer_not_to_say'` |
| Default if skipped | `'prefer_not_to_say'` |
| Editability | Editable any time (settings UI deferred; database-level editability supported from PS.1) |
| Storage | `user_personalisation.religion` |

**Recommendation: full enum from day one, even though only `'muslim'` has framed content available in v1.**

Reasoning:
- A narrow v1 enum (`'muslim' \| 'prefer_not_to_say' \| 'other'`) would communicate a value judgement — "this platform only cares about Muslim users" — that would harm trust with non-Muslim users during intake.
- The cost of the full enum is one CHECK constraint with 9 values. Negligible.
- Future content authoring (Christian framing, Jewish framing, etc.) is then a content-only change, not a schema migration.
- Analytics over time benefit from a stable enum (`SELECT religion, COUNT(*) FROM user_personalisation GROUP BY religion`) rather than free-text variance.

Why not free-text: free-text variance ("Sunni", "Sunni Muslim", "muslim", "Islamic", "Islam") makes content gating impossible without an authoritative mapping layer that's effectively a reimplementation of the enum.

### `religious_content_preference`

| | |
|---|---|
| Type | `text` with CHECK constraint |
| Enum | `'show'` \| `'hide'` |
| Required at intake | **Conditionally shown**: only rendered when `religion` selected has framed content available (in v1: only when `religion = 'muslim'`). If shown, an explicit choice is required. If religion is anything else, the field is set silently to `'hide'`. |
| Default | `'hide'` whenever the field isn't explicitly answered |
| Editability | Editable any time |
| Storage | `user_personalisation.religious_content_preference` |

**Default — recommendation: `'hide'` by default; explicit opt-in required.**

Reasoning:
- Auto-enabling religious framing on the basis of stated religion is presumptuous. A Muslim user may want secular framing for their health journey (separation of clinical and religious thinking, partner-shared screen, professional context). Auto-on assumes religion = preference, which is wrong.
- Opt-in surfaces the choice as a choice. The user sees: *"Would you like clinical interpretation framed with reflections drawn from Islamic tradition, where applicable?"* with `Yes, show this framing` / `No, keep it secular`. The act of choosing models the agency the platform claims to support.
- Hide-by-default fails safe: if the gate logic ever has a bug, the worst case is secular framing for a user who wanted religious framing (a recoverable disappointment), not religious framing surfaced unexpectedly (a trust break, possibly to a user who shared their screen).

---

## 3. Storage location

**Recommendation: Option B — a dedicated `user_personalisation` table.**

```sql
CREATE TABLE public.user_personalisation (
  user_id                       uuid        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  biological_sex                text        CHECK (biological_sex IN ('male','female')),
  religion                      text        NOT NULL DEFAULT 'prefer_not_to_say'
                                            CHECK (religion IN (
                                              'muslim','christian','jewish','hindu','buddhist','sikh',
                                              'secular','prefer_not_to_say','other'
                                            )),
  religious_content_preference  text        NOT NULL DEFAULT 'hide'
                                            CHECK (religious_content_preference IN ('show','hide')),
  clinical_notes_on_sex         text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);
```

### Why not Option A (intake_answers)

`intake_answers` is append-only-by-convention with one row per question event. Treating personalisation as ordinary questions means:
- Editability requires *appending* a new answer row and reading "latest by `answered_at`" everywhere — every read site needs that pattern.
- Re-editing in settings would write a new "intake answer" outside any intake session, which violates the table's semantic contract (it's the per-session answer log).
- The `clinical_notes_on_sex` field is practitioner-written, not client-written, and doesn't belong in `intake_answers` at all.

### Why not adding to `profiles`

F2 established `profiles` as identity-only and rejected full-row practitioner access. Adding `biological_sex`, `religion`, or `religious_content_preference` here would either:
- Re-open the F2 decision (broader practitioner SELECT on profiles), or
- Require yet another column-scoped view to surface specific subsets, which scales poorly as personalisation grows.

### Why a dedicated table

- **Explicit RLS surface.** One small table, one policy set: client reads/writes own row; practitioner reads scoped subset; admin reads all. Mirrors the F2 view pattern but uses a table because the data has its own lifecycle (writes from intake, writes from practitioners, future writes from settings).
- **Editability semantics are clean.** Update a column, set `updated_at`. No "append + select latest" gymnastics.
- **Future fields land cleanly.** Timezone preference, content density preference, language preference, daypart preference — all future personalisation extensions fit this table without further schema gymnastics.
- **Clear architectural boundary** between *what the client is* (personalisation), *who the client is* (profiles identity), and *what the client said* (intake_responses + intake_answers).

### Why not Option C (split between two homes)

Splitting `biological_sex` into intake_answers and `religious_content_preference` into a dedicated table forces every reader to know which field lives where. The cognitive cost outweighs any tidiness benefit. A single home keeps the access pattern uniform.

---

## 4. Capture point

Personalisation fields are captured **at the start of the intake form, as a dedicated demographics section** (proposed `section_id = 'section0_demographics'`), before the symptom and history questions.

| Field | Step | Behaviour |
|---|---|---|
| `biological_sex` | section0, question 1 | Required radio. No skip. |
| `religion` | section0, question 2 | Optional dropdown with all 9 enum values. Skip → stores `'prefer_not_to_say'`. |
| `religious_content_preference` | section0, question 3 (conditional) | Renders **only** if `religion = 'muslim'` (v1 — extends as more framings ship). Required choice if shown. |

**Why dedicated section before symptoms:**

1. `biological_sex` must be known before any sex-specific branching can fire. Putting demographics later means menstrual questions either show to everyone (current state — wrong) or come after the sex question in flow order, making the questionnaire feel re-arranged.
2. Religion and content preference are low-friction to ask once, before the user is invested in the symptom narrative.
3. A clearly-labelled "About you" section signals that this is identity/preference data, not clinical questioning. Improves the framing of "why is the form asking this".

**Mandatory vs optional summary:**

- `biological_sex`: **mandatory**. The intake cannot complete without it. This is consistent with how the clinical model treats sex (one of the few near-universal modifiers of physiology).
- `religion`: **optional**. Skip permitted. Skipped → `'prefer_not_to_say'`.
- `religious_content_preference`: **conditionally required**. Only shown when applicable; when shown, must be answered.

**Re-editability post-intake:**

- `biological_sex`: **locked** post-intake. Changing it later would require recomputing every downstream artefact (reasoning traces, body story, BioHub interpretation). Out of scope for v1. Edge cases handled by practitioner-side `clinical_notes_on_sex`.
- `religion` and `religious_content_preference`: **editable** at the database level from PS.1. A settings UI is out of scope for PS.1 (see §11); the editability supports future surfacing without re-migration.

**Capture location alternatives considered:**

- *At signup* — rejected. Signup is identity (email/password) and shouldn't include sensitive demographic capture.
- *After intake completion* — rejected. Sex-specific branching can't fire if sex is unknown during intake.
- *Settings only* — rejected. Sex is required for clinical fidelity; making it post-hoc would mean the first body story renders for an unknown-sex user, then changes once they fill in settings.

---

## 5. Access pattern — practitioner visibility

| Field | Client | Assigned practitioner | Admin | AI generation context |
|---|---|---|---|---|
| `biological_sex` | own row | **yes** | yes | yes |
| `clinical_notes_on_sex` | own row (read-only — practitioners write) | **yes** (read + write) | yes | yes |
| `religion` | own row | **no** (recommended) | yes | only when parameterising framing |
| `religious_content_preference` | own row | **no** (recommended) | yes | yes |

### Why practitioners see `biological_sex`

It's clinically load-bearing. Reference ranges, hormonal interpretation, drug metabolism patterns, symptom triage — all change with sex. A practitioner reviewing a case without knowing sex is reviewing it half-blind.

### Why practitioners do NOT see `religion` or `religious_content_preference` (recommended)

These are personalisation preferences, not clinical facts. A practitioner doesn't need to know a client is Muslim to review their lab results or recommend a protocol. The client's choice of religious framing in their own AI-generated content is their UX preference, not part of the clinical record.

**Counter-argument worth surfacing as an open question (§12):** a practitioner might genuinely benefit from knowing — e.g., dietary recommendations for a Muslim client could reasonably acknowledge halal context; protocol pacing during Ramadan matters. The cost of hiding this is the practitioner has to ask; the cost of showing it is exposing a preference the client may consider private.

**Recommendation:** hide by default. Practitioners who need the context for clinical reasons can ask, the same way they'd ask about diet or lifestyle. If clinical need becomes a recurring pattern, revisit in a future phase.

### RLS pattern for `user_personalisation`

```sql
-- Clients read and write their own row
CREATE POLICY up_member_select  ON public.user_personalisation FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY up_member_insert  ON public.user_personalisation FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY up_member_update  ON public.user_personalisation FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Admin full access
CREATE POLICY up_admin_all      ON public.user_personalisation FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

For practitioner-scoped access to the subset of fields they need (`biological_sex`, `clinical_notes_on_sex`), use a **column-scoped view** mirroring the F2 pattern rather than adding a practitioner SELECT policy on the base table:

```sql
CREATE OR REPLACE VIEW public.practitioner_client_personalisation
WITH (security_invoker = false) AS
SELECT up.user_id, up.biological_sex, up.clinical_notes_on_sex, up.updated_at
FROM public.user_personalisation up
WHERE
  EXISTS (
    SELECT 1
    FROM public.case_practitioner_work cpw
    JOIN public.client_cases cc ON cc.id = cpw.case_id
    WHERE cc.client_id = up.user_id
      AND cpw.practitioner_id = auth.uid()
  )
  OR is_admin();

GRANT SELECT ON public.practitioner_client_personalisation TO authenticated;
```

Practitioner writes to `clinical_notes_on_sex` are handled via a `SECURITY DEFINER` helper function rather than a write-through view, for consistency with how the platform handles other practitioner writes (RPC-based) and to avoid view-update complexity.

This pattern **does not depend on Q6 Option A** — `user_personalisation` is a new table with its own policies, independent of the intake-table RLS gap.

### AI generation access

AI generation runs admin-client today (Q6 exception). It reads the user's personalisation row directly. No additional RLS work needed.

---

## 6. Content gating pattern

**Recommendation: Option C — hybrid.**

| Surface type | Mechanism | Where it lives |
|---|---|---|
| Static UI copy (taglines, section headers, microcopy, button labels) | Conditional rendering in component code, driven by a personalisation context | `apps/web/app/dashboard/*` components read from `<PersonalisationProvider>` |
| AI-generated narrative (body story, synopsis, reasoning explanations, future protocols) | Prompt-template parameterisation. The AI generates correctly-framed text in one pass given a `framing` parameter | `packages/db/src/crt/`, `apps/web/app/dashboard/story/actions.ts` — prompt builders read personalisation context server-side and pass framing flags to the model |
| Structured clinical content (reference ranges, branching rules) | Server-side branching keyed on `biological_sex` | `packages/db/src/intake/branchingRules.ts` for intake; future BioHub helpers |

### Why hybrid

- **Pure Option A (conditional rendering everywhere)** doesn't work for AI-generated content. We can't render two pre-baked AI narratives and toggle one — the model generates one output per call, so the personalisation context has to flow into the generation step.
- **Pure Option B (content versioning at data layer)** is overkill for static UI copy. Building a CMS-like content-version table for the four or five taglines that differ by framing would be massively over-engineered.
- The hybrid splits at the natural seam: where content is authored once and rendered (Option A), and where content is generated per-request (Option B).

### Where personalisation values load

**Server-side, at the route-group boundary.** A server helper `getPersonalisationContext(userId)` is called in `apps/web/app/dashboard/layout.tsx` (the auth-only route group root) and the result is passed to a client `<PersonalisationProvider>` that wraps the dashboard subtree.

```ts
// apps/web/app/dashboard/layout.tsx (conceptual)
const personalisation = await getPersonalisationContext(user.id)
return <PersonalisationProvider value={personalisation}>{children}</PersonalisationProvider>
```

- Loaded once per request, not per component
- Server-side load means no client round-trip
- Context shape kept small: `{ biologicalSex, religion, religiousContentPreference }`
- `clinical_notes_on_sex` is **not** included in client context — it's practitioner-only, lives on care app routes

### How it propagates to AI generation

Server actions and helpers that call AI receive personalisation context as an explicit argument, not through React context. For example:

```ts
await generateBodyStory(memberId, { biologicalSex, religiousContentPreference })
```

This keeps the AI generation paths testable and explicit about what they consume. Prompt builders inside the helper read these fields and parameterise the system prompt accordingly.

### Content author guidance

A short authoring guide (`docs/content/personalisation-authoring.md`, separate phase) will document:
- The full set of personalisation keys that gate content
- Which surfaces have multiple variants and where they live in the codebase
- The default behaviour when a personalisation value is missing or `'prefer_not_to_say'`
- A checklist for adding a new gated surface

This guide is **out of PS.1 scope** — it lands as part of PS.3 when the substrate is proven in code.

---

## 7. AI generation context

### Paths affected in PS.4

| Path | File | Personalisation needed |
|---|---|---|
| `generateBodyStory` | `apps/web/app/dashboard/story/actions.ts` | `biologicalSex` (clinical correctness), `religiousContentPreference` (narrative framing) |
| `createReasoningTrace` | `packages/db/src/crt/createReasoningTrace.ts` | `biologicalSex` (clinical interpretation); religion irrelevant — reasoning is for practitioner consumption |
| Synopsis generation | `apps/web/app/dashboard/synopsis/actions.ts` | `biologicalSex` (clinical), `religiousContentPreference` (tone) |
| Future protocol generation (Phase D) | not yet built | both; out of scope for PS.4 but the substrate ready |

### How values are passed

System prompt parameter. The prompt builder constructs a system prompt that includes a clinical-context block:

```
CLIENT CONTEXT:
- Biological sex: female
- Framing preference: secular

When discussing reproductive-system topics, ground in female anatomy and physiology.
Default to secular language and examples throughout.
```

This sits inside the existing system prompt without restructuring the prompt template. The model receives clear, structured context and adapts output accordingly.

### Why biological sex affects clinical interpretation

- **Reference ranges** — hormones, lipid profiles, iron studies, kidney function markers all have sex-specific normal ranges.
- **Hormonal pattern reading** — cycle-phase interpretation, menopause framing, testosterone patterns.
- **Drug metabolism** — many drugs have sex-different pharmacokinetics worth flagging.
- **Symptom interpretation** — chest pain in women presents atypically vs. men; fatigue patterns differ.

A body story narration that ignores sex risks being clinically misleading. Adding sex to AI context is a clinical safety upgrade, not just personalisation.

### Why religion affects narrative tone, not clinical content

Religion (when content preference is `'show'`) parameterises narrative tone, examples, and metaphors. It does **not** change clinical reasoning. The AI is instructed: *"You may use Islamic concepts like ihsan or amanah when discussing self-care, where they enrich rather than replace the clinical point. Clinical recommendations remain governed by evidence, not faith."*

This separation is preserved in the prompt template: clinical reasoning section is constant; framing section varies.

### Where prompt templates live

Current state: prompt logic is inline in `generateBodyStory` and `createReasoningTrace`. As personalisation expands, this gets unwieldy.

**Recommendation:** during PS.4, extract prompt-building logic into `packages/db/src/prompts/` (new directory) with one builder per AI surface. Builders accept `(intakeContext, personalisation)` and return `{ systemPrompt, userPrompt }`. This makes the personalisation surface auditable in one place.

This refactor is part of PS.4, not a separate phase.

---

## 8. Public-facing surface remains secular

### Explicit statement

The marketing site (`natural-intelligence.uk`, served by `apps/web/app/page.tsx` and the public route group: `/`, `/community`, `/directory`, `/resources`, `/legal`, `/login`, `/signup`, `/welcome`) and the care landing surface (`care.natural-intelligence.uk` root, pre-authentication) **remain secular by default**. No religious framing appears on any public surface, regardless of any user's personalisation values, ever.

Personalisation affects only **authenticated user surfaces**:
- `apps/web/app/dashboard/**` (the authenticated route group)
- AI-generated content for authenticated users
- Care app surfaces showing practitioner-relevant fields (biological_sex, clinical notes)

### Architectural boundary

Three mechanisms together prevent leakage:

1. **`<PersonalisationProvider>` is mounted only in `apps/web/app/dashboard/layout.tsx`.** Public route components have no parent provider, so any attempt to read personalisation context from a public component throws a clear error at runtime.

2. **Server-side helper `getPersonalisationContext(userId)` is exported from a path namespaced for authenticated use** (e.g., `packages/db/src/personalisation/dashboardContext.ts`). The helper requires a `userId` argument; there's no path to call it without a known user. An ESLint rule (or simple grep in CI) can forbid imports of this helper from `apps/web/app/(public)/**` or from `apps/web/app/page.tsx`.

3. **The marketing OpenGraph image, sitemap, and root metadata are static.** They cannot incorporate personalisation by construction.

A short test asserts the boundary holds: a CI grep that fails if `getPersonalisationContext` is imported from any path outside `apps/web/app/dashboard/` or `apps/care/app/`.

This boundary is documented in the architecture register so future engineers can't accidentally cross it.

---

## 9. Sex-specific clinical content

### Surfaces with sex-specific variants (planned)

| Surface | Current state | Post-PS behaviour |
|---|---|---|
| Body story narration | Sex-agnostic prose | Reproductive-system framing conditional on `biological_sex`. AI prompt instructed to ground in correct anatomy. |
| Intake — menstrual / cycle questions | Shown to **everyone** (gap) | Branching rule gates these on `biological_sex = 'female'`. Closes the Sprint 16.3 Tier 1 gap. |
| Intake — sex-specific symptom phrasing | Generic phrasing | `biological_sex` parameterises question wording where appropriate (e.g., "Have you experienced changes in libido?" stays generic; "How would you describe your menstrual cycle?" gates on female) |
| BioHub reference ranges | Single set of ranges | Sex-keyed reference ranges per biomarker; rendering picks the correct range |
| AI symptom interpretation | Generic | Sex passed in AI prompt; reasoning incorporates sex-relevant differential |
| Drug / supplement interaction warnings | Generic | Sex-relevant warnings prioritised; the substrate enables this, the content authoring is later |

### Default behaviour when `biological_sex` is unknown

Three scenarios:

1. **Intake not yet started or section 0 not reached.** AI generation either declines to generate sex-specific narrative or generates explicitly neutral content. Body story would defer rendering until section 0 is complete.
2. **Intake complete but `biological_sex` somehow null** (data corruption, test data, legacy rows pre-migration). Treat as "unknown". AI prompts instructed: *"Sex is not provided; avoid sex-specific clinical claims and prefer generic phrasing."*
3. **Future: `biological_sex` is one of a non-binary value in future schema evolution.** Out of PS.1 scope. The dedicated table makes evolution clean if needed.

### What `clinical_notes_on_sex` looks like in practice

Practitioner writes free-text:

> *"Trans female client, 4 years on estradiol + spironolactone. Treat hormonal references as female-pattern; bone density and CVD risk pattern intermediate — flag the case if either becomes a focus."*

That note appears in the practitioner's workspace view, and AI generation (when called by a practitioner-context surface like a care-app explainer) can optionally include the note in the prompt. The client never sees this field — it's the chart annotation, not the form answer.

---

## 10. Phasing

### PS.1 — Schema + capture (~1 day)

- Migration: create `user_personalisation` table with RLS (member SELECT/INSERT/UPDATE, admin ALL). No practitioner policies yet (lands in PS.2 via the view).
- Migration: create new intake `section0_demographics` with questions `biological_sex`, `religion`, `religious_content_preference`.
- Branching rule: gate existing `menstrual_*` questions on `biological_sex = 'female'`.
- Intake save helper: writes section 0 answers to `user_personalisation` (not `intake_answers`) on submission.
- Tests: unit tests for the new save path; branching parity tests for sex-gated questions.

**Gate to PS.2:** `user_personalisation` row exists for new intake completions; menstrual questions correctly hidden for `male` users.

### PS.2 — Practitioner-side visibility (~0.5–1 day)

- Migration: create `practitioner_client_personalisation` SECURITY DEFINER view (column-scoped: `biological_sex`, `clinical_notes_on_sex` only). Mirrors F2 pattern.
- Migration: create `set_clinical_notes_on_sex(p_user_id, p_notes)` RPC for practitioner writes (SECURITY DEFINER, checks practitioner has work on a case for `p_user_id`).
- Workspace UI: render `biological_sex` in the ClientSummaryPanel; render and allow edit of `clinical_notes_on_sex` (small inline-edit field). Both gated to practitioners with work on the client.
- Tests: helper unit tests; smoke test against live workspace.

**Gate to PS.3:** Practitioners viewing a case can see and write `clinical_notes_on_sex` for their assigned clients only.

### PS.3 — Content gating substrate (~1–1.5 days)

- New: `packages/db/src/personalisation/dashboardContext.ts` — `getPersonalisationContext(userId)` server helper.
- New: `<PersonalisationProvider>` in `apps/web/app/dashboard/layout.tsx`.
- New: `usePersonalisation()` client hook.
- Proof surfaces (two): a tagline on the dashboard home that varies by content preference, plus the intake section header for section 0 (subtle framing copy variation).
- CI grep test: enforces `getPersonalisationContext` import boundary.
- Public surface assertion: confirms no public route mounts the provider.

**Gate to PS.4:** Content variants render correctly for `show` and `hide` preferences without leaking to public surfaces.

### PS.4 — AI generation context (~1 day)

- New: `packages/db/src/prompts/` directory; extract body story and synopsis prompt builders into named modules.
- Builders accept `(intakeContext, personalisation)` and return `{ systemPrompt, userPrompt }`.
- `generateBodyStory` and synopsis generation updated to load personalisation server-side and pass to builders.
- `createReasoningTrace` updated to receive `biologicalSex` (clinical only — no religion).
- Tests: prompt builder snapshot tests for each `(sex × framing)` combination.

**Gate (Phase complete):** A body story generated for a `female + show` user reads differently from one for `male + hide`, and the prompt difference is auditable.

### Total estimate

**~3.5–4.5 days of focused work**, gated so each sub-phase produces something testable and reviewable. Each sub-phase ends with a verification report mirroring the Phase B pattern.

### Q6 Option A dependency

The recommended `user_personalisation` table is **new and has its own RLS**, independent of intake-table policies. Q6 Option A (practitioner-scoped RLS on `intake_answers`, `intake_responses`, `biomarker_*`, `lab_reports`) is **not a blocker** for any PS sub-phase.

However, Q6 Option A **must still land before Phase C** as previously decided. Recommended sequencing: Personalisation Substrate (all 4 sub-phases) → Q6 Option A migration → Phase C. The Personalisation work doesn't depend on Q6, but doing Q6 between PS and Phase C keeps the gate condition met.

---

## 11. Out of scope for Personalisation Substrate

The substrate enables; it does not author content. Explicitly out of scope:

- **Protocol generation** (Phase D)
- **CNM template implementation** (Phase D)
- **Religious copy authoring** — the substrate enables it; the actual Muslim-framing narrative copy, prompts, and examples are a separate content phase
- **Practitioner invitation flow** (Phase C)
- **Q6 Option A migration** (separate corrective phase, landing between Personalisation Substrate and Phase C)
- **Frontend redesign of the public marketing site**
- **Settings UI for editing personalisation values** (defer to a small UX phase after PS.4; the data layer supports editing from PS.1)
- **Multi-language / i18n support**
- **Age, ethnicity, geographic, socioeconomic personalisation** (future personalisation extensions; substrate is shaped to accept them)
- **Practitioner-side settings UI** for organisation-wide framing preferences
- **Audit logging of personalisation changes** (the `updated_at` column is sufficient for v1; full audit trail can land later if compliance requires)
- **Migration of existing intake takers** to populate `user_personalisation` retroactively (low value — existing test users are few; new intake flow populates correctly)

---

## 12. Open questions

These need explicit decisions before PS.1 starts.

| # | Question | Recommendation in this proposal | Needs decision |
|---|---|---|---|
| 1 | `biological_sex` edge-case handling: option (a) strict binary, or (b) strict binary + practitioner-side `clinical_notes_on_sex`? | **(b)** — adds one nullable column, preserves form simplicity, captures clinical nuance | confirm |
| 2 | `religion` enum scope: full 9-value enum or narrow v1 (`'muslim' \| 'prefer_not_to_say' \| 'other'`)? | **Full enum** — same migration cost, better trust signal, future-content-author-friendly | confirm |
| 3 | `religious_content_preference` default: opt-in (`'hide'` default everywhere) or auto-on for Muslim users (`'show'` default when `religion='muslim'`)? | **Opt-in** — `'hide'` always default; explicit choice required when applicable | confirm |
| 4 | Should practitioners see `religion` and `religious_content_preference`? | **No** — keep these as personalisation/UI preferences, surface only what's clinically load-bearing (`biological_sex` and `clinical_notes_on_sex`) | confirm — counter-argument exists |
| 5 | Settings UI for editing personalisation: in scope for PS.4, or deferred? | **Deferred** to a small post-PS phase. Data-layer editability lands in PS.1; UI later. | confirm |
| 6 | Should `biological_sex` be editable post-intake? | **No** — locked. Edge cases handled by `clinical_notes_on_sex`. | confirm |
| 7 | Should `religion` capture happen before signup, at signup, or at intake? | **At intake** (proposed §4) | confirm |
| 8 | Should AI generation also include age, geography, or other demographic factors? | **No** for PS — out of scope. Worth noting as a future personalisation extension once the substrate is proven. | confirm — and flag for backlog |
| 9 | Is the proposed `practitioner_client_personalisation` view (column-scoped, F2 pattern) the right access mechanism, or should practitioners get a direct RLS policy on `user_personalisation`? | **View** — mirrors F2 precedent, keeps the principle that practitioners access subsets via views | confirm |
| 10 | Should `clinical_notes_on_sex` be visible to the client (read-only) or hidden from them entirely? | **Hidden** — it's the chart annotation. Surfacing might create awkwardness ("why does my practitioner have a note about my sex?") | confirm |
| 11 | Is there a need for a `religion_other_freetext` column when `religion='other'` is selected? | **Not in v1** — adds form complexity for low return. Add later if `'other'` selections are common in practice. | confirm |
| 12 | When the practitioner edits `clinical_notes_on_sex`, should the change be logged as a `case_event`? | **Not in v1** — `updated_at` on the row is sufficient. Reconsider if audit requirements emerge. | confirm |

---

*Personalisation Substrate design proposal complete. No code, no schema. Awaiting addendum review cycle before PS.1 implementation.*

---

## Addendum — PS Design Resolutions

**Date:** 2026-05-19
**References:** Original proposal §§3, 5, 6, 8, 12.
**Purpose:** Close the four gaps surfaced during review, confirm the twelve open questions, restate the Islamic-content rendering rule explicitly, and reaffirm the public frontend boundary. The original proposal sections above are unchanged; this addendum supplements them.

---

### Part 1 — Gaps closed

#### A.1 — Enable Row Level Security

The migration that creates `user_personalisation` must explicitly enable RLS immediately after the `CREATE TABLE`. Without this, the four `CREATE POLICY` statements in §5 are inert and the table is wide-open.

```sql
CREATE TABLE public.user_personalisation ( … );  -- see §3

ALTER TABLE public.user_personalisation ENABLE ROW LEVEL SECURITY;

-- Then the four policies from §5
CREATE POLICY up_member_select  …
CREATE POLICY up_member_insert  …
CREATE POLICY up_member_update  …
CREATE POLICY up_admin_all      …
```

Stated as a single migration in PS.1.

#### A.2 — DELETE stance

Explicit position for v1:

- **No client DELETE policy.** Default deny applies — clients cannot delete their own personalisation row directly.
- **No admin DELETE policy.** Admin deletion happens via SQL or service-role tooling when needed; an explicit admin DELETE policy is not warranted yet.
- **Row removal happens via CASCADE** when a profile is deleted (`user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE` in §3). The FK already handles account teardown.

**Reasoning:** personalisation is account-bound state. Direct client-initiated deletion is not a v1 workflow. If "reset my personalisation" becomes a real client need, revisit with an explicit policy then. Note that the `up_admin_all` policy from §5 uses `FOR ALL`, which technically grants admin DELETE — so admins *can* delete via the SQL editor when justified, no separate policy needed.

#### A.3 — `updated_at` trigger

**Verification (read-only query against live dev DB, project `yftxzvdrxnhwpcnsrktn`):**

```sql
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname ILIKE '%updated_at%' AND n.nspname IN ('public','auth','extensions');
```

Returns two functions, both in `public` and both `RETURNS trigger`:
- `public.handle_updated_at()` — confirmed exists, exact name as referenced in this addendum
- `public.set_updated_at()` — also exists (older sibling, not used here)

The migration adds:

```sql
CREATE TRIGGER set_user_personalisation_updated_at
  BEFORE UPDATE ON public.user_personalisation
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

The `set_clinical_notes_on_sex` RPC also writes `updated_at = now()` explicitly in its UPDATE branch (see A.4) — the trigger fires too, so the result is the same value, but the explicit set documents intent at the RPC level.

#### A.4 — Full RPC body for `set_clinical_notes_on_sex`

**Auth join shape verification (read-only):** confirmed `case_practitioner_work.case_id uuid`, `case_practitioner_work.practitioner_id uuid`, `client_cases.id uuid`, `client_cases.client_id uuid`. The join shape assumed by the drafted RPC matches live schema exactly — no structural adjustment needed.

```sql
CREATE OR REPLACE FUNCTION public.set_clinical_notes_on_sex(
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
  -- Reject anonymous callers
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Authorise: caller must be an assigned practitioner on a case
  -- for the target client. Any work status grants this (matches
  -- F1 spirit: practitioner who has worked on the client retains
  -- identity-adjacent access).
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

  -- Upsert pattern: ensure a personalisation row exists before
  -- writing the note. If the client hasn't yet completed intake
  -- (no row), we still create a minimal row so practitioners can
  -- record observations.
  INSERT INTO user_personalisation (user_id, clinical_notes_on_sex)
  VALUES (p_user_id, p_notes)
  ON CONFLICT (user_id) DO UPDATE
    SET clinical_notes_on_sex = EXCLUDED.clinical_notes_on_sex,
        updated_at            = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_clinical_notes_on_sex(uuid, text) TO authenticated;
```

**Key properties:**

- **Layer 1** — function rejects null `auth.uid()` with `Authentication required`.
- **Layer 2** — function rejects callers without a `case_practitioner_work` row linking them to the target client, regardless of work status. Mirrors the F1 spirit (clinical-continuity access for any work, not just active).
- **Field scope** — the function reads and writes only `clinical_notes_on_sex`. It does **not** touch `religion`, `religious_content_preference`, or `biological_sex`.
- **Upsert** — `ON CONFLICT (user_id) DO UPDATE` handles the case where the client has no personalisation row yet (e.g., intake not yet complete). The default values from §3 (`religion='prefer_not_to_say'`, `religious_content_preference='hide'`) apply to the inserted row.
- **Explicit `updated_at = now()`** in the UPDATE branch — documents intent at the RPC level even though the trigger from A.3 fires too.
- **Returns `void`** — callers detect failure by catching the raised exception, matching the `complete_practitioner_work` failure-signalling convention.
- **`SECURITY DEFINER` + `SET search_path = public`** — same hardening pattern as `complete_practitioner_work`.

If during PS.2 implementation the live schema or RLS reveals a structural difference from this draft (e.g., a new column in `case_practitioner_work` that should appear in the auth check, or a constraint that blocks the upsert), surface and adjust — do not silently change the auth model.

---

### Part 2 — Open question decisions (Q1–Q12)

| # | Decision | Rationale (one-liner where useful) |
|---|---|---|
| **Q1** | **CONFIRMED** — `biological_sex = 'male' \| 'female'` only. `clinical_notes_on_sex` exists for practitioner nuance. | Per §2 / Option (b). |
| **Q2** | **CONFIRMED** — full 9-value enum: `muslim \| christian \| jewish \| hindu \| buddhist \| sikh \| secular \| prefer_not_to_say \| other`. | Per §2 — same migration cost, better trust signal. |
| **Q3** | **CONFIRMED** — `religious_content_preference` default = `'hide'`. Opt-in required, no auto-on for any religion. | Per §2 — fails safe to secular. |
| **Q4** | **CONFIRMED** — `religion` and `religious_content_preference` hidden from practitioners in v1. Revisit if clinical need becomes a recurring pattern. | Per §5 — clinical vs. UI-preference separation. |
| **Q5** | **CONFIRMED** — no settings UI in PS.1. Data-layer editability lands in PS.1; user-facing edit UI deferred to a small post-PS phase. | Per §11. |
| **Q6** | **CONFIRMED** — `biological_sex` locked post-intake. Edge cases handled via `clinical_notes_on_sex`. | Per §4 — avoids cascade-recomputation of downstream artefacts. |
| **Q7** | **CONFIRMED** — capture at intake (dedicated `section0_demographics`). | Per §4. |
| **Q8** | **CONFIRMED** — no age, geography, or other demographic factors in AI generation context in PS scope. **Flagged for backlog** as future personalisation extensions. | Substrate is shaped to accept them later. |
| **Q9** | **CONFIRMED** — `practitioner_client_personalisation` view (column-scoped, F2 pattern) is the access mechanism. No direct practitioner policy on the base table. | Mirrors F2 precedent. |
| **Q10** | **CONFIRMED** — `clinical_notes_on_sex` hidden from client in v1. | Chart annotation, not form answer. |
| **Q11** | **CONFIRMED** — no `religion_other_freetext` column in v1. Add later if `'other'` selections are common in practice. | Adds form complexity for low return. |
| **Q12** | **CONFIRMED** — no `case_event` on `clinical_notes_on_sex` updates in v1. The row's `updated_at` is sufficient. | Reconsider if audit requirements emerge. |

---

### Part 3 — Islamic content rendering rule

Islamic content variants are rendered **if and only if BOTH conditions hold**:

1. `user_personalisation.religion = 'muslim'`
2. `user_personalisation.religious_content_preference = 'show'`

Either condition failing means **secular content is rendered**.

When `religious_content_preference = 'hide'`, the `religion` value has **no rendering effect**, regardless of what it is.

This boolean is the gate. Future religions (Christian, Jewish, Hindu, etc.) follow the same pattern when their content variants are authored: each renders **iff** `(religion = '<R>' AND religious_content_preference = 'show')`. The substrate gates on a single conjunction; the content layer supplies the variant.

For the avoidance of doubt: `religion = 'prefer_not_to_say'`, `religion = 'secular'`, or any future religion without authored variants all fall through to secular content. The default state of the platform is secular; framing is a layered opt-in on top.

---

### Part 4 — Public frontend boundary reaffirmed

The architectural boundary described in §8 is reaffirmed and binding:

- `<PersonalisationProvider>` mounted **only** in `apps/web/app/dashboard/layout.tsx`.
- `getPersonalisationContext(userId)` namespaced for authenticated use (lives in `packages/db/src/personalisation/dashboardContext.ts`).
- CI grep / lint rule enforces the namespace boundary — fails the build if `getPersonalisationContext` is imported from any path outside `apps/web/app/dashboard/` or `apps/care/app/`.
- Marketing OpenGraph image, sitemap, and root metadata are static and cannot incorporate personalisation by construction.

The public marketing site (`natural-intelligence.uk` and all routes outside `/dashboard`) **stays secular regardless of any user's personalisation values, ever**. This is enforced by architecture (provider scoping + CI boundary check), not by convention.

---

### Confirmation

No other sections of the original proposal change. The 12 design decisions are confirmed, the 4 gaps are closed, and the rendering rule and public boundary are explicit.

**PS.1 is now ready to scope.** Awaiting explicit approval before implementation begins.
