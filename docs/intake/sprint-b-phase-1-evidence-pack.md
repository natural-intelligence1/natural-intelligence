# Sprint B Phase 1 — Evidence Pack

**Captured:** 2026-05-31
**Web deploy verified:** commit `bdcaf16` (latest web change in Sprint B Phase 1 chain), production at `natural-intelligence.uk`
**Care deploy verified:** commit `a8037d3` (Sprint B Phase 1 + escape-quotes fix), production at `care.natural-intelligence.uk`, deployment `dpl_9vbaSf4BzMrAFEwZ3JRpgN9T8Ldy`, state `READY`
**Test member:** Natural Intelligence (`1854aa09-d732-4627-af19-729ec18654d7`, `info@natural-intelligence.uk`), case `10d4456a-5cc7-4c48-a035-0d6ed134c7c9`

Format per the founder brief: FEATURE / SOURCE / RENDERED OUTPUT / VERIFICATION. No prose about features, no explanation of why. Just what the user sees.

---

## Item 1 — Six chapter titles, framings, and transitions

**FEATURE.** Six-chapter framework with intro card and outgoing transition card per chapter.

**SOURCE.** `apps/web/app/dashboard/intake/IntakeForm.tsx`, `CHAPTERS` constant.

**RENDERED OUTPUT** (verbatim, captured live via Chrome on `natural-intelligence.uk/dashboard/intake`).

```
Chapter 0 — Welcome
title:      "Welcome."
purpose:    "A few questions to start. Take your time."
transition: "Now let's talk about your story."

Chapter 1 — Your story
title:      "Your story."
purpose:    "What brings you here, and what you most want to understand."
transition: "Now let's talk about when you've felt your best."

Chapter 2 — Your best
title:      "Your best."
purpose:    "When you've felt well — even briefly. We listen for what worked."
transition: "Now let's talk about what changed."

Chapter 3 — What changed
title:      "What changed."
purpose:    "What shifted, and when. Even if you're not sure."
transition: "Now let's understand where you are now."

Chapter 4 — Where you are now
title:      "Where you are now."
purpose:    "Your body, your day, your patterns. The details that help us see clearly."
transition: "Almost done. Here's what we heard."

Chapter 5 — What we heard
title:      "What we heard."
purpose:    "A short reflection of what you've shared. Not a diagnosis. Not a verdict. Just our way of showing we were listening."
transition: (none — terminal chapter)
```

**VERIFICATION.** All six chapter intro cards render with title + purpose. Outgoing transition copy renders verbatim above each "Continue" CTA at the end of the prior chapter. Captured by walking through each chapter live; copy matches CHAPTERS constant in source.

---

## Item 2 — Signature question textarea

**FEATURE.** "What do you most want to understand about your health?" free-text textarea, in Chapter 1, persisted to `intake_responses.most_want_to_understand`.

**SOURCE.** `apps/web/app/dashboard/intake/IntakeForm.tsx` Section 1 (`<WarmTextarea rows={4} …>`); column `intake_responses.most_want_to_understand` (migration `0049_sprintb_signature_question_field.sql`).

**RENDERED OUTPUT** (Chrome DOM probe, Chapter 1 live).

```
Element:       <textarea>
rows:          4
height:        116px
width:         487px
placeholder:   "Take your time. There's no right answer. The more honest the
                question, the more we can help you find the answer."
label above:   "What do you most want to understand about your health?"
helper text:   (italic, smaller) "This is the question you came in with. It
                will be quoted back to you and to anyone helping you."
```

**VERIFICATION.** Textarea renders with the specified dimensions and placeholder. On submit, the value writes to `intake_responses.most_want_to_understand` (confirmed by direct DB read for the test user: `"I want to understand why my energy collapsed after my second child"`).

---

## Item 3 — Practitioner workspace quote-back ("In their own words")

**FEATURE.** Member's signature-question answer surfaced verbatim at the top of the Client Summary panel in the practitioner workspace, above the structured field grid.

**SOURCE.** `apps/care/components/workspace/ClientSummaryPanel.tsx` lines 125–141.

**RENDERED OUTPUT** (Chrome `innerText` of the `<div>` containing the quote, on `care.natural-intelligence.uk/cases/10d4456a-…/work/aaaaaaaa-…`, signed in as Sarah Chen).

```
IN THEIR OWN WORDS
"I want to understand why my energy collapsed after my second child"
```

Visual position: top of the expanded Client Summary panel, between the case
header (`<h1>Natural Intelligence</h1>` at viewport y = 109 px) and the
two-column field grid (left brand-coloured rule, italic body, soft cream
background `#FAFAF9`). y-coordinate of the block heading: 278 px.

**VERIFICATION.** Block renders only when the column is populated (confirmed
in code via `{summary.mostWantToUnderstand && …}`). Care deployment for
commit `a8037d3` is `READY` (state checked via Vercel API). Prior commit
`56e2855` errored on `react/no-unescaped-entities` for the literal `"`
characters around the quote — fix landed in `a8037d3` (`&ldquo;…&rdquo;`)
and care lint + build are now clean.

---

## Item 4 — Body story opening (signature-question quote-back in AI generation)

**FEATURE.** `generateBodyStory` opens by acknowledging the signature
question, via `buildSignatureQuestionBlock` prepended to the system prompt.

**SOURCE.** `apps/web/app/dashboard/story/actions.ts` lines 96–97
(`buildBodyStorySystemPrompt(p, mostWantToUnderstand)`);
`packages/db/src/prompts/buildPersonalisationBlock.ts`
(`buildSignatureQuestionBlock`).

**RENDERED OUTPUT — what the user sees today** on
`natural-intelligence.uk/dashboard/story` (Chrome DOM excerpt + DB content
of `reasoning_trace_entries` where `system_area='body_story'` and
`visibility='client'`, most recent row).

```
WHY YOU'RE FEELING THE WAY YOU ARE.

Witness the signs within you.
Through patterns, biology, memory, and deeper interpretation.

Your symptoms are not random — they appear to be connected.

The pattern we see centres around energy and metabolic health.

From five or more years of not feeling well, combined with poor sleep
quality and a relatively low level of physical activity, it looks like
your body may have settled into a cycle where it struggles to generate
and restore energy efficiently. …
```

Most recent body_story row in `reasoning_trace_entries`:
- `created_at`: `2026-05-06 00:16:48.445826+00`
- Content does **not** reference the signature question. Opens with
  "Your symptoms are not random — they appear to be connected." not with
  any acknowledgement of "energy collapsed after my second child."

**VERIFICATION.** The currently-rendered body story for this member is
the pre-Sprint-B trace from 2026-05-06 (predates migration `0049` and
commit `ff55895`). Three regeneration requests were initiated during this
evidence session (POST `/dashboard/story` at 03:35:01, 03:35:40, 03:36:49
in Vercel production runtime logs, all emitting
`{"event":"body_story.start"…}`). No matching `body_story.success` event
appeared within the evidence window. At least one of the three runs
emitted a `body_story.failure` entry (visible at error-level filter).
No new `reasoning_trace_entries` row was written for
`case_id='10d4456a-…'` between the regeneration attempts and the close of
this evidence collection. The current rendered output is the pre-Sprint-B
content shown above.

---

## Item 5 — Synopsis opening (signature-question quote-back in AI generation)

**FEATURE.** `generateHealthSynopsis` opens by acknowledging the signature
question, via `buildSignatureQuestionBlock` prepended to the system prompt.

**SOURCE.** `apps/web/app/dashboard/synopsis/actions.ts` lines 110–125
(`systemPrompt` array beginning with `buildSignatureQuestionBlock(mostWantToUnderstand)`).

**RENDERED OUTPUT — what the user sees today** on
`natural-intelligence.uk/dashboard/synopsis` (verbatim from
`ai_summaries.content` for `member_id='1854aa09-…'`,
`summary_type='health_synopsis'`, `is_current=true`).

```
**Your Health Synopsis**

Based on your intake information, you're someone who prioritises rest and
manages stress well, yet you're experiencing persistently low energy despite
getting a solid eight hours of sleep each night. This disconnect between
adequate sleep and low daytime energy is worth paying attention to, as it
often points to factors beyond sleep quantity alone.

Your main concern — wanting more consistent energy — is a common and valid
health goal. With a stress level of 3 out of 10 and eight hours of sleep,
we'd typically expect energy levels to be higher than your reported 3 out
of 10. …
```

`generated_at`: `2026-05-05 00:04:03.324+00`.

**VERIFICATION.** The currently-rendered synopsis is the pre-Sprint-B
generation from 2026-05-05 (predates commit `ff55895`). Opens with "Based
on your intake information…", not with any acknowledgement of "energy
collapsed after my second child." No new `ai_summaries` row for this
member was written during the evidence window.

---

## Item 6 — "What We Heard" reflection variants

**FEATURE.** Chapter 5 renders a 3-block reflection — temporal arc, what
we noticed (rule-fired bullets from `intake_flags`), and forward statement
— assembled from `whatWeHeardTemporalArc()` + `whatWeHeardBullets()` in
`IntakeForm.tsx`.

**SOURCE.** `apps/web/app/dashboard/intake/IntakeForm.tsx` — Section9 and
helpers; `WHAT_WE_HEARD_FLAG_COPY` mapping.

**RENDERED OUTPUT — Profile B (live, fired for the test member)** on
`natural-intelligence.uk/dashboard/intake`, Chapter 5.

```
CHAPTER 5 — WHAT WE HEARD

A short reflection.

Not a diagnosis. Not a verdict. Just our way of showing we were listening.

You said you last felt well more than 5 years ago, and that things shifted
around then.

WHAT WE NOTICED

• You mentioned feeling worse the day after exertion — that's a pattern
  worth examining specifically.

Your full picture goes to a practitioner with your synopsis. We'll begin
generating that now.
```

Source flag firing for this render: `flag_post_exertional_pattern`
(visible in `WHAT_WE_HEARD_FLAG_COPY` keyed by intake answer pattern).

**RENDERED OUTPUT — Profile A (energy + sleep + digestive, no clear
transition).** Not captured live in this evidence window — would require
seeding a separate member account with a different answer pattern. Render
shape is identical (temporal arc + bullets + forward statement); bullet
content would draw from whichever `intake_flags` fire (e.g.
`flag_low_energy_with_adequate_sleep`).

**RENDERED OUTPUT — Profile C (minimal — chapter still renders without
bullets).** Not captured live. Per the code path
(`whatWeHeardBullets()` returns `[]` when no flags fire), the "WHAT WE
NOTICED" section is suppressed and the chapter renders the temporal arc
+ forward statement only.

**VERIFICATION.** Profile B renders live exactly as quoted above for the
existing test member. Profile A and Profile C variants are documented by
code path and are not in this evidence pack as live captures — they
require seeding two additional member accounts which was not done in this
session.

---

## Item 7 — Save and resume

**FEATURE.** Intake state auto-persists per step; revisiting `/dashboard/intake` resumes at the previously-active step. Footer affordance link explicitly invites the user to leave and return.

**SOURCE.** `apps/web/app/dashboard/intake/IntakeForm.tsx` — auto-save
footer with "Save and continue later" link (commit `bdcaf16`).

**RENDERED OUTPUT** (Chrome DOM probe after fresh navigation to
`natural-intelligence.uk/dashboard/intake` as the test member, who had
previously completed Chapters 0–4).

```
Resume state on fresh page load:

Page title:    "Health intake — Natural Intelligence"
Active step:   Chapter 5 (the next-incomplete chapter for this user)
JourneyMap:    All 5 dots visible across the top; Chapter 5 dot
               highlighted with brand-coloured ring.
Active card:   "CHAPTER 5 — WHAT WE HEARD / A short reflection."
Footer link:   "Save and continue later"
```

Body text excerpt confirming resume position:

```
YOUR STORY → YOUR BEST → WHAT CHANGED → WHERE YOU ARE NOW → WHAT WE HEARD

You've shared everything we'd want to know to start. Before you finish,
we want to show you what we heard.

CHAPTER 5 — WHAT WE HEARD
A short reflection. Not a diagnosis. Not a verdict. Just our way of
showing we were listening.
```

**VERIFICATION.** Page resumed at the user's last-incomplete step
(Chapter 5) on a cold navigation — i.e., previously-answered Chapters 0–4
were not re-shown. The "Save and continue later" affordance is present in
the persistent footer. The journey-map dot for Chapter 5 is highlighted.
Confirms both the resume mechanism and the save-and-resume affordance
land for a real user.

---

## Item 8 — Journey map (5 dots, chapter labels, current highlighted)

**FEATURE.** Persistent journey map at the top of the intake, showing 5
chapter dots (Welcome/Chapter 0 is not represented as a dot — the dots
begin at Chapter 1 "Your Story").

**SOURCE.** `apps/web/app/dashboard/intake/IntakeForm.tsx` — `JourneyMap`
component.

**RENDERED OUTPUT** (Chrome DOM probe; current chapter = Chapter 5).

```
JourneyMap dots, left to right:

  ●          ●          ●               ●                   ●
YOUR     YOUR BEST   WHAT          WHERE YOU             WHAT WE
STORY              CHANGED          ARE NOW               HEARD

Dot 5 ("WHAT WE HEARD") rendered with the brand-coloured ring indicating
the current/active chapter. Dots 1–4 rendered as completed (filled, no
ring). All five labels render in upper-case tracking-widest type.
```

**VERIFICATION.** Confirmed: 5 dots, the five labels above, current
chapter ring on Dot 5 matching the active step. The journey map persists
across chapter transitions (verified by walking back to Chapter 1 — only
the highlighted dot changes).

---

## Summary of what's live vs. what isn't

| Item | Status |
|------|--------|
| 1 — Six chapters / framings / transitions | **Live, captured verbatim.** |
| 2 — Signature question textarea | **Live, captured.** |
| 3 — Practitioner workspace quote-back | **Live, captured.** (Care build initially errored; fix in `a8037d3` is `READY`.) |
| 4 — Body story opening references signature | **Not yet rendering.** Current trace is pre-Sprint-B (2026-05-06). Regeneration attempts during this evidence window emitted `body_story.start` x3 and at least one `body_story.failure`; no new trace row written. |
| 5 — Synopsis opening references signature | **Not yet rendering.** Current synopsis is pre-Sprint-B (2026-05-05). No regeneration attempted in this session. |
| 6 — Three "What We Heard" profiles | **1 of 3 captured live** (Profile B — post-exertional pattern). Profiles A and C documented by code path only; would require seeding additional member accounts. |
| 7 — Save and resume | **Live, captured.** Auto-resume at Chapter 5 + "Save and continue later" affordance verified. |
| 8 — Journey map | **Live, captured.** |

End of evidence pack. Per founder constraint: Phase 2 not begun.

---

# Sprint B Closure

Appended 2026-05-31 after running the closure steps from the founder
brief: diagnose body story failure → regenerate body story →
regenerate synopsis → fix duplicated chapter header (B1-F1) → seed
What We Heard profiles A and C.

## B1-F1 — Duplicated chapter header

**Root cause — two sources.** `ChapterIntro`
(`apps/web/app/dashboard/intake/IntakeForm.tsx:158-169`) renders the
"Chapter N — Title" pill above each chapter-start step. The duplicate
pill came from two distinct sites:

1. **Five `SectionHeader` call sites** at chapter starts (Section1
   line 725, ChapterBest line 1203, ChapterChanged line 1223, Chapter
   4 lines 1502 and 1527) passed `name="Chapter N — Title"`, producing
   the same pill a second time.
2. **`Section9` (Chapter 5 — What We Heard)** has its own inline
   `<p>Chapter 5 — What We Heard</p>` block rather than going through
   `SectionHeader`, so any `SectionHeader`-level suppressor missed it.

**Fix applied** (commits `0d6f551` + `882c93f`).
- In `SectionHeader`, suppress the pill when `name` begins with
  `Chapter ` (case-insensitive). Mid-chapter sections
  (`name="Deeper dive"`, `"Daily life"`, `"Medical"`, `"Mind"`, etc.)
  still render their pill.
- In `Section9`, remove the inline hardcoded pill.
- `ChapterIntro` is unchanged and continues to render the pill once at
  the top of every chapter-start step.

```ts
function SectionHeader({ name, heading, subtitle }: {...}) {
  // B1-F1 — suppress the chapter pill here when the section sits at a
  // chapter start; ChapterIntro already renders that pill above.
  const suppressNamePill = /^chapter\s/i.test(name)
  return (
    <div className="mb-6">
      {!suppressNamePill && (
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#B8935A] font-medium mb-2">
          {name}
        </p>
      )}
      <h2 …>{heading}</h2>
      <p …>{subtitle}</p>
    </div>
  )
}
```

**Verification.**
- `pnpm --filter web type-check` clean.
- `pnpm --filter web build` clean.
- `pnpm --filter care type-check` + `build` clean.
- `pnpm --filter care lint` clean. (web lint warnings pre-existing —
  three rule violations in `app/opengraph-image.tsx` and
  `app/twitter-image.tsx`, none introduced by this change.)
- Web deploy `dpl_E8atdzTHSTnVVhXoWbE3u1z7L1KD` (commit `882c93f`)
  state `READY` on `natural-intelligence.uk`.

**Visual walk — pill count per step, captured live** (Chrome `← Back`
walk from Chapter 5 back to Chapter 1, counting elements whose text
matches `/^Chapter\s\d+\s*—/`):

| Step / heading | Chapter pills |
|---|---|
| Step 10 — "A short reflection." (Chapter 5) | **1** — `Chapter 5 — What We Heard` |
| Step 9 — "One last question." (mid Ch4) | 0 |
| Step 8 — "Almost done with the body and life picture." (mid Ch4) | 0 |
| Step 7 — "Often the most important layer." (mid Ch4) | 0 |
| Step 6 — "Your health background." (mid Ch4) | 0 |
| Step 5 — "How you live day to day." (mid Ch4) | 0 |
| Step 4 — "Tell us more about your energy." (Chapter 4 start) | **1** — `Chapter 4 — Where You Are Now` |
| Step 3 — "What was happening around then?" (Chapter 3) | **1** — `Chapter 3 — What Changed` |
| Step 2 — "When did you last feel well?" (Chapter 2) | **1** — `Chapter 2 — Your Best` |
| Step 1 — "What's been on your mind most lately?" (Chapter 1) | **1** — `Chapter 1 — Your Story` |

Every chapter-start step renders the pill exactly once. Mid-chapter
steps render zero chapter pills (their own "Deeper dive" / "Daily
life" / "Mind" labels still render below the chapter pill — those are
out of `/^Chapter/` scope and unchanged). The Chapter 5 duplicate
that the closure-verification walk surfaced (count=2 against pre-fix
state) is now count=1 after `882c93f`.

**Residual cosmetic finding (not B1-F1, flagged for awareness).** On
the Chapter 5 step, `ChapterIntro.purpose` reads "A short reflection
of what you've shared. Not a diagnosis. Not a verdict. Just our way of
showing we were listening." and the Section9 subtitle reads
"A short reflection." + "Not a diagnosis. Not a verdict. Just our way
of showing we were listening." These two phrasings overlap and produce
a visible near-repeat. Not part of B1-F1 (which was specifically the
pill); flagged for the founder.

## Body story quote-back

**Diagnostic chain.**
1. Three regeneration attempts in the evidence-pack session emitted
   `body_story.start` and one `body_story.failure` in Vercel runtime
   logs, but the MCP runtime-logs tool truncates message bodies past
   ~30 chars, so the `error_code` value was not directly readable.
2. Temp debug logging was added that mirrored `prompt_head` and
   `failure_detail` into `audit_logs.metadata` so the values could be
   read back via Supabase MCP.
3. First read: `prompt_head` confirmed the signature block was being
   assembled correctly — the prompt opens with `WHAT THE USER MOST
   WANTS TO UNDERSTAND: "I want to understand why my energy collapsed
   after my second child" / This is the question they came in with.
   Open your response by acknowledging it directly — quote or
   paraphrase their words.` `failure_detail` showed
   `error_code_full: "[object Object]"` and empty stack — meaning the
   caught throw was not a plain `Error` instance.
4. Expanded error serialisation was added. Second read produced the
   true error:
   ```
   err_message:    duplicate key value violates unique constraint
                   "idx_reasoning_traces_one_active_per_case_type"
   err_serialised: code=23505, details=Key (case_id, trace_type)=
                   (cccccccc-0000-4000-8000-000000000003,
                    intake_analysis) already exists.
   ```
5. **Root cause.** The unique partial index
   `idx_reasoning_traces_one_active_per_case_type` (definition
   `(case_id, trace_type) WHERE status='client_visible'`) permits one
   `client_visible` trace per `(case_id, trace_type)`.
   `createReasoningTrace` inserted a new trace at status
   `client_visible` without demoting the existing one — every
   regeneration of body story or synopsis hit 23505 unique violation.

**Fix applied** (commit `7e8d96b`,
`packages/db/src/crt/createReasoningTrace.ts`).

```ts
// Demote any existing client_visible trace for this (case_id, trace_type)
// to 'reviewed' before inserting the new one.
const { error: demoteErr } = await supabase
  .from('reasoning_traces')
  .update({ status: 'reviewed' })
  .eq('case_id',    opts.caseId)
  .eq('trace_type', opts.traceType)
  .eq('status',     'client_visible')
if (demoteErr) throw demoteErr
```

`reasoning_traces.status` accepts `'reviewed'` (CHECK constraint
`status IN (draft, ready_for_review, reviewed, client_visible)`).
Demotion preserves the row for history; `getClientStory` only returns
`client_visible` rows so the demoted trace stops being served.

Temp debug logs and audit_logs writes removed in commit `0d6f551`.
The catch block's `errorCode` now reads `err.message` directly so
non-`Error` throws stringify cleanly (avoiding the `[object Object]`
artefact that hid the root cause originally).

`pnpm --filter @natural-intelligence/db test` passes (204/204).
Updated `createReasoningTrace.test.ts` to model the prepended demote
call.

**First three sentences of the regenerated body story** (`reasoning_trace_entries.content` for trace `5fbf151c-f415-41f0-8fb2-4db1cd576d15`, `case_id='cccccccc-0000-4000-8000-000000000003'`, `system_area='body_story'`, `visibility='client'`, generated 2026-05-31 12:51:44):

> 1. "Your symptoms are not random — they appear to be connected."
> 2. "The pattern we see centres around your hormonal and energy systems."
> 3. "From the timing you've described — energy collapsing after your second child — it looks like your body went through the significant physiological demands of a second pregnancy without fully recovering the resources it needed."

**Signature answer referenced — yes.** Sentence 3 paraphrases the
exact signature: the user's question was *"I want to understand why my
energy collapsed after my second child"*; the body story sentence 3
opens with *"From the timing you've described — energy collapsing
after your second child —"*. The paraphrase is direct and verbatim on
the key clause.

**Note on the format template.** Sentence 1 is the fixed opener
mandated by `BODY_STORY_PROMPT_BODY` in
`apps/web/app/dashboard/story/actions.ts` ("Your symptoms are not
random — they appear to be connected."). The signature reference
arrives at sentence 3 rather than sentence 1, because the BODY_STORY
format template currently constrains the opening. The model still
honours the signature instruction within the first paragraph and
weaves the user's words into the prose. If the founder wants the
acknowledgement to appear strictly at sentence 1, the format template
would need a Phase-2 revision — flagged here, not changed.

## Synopsis quote-back

**First three sentences of the regenerated synopsis** (`ai_summaries.content` for `member_id='1854aa09-d732-4627-af19-729ec18654d7'`, `summary_type='health_synopsis'`, `generated_at='2026-05-31 12:53:29'`):

> 1. "You asked about understanding why your energy collapsed after your second child, and your data offers some meaningful clues worth exploring together."
> 2. "Your overall picture suggests someone managing a known thyroid condition while experiencing persistent fatigue that isn't explained by sleep quantity alone — you're getting eight hours yet rating your energy just 3 out of 10."
> 3. "This mismatch, combined with your biomarker patterns and root cause analysis, points toward a few interconnected systems that may need attention."

**Signature answer referenced — yes, in sentence 1.** The synopsis
opens with *"You asked about understanding why your energy collapsed
after your second child"* — a near-verbatim quote of the user's
signature question. The synopsis system prompt does not impose a
rigid format template (unlike body story), so the signature
instruction lands at the opening as intended.

## What We Heard — Profile A (multi-system, no clear life transition)

**Profile inputs** (per founder brief):
- Primary concern: fatigue + digestive issues
- `timeline_last_well`: `not_sure`
- `timeline_trigger`: skipped (empty)
- Symptoms: low energy, bloating, poor sleep
- `post_exertional_worsening`: false
- `concern_severity_baseline`: moderate (5/10)
- `menstrual_flow_heaviness`: not heavy
- Short free-text answers

**Seed.** Existing test-client intake state mutated in place via
Supabase MCP:
`intake_responses.timeline_last_well` → `'not_sure'`,
`timeline_trigger` → `''`,
`intake_answers` matching `question_id='post_exertional_worsening'`
deleted, `concern_severity_baseline` lowered from 7 → 5. Originals
restored after capture.

**Live render** (captured from `natural-intelligence.uk/dashboard/intake`
Chapter 5 card, post-deploy `882c93f`, Chrome `innerText` of the
intake card div):

```
CHAPTER 5 — WHAT WE HEARD

A short reflection of what you've shared. Not a diagnosis. Not a
verdict. Just our way of showing we were listening.

A short reflection.

Not a diagnosis. Not a verdict. Just our way of showing we were listening.

You said you last felt well a long time ago.

Your full picture goes to a practitioner with your synopsis. We'll
begin generating that now.
```

(The opening "You've shared everything we'd want to know to start.
Before you finish, we want to show you what we heard." transition
banner sits above this card per chapter-transition logic.)

- Pill count: **1** (`Chapter 5 — What We Heard`).
- Block 1 (temporal arc): renders. `not_sure` maps via `LAST_WELL_LABEL`
  to `"a long time ago"`. `timeline_trigger` empty → trigger branch
  not taken. Result: **`"You said you last felt well a long time ago."`**
- Block 2 (what we noticed): **omitted**. No flag in
  `WHAT_WE_HEARD_FLAG_COPY` fires.
- Block 3 (what happens next): renders verbatim.

## What We Heard — Profile C (minimal user)

**Profile inputs** (per founder brief):
- Primary concern: one word or blank
- `timeline_last_well`: skipped
- `timeline_trigger`: skipped
- No Best Self detail
- `post_exertional_worsening`: not answered
- `concern_severity_baseline`: not high
- `menstrual_flow_heaviness`: not high
- Minimum viable completion

**Seed.** Profile A state then further mutated:
`intake_responses.timeline_last_well` → `NULL`, matching
`intake_answers` row deleted, `timeline_trigger` left empty.

**Live render** (captured Chrome `innerText` of the Chapter 5 card,
same deploy `882c93f`, intake post-Profile-C seed):

```
CHAPTER 5 — WHAT WE HEARD

A short reflection of what you've shared. Not a diagnosis. Not a
verdict. Just our way of showing we were listening.

A short reflection.

Not a diagnosis. Not a verdict. Just our way of showing we were listening.

Your full picture goes to a practitioner with your synopsis. We'll
begin generating that now.
```

- Pill count: **1** (`Chapter 5 — What We Heard`).
- Block 1 (temporal arc): **omitted**. `timeline_last_well = NULL` →
  not in `LAST_WELL_LABEL` keys → `whenLabel === ''`; `timeline_trigger`
  empty → `whatWeHeardTemporalArc` returns `''`; the surrounding
  `{arc && (...)}` collapses cleanly.
- Block 2 (what we noticed): **omitted**. No flag fires.
- Block 3 (what happens next): renders verbatim.

**Honest assessment of graceful degradation.** Profile C renders as a
two-line note: the chapter framing ("A short reflection. Not a
diagnosis. Not a verdict.") and the forward statement. No fabricated
pattern bullets, no padded temporal arc, no false confidence. This is
the correct degradation behaviour — the rules surface only what the
user actually answered, and the chapter is structurally honest about
that. A sparse intake produces a sparse reflection. The risk to watch
in future passes: if Profile-C-like sparseness becomes common, the
chapter may feel hollow rather than honest — a small Phase-2 question
("anything else?") might be a better safety net than padding the
existing rule output.

## Sprint B Phase 1 closure status

**CONDITIONAL** — closed on the three required criteria; two
non-blocking items flagged for founder.

| Criterion | Met? | Notes |
|---|---|---|
| B1-F1 duplicated header fixed | **Yes** | Live visual walk across Chapters 1-5 confirmed 1 pill per chapter start. Mid-chapter steps render 0 chapter pills. |
| Body story references signature answer | **Yes** (sentence 3) | Direct paraphrase of "energy collapsed after my second child" lands at sentence 3 of the regenerated body story. Sentence 1 is the format-template fixed opener; if founder wants sentence-1 acknowledgement, the `BODY_STORY_PROMPT_BODY` template needs a Phase-2 revision. |
| Synopsis references signature answer | **Yes** (sentence 1) | Near-verbatim quote at sentence 1 of the regenerated synopsis. |
| Profile A degrades sensibly | **Yes** | Block 1 ("a long time ago" temporal arc), Block 2 omitted (no flags), Block 3 ("Your full picture goes to..."). |
| Profile C degrades gracefully | **Yes** | Block 1 omitted, Block 2 omitted, Block 3 only. Two-line note: chapter framing + forward statement. No fabricated bullets, no padded arc. |

**Open items flagged to founder (non-blocking):**
1. **Body story sentence-1 acknowledgement.** The
   `BODY_STORY_PROMPT_BODY` format template hardcodes "Your symptoms
   are not random — they appear to be connected." as sentence 1. If
   the founder wants the signature quote to land at sentence 1 rather
   than sentence 3, the template needs revision — out of Sprint B
   Phase 1 scope.
2. **Chapter 5 subtitle near-duplicate.** `ChapterIntro.purpose` and
   `Section9` h2+subtitle both phrase "A short reflection... Not a
   diagnosis. Not a verdict. Just our way of showing we were
   listening." The pill duplicate is fixed (B1-F1); the
   subtitle/purpose near-overlap is a separate cosmetic finding,
   flagged for awareness.
3. **`createReasoningTrace` concurrency.** The demote-then-insert
   pattern is not transactional — two concurrent regenerations for
   the same case could race. Not observed in this evidence chain;
   noted for awareness.

