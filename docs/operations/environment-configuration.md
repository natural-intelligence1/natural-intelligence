# Required Vercel environment configuration

Written 6 November 2026 (Mission 20). Covers the two variables this mission
introduces or depends on, and what happens when each is absent.

**No secret values appear in this document, in any fixture, log or test.**

---

## 1. `AI_INTERPRETATION_ENABLED` — the interpretation hold

| | |
|---|---|
| Read by | `isAiInterpretationEnabled()`, `packages/db/src/ai/interpretationFlag.ts` |
| Enforced in | `generateHealthSynopsis()` and `generateBodyStory()`, as their first statement |
| Accepted value | the exact string `true`. Nothing else enables it |
| Default | **unset = HELD** |
| Scope | server-side only. It must NOT be given a `NEXT_PUBLIC_` name |

### Action required to activate the hold: **none.**

The flag is default-off, so merging the guard holds generation in every
environment — Production, Preview and local — without setting anything
anywhere. A missing variable, a typo, a new Preview environment and a brand
new deployment all fail closed. That is the point.

### To release the hold later, once Legal/MHRA review concludes

1. In Vercel → the `web` project → Settings → Environment Variables, add
   `AI_INTERPRETATION_ENABLED` with the value `true`, scoped to the
   environments being released (Production and/or Preview — they are
   independent).
2. **Redeploy.** Environment variables are read at runtime by the serverless
   function, but a redeploy is the only way to be certain every running
   function picks the new value up.
3. Verify by observation, not by assumption: a held generation logs
   `{"event":"health_synopsis.held"}` / `{"event":"body_story.held"}`. Those
   lines must stop appearing.

`"1"`, `"TRUE"`, `"True"`, `"yes"`, `" true"` and `"true "` all leave the hold
in place. This matches `INTAKE_COLLECTION_ENABLED` and
`INTAKE_ASSIGNMENT_ENABLED`, which use the same exact-string rule — a
different rule here would be a trap for whoever sets it.

### What the hold does and does not stop

| | |
|---|---|
| Raw Intake collection | **UNAFFECTED.** Questions, `assertIntakeCollectionEnabled()`, and the `intake_answers` / `intake_responses` writes all continue |
| New synopsis on intake completion | Held |
| User-clicked "Regenerate" / "Try again" | Held — same generator |
| New body story / reasoning traces | Held |
| Existing `ai_summaries` and `reasoning_traces` | Untouched and still readable |
| Biohub lab-report parsing | Unaffected. Separate pipeline, not Intake-derived, not named in the ruling |

---

## 2. `SIGNUP_CONSENT_SECRET` — the consent payload HMAC key

| | |
|---|---|
| Read by | `packages/db/src/consent/signupPayload.ts` |
| Purpose | HMAC-SHA256 over the signup consent decision carried in `auth.users.raw_user_meta_data` |
| Minimum length | 32 characters (`SIGNUP_CONSENT_SECRET_MIN_LENGTH`). Shorter is treated as absent |
| Default | **unset = FAIL CLOSED** |
| Scope | server-side only, Node runtime. It must NOT be given a `NEXT_PUBLIC_` name, and must never be imported from Edge middleware |

### Dedicated, with no fallback

An earlier draft derived this key from `SUPABASE_SERVICE_ROLE_KEY` so that no
new variable would be needed. **That was rejected on Orchestrator review** for
cryptographic purpose separation and to limit blast radius: one key must not
silently underwrite a second purpose, and rotating database credentials must
not invalidate consent evidence — nor the reverse.

There is therefore:

- no fallback to `SUPABASE_SERVICE_ROLE_KEY` or any other privileged credential;
- no hardcoded development default;
- no weak default of any kind.

A unit test asserts the service-role key is never used, so the rejected design
cannot creep back in.

### Behaviour when it is absent — fail closed, and still correct

| Stage | What happens |
|---|---|
| Signup | No signed payload is created. Signup itself still succeeds; the member's account is created normally |
| Email confirmation | Nothing to verify, so nothing is persisted |
| First authenticated entry | `ensureFoundationalConsents()` reports the consent as missing, and the member is shown the re-affirmation gate |
| Consent recorded | Current wording, real current timestamp, `source='reaffirmation'` |

So a missing secret costs one extra screen. It never records a consent that
was not given, and it never blocks access to Privacy or Data Rights.

### To configure

1. Generate at least 32 random characters with a CSPRNG. Do not reuse any
   existing key, and do not derive it from one.
2. Add `SIGNUP_CONSENT_SECRET` in Vercel → the `web` project → Settings →
   Environment Variables, for each environment that should sign payloads.
3. Local development: add it to `apps/web/.env.local`, which is gitignored.
4. Redeploy.

### Rotation

Rotation is safe and needs no migration. Payloads signed with the previous key
fail verification with `bad_signature`, and those members are routed to the
same re-affirmation gate — one extra screen, no lost or forged consent.
Payloads already persisted as `consent_records` rows are unaffected, because
the signature protects the carrier, not the stored row.

### Preview environments

Preview deployments share the Production database. A Preview without the
secret simply gates members to re-affirmation; a Preview *with* a different
secret from Production will reject payloads created on the other, which again
degrades to the gate rather than to a wrong record.

---

## 3. Variables this mission deliberately did NOT change

| Variable | State | Why |
|---|---|---|
| `INTAKE_COLLECTION_ENABLED` | untouched | Explicit Founder decision from September: collection stays open |
| `INTAKE_ASSIGNMENT_ENABLED` | untouched | Must remain off. The literal value is unread from here; treat practitioner routing as disabled |
| `ANTHROPIC_API_KEY` | untouched | Removing it was assessed and rejected as the containment mechanism: over-broad (it also breaks Biohub) and it fails by throwing rather than by a calm held state |
