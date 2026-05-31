---
type: current-state
project: NI
status: active
created: 2026-04-01
updated: 2026-05-31
tags:
  - ni
  - sprint-b
---

# NI — Current State (2026-05-31)

Sprint B Phase 1 is closed. Production deploy `dpl_2JqTpkDriytfeBftpusUVeLrkycg` (commit `e6f9e92`) is live on `natural-intelligence.uk`. The intake journey runs across six chapters with a signature question that is now quoted back in both the body story and the synopsis.

## Built
- Six-chapter intake framework with chapter intros, transitions, and journey-map dots
- Signature question textarea (`intake_responses.most_want_to_understand`) wired through to generation prompts
- Practitioner workspace "In their own words" panel
- Personalisation Substrate (biological sex, religion gate) — feeds AI prompts
- `createReasoningTrace` demote-before-insert so regeneration succeeds
- Shared `GeneratingState` client component (timer + failure UI on synopsis + story pages)

## Blocked
- Phase 2 question-copy rewrites — awaiting founder approval

## Open decisions

- Whether the body-story sentence-1 acknowledgement requires a `BODY_STORY_PROMPT_BODY` template revision (currently signature lands at sentence 3)
- Chapter 5 subtitle vs. ChapterIntro purpose near-duplicate — cosmetic, fix in Phase 2?
- `createReasoningTrace` demote-then-insert transactionality — observed safe so far, document or harden?

## Next three actions

1. Begin Phase 2 question-copy rewrites once founder approves
2. Decide on body-story sentence-1 template revision
3. Add a brief Chapter-5 subtitle fix if the founder wants cosmetic polish before Phase 2
