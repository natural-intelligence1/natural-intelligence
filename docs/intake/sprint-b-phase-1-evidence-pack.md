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
