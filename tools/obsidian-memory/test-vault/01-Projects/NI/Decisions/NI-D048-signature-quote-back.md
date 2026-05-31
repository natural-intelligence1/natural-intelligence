---
type: decision
project: NI
status: active
created: 2026-05-30
updated: 2026-05-31
id: NI-D048
tags:
  - ni
  - intake
  - ai-generation
  - sprint-b
---

# NI-D048 — Signature question must be quoted back in body story and synopsis

**Decision.** Every AI-generated artefact produced from a member's intake (body story, health synopsis) must acknowledge — verbatim or near-verbatim — the question they typed into the Chapter 1 signature textarea (`intake_responses.most_want_to_understand`).

**Rationale.** A question the platform asks and then ignores is worse than not asking it. The signature question is the single sentence the member came in with; if no output references it, the platform's promise of personalisation breaks at the most visible surface.

**Consequences.**
- `buildSignatureQuestionBlock` prepended to the system prompt for body story and synopsis generation.
- Practitioner workspace surfaces the same quote in "In their own words".
- Body-story sentence-1 acknowledgement is currently blocked by the `BODY_STORY_PROMPT_BODY` format template — flagged as a Phase-2 open item.
