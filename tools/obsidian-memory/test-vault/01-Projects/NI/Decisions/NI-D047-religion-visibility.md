---
type: decision
project: NI
status: active
created: 2026-05-12
updated: 2026-05-12
id: NI-D047
tags:
  - ni
  - personalisation
  - practitioner
  - rls
---

# NI-D047 — Religion is captured but never shown to practitioners

**Decision.** The member's `religion` and `religious_content_preference` fields are stored in `user_personalisation` and consumed by AI generation paths (the Islamic-framing gate). They are NEVER surfaced in the practitioner workspace — by design.

**Rationale.** Religion is sensitive personal context that the member shares with the platform for content framing, not with the human practitioner. Surfacing it in a clinical setting introduces bias risk and changes the nature of the disclosure.

**Consequences.**
- `ClientPersonalisation` type does NOT include religion fields.
- `getClientPersonalisation` SQL `select` does not include them.
- AI prompt assembly fetches them via `getPersonalisationForGeneration` (server-only).
- Practitioner workspace shows biological sex + free-text clinical notes only.
