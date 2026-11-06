# Signup consent — confirmed defect and architecture recommendation

**Status: IMPLEMENTED 6 Nov 2026** (Mission 19, architecture approved by the
Founder). Not merged to `main` and not deployed to Production.
Raised 5 Nov 2026, re-confirmed against the live database and live code 6 Nov 2026.

### What was built

| File | Change |
|---|---|
| `packages/db/src/consent/purposes.ts` | Texts moved into a frozen `CONSENT_TEXT_ARCHIVE` keyed by version; `resolveConsentText(version, purpose)` **fails closed** (returns null) on an unarchived version. `CONSENT_TEXTS` kept as the current-version alias so no caller changed |
| `packages/db/src/consent/signupPayload.ts` | **New.** HMAC-SHA256 signed payload: `pv`, `sub_email`, `purposes`, `version`, `decided_at`, `nonce`, `sig` |
| `packages/db/src/consent/foundational.ts` | **New.** `persistSignupConsentFromMetadata`, `getFoundationalConsentState`, `ensureFoundationalConsents`, `recordFoundationalReaffirmation`, `markSignupConsentConsumed` |
| `apps/web/app/actions/auth-signup.ts` | Doomed anon INSERT **removed**; signed payload attached to `signUp` metadata; misleading "sign in to try again" message gone |
| `apps/web/app/auth/callback/route.ts` | Persists after `exchangeCodeForSession`; surfaces Supabase's own `error_description`; calm non-technical failure message |
| `apps/web/app/login/page.tsx` | Forwards the whole query string instead of dropping it |
| `apps/web/middleware.ts` | Sets `x-ni-pathname` / `x-ni-search` so the layout can exempt Privacy and Data Rights |
| `apps/web/app/dashboard/layout.tsx` | Calls `ensureFoundationalConsents`; renders the gate for non-exempt routes |
| `apps/web/app/dashboard/_components/ConsentReaffirmationGate.tsx` + `consent-gate-actions.ts` | **New.** The re-affirmation gate |
| `apps/web/lib/consentGate.ts` | **New.** `isConsentGateExempt()` — the "Privacy stays reachable" rule, unit-tested |

**Tests:** 36 new unit tests (`signupPayload.test.ts` 20, `consentArchive.test.ts` 16),
plus `consentGate.test.ts` (6) and `consentCopyDrift.test.ts` (2) in the web app.
Full suites green: **879 db** / **117 web**. Both packages type-check clean.

### Finding while building the archive: `s3-draft-1` was unresolvable

Building the catalogue exposed something the brief did not anticipate. Five
live `consent_records` rows reference version **`s3-draft-1`** (13 September
2026, the September member's granular intake consents). That version existed
**nowhere in code** — `CONSENT_TEXTS` only ever held the current wording — so
`version = 's3-draft-1'` could not be resolved at all. The exact text was
retrievable only because the `consent_text` column stores it verbatim per row.

It has been recovered into the archive from those rows and verified
**byte-for-byte against the database** (md5 and length per purpose, asserted in
`consentArchive.test.ts`), so the recovery cannot drift from the evidence.

Three of the five were materially reworded in `s3-draft-2`, which is the case
for the archive in one line:

| Purpose | `s3-draft-1` | `s3-draft-2` |
|---|---|---|
| `anonymised_research` | "Anonymised means I **cannot be identified** from it." | "anonymised so that I am **not reasonably identifiable**" |
| `retention_beyond_episode` | "I may withdraw this at any time." | adds the legal/professional/complaints/insurance retention caveat |
| `deidentified_synopsis_sharing` | short form | adds self-serve vs practitioner-led pathway separation, and pseudonymous-not-anonymous |

Had the resolver fallen back to current wording, those five rows would have
silently claimed the member accepted the *weaker* anonymisation promise and the
*longer* retention caveat. They did not. `platform_terms` and
`data_processing` were not versioned at `s3-draft-1`, so they resolve to null
there rather than borrowing today's text.

**Deliberately NOT done:** no anon INSERT policy, no service-role consent
write, no change to email confirmation, no DB constraint added (see §3.5), no
historical acceptance fabricated for existing accounts.

---

## 1. The live code path, re-confirmed

| Step | Where | What happens |
|---|---|---|
| 1 | `apps/web/app/actions/auth-signup.ts:7` | `createServerSupabaseClient()` — the **anon-key** `@supabase/ssr` client (`packages/db/src/server.ts`) |
| 2 | `auth-signup.ts:19` | `supabase.auth.signUp({ email, password, options: { data: { full_name } } })` |
| 3 | — | Email confirmation is required, so `signUp()` returns a **user and no session**. The client is still the `anon` role. |
| 4 | `auth-signup.ts:44` | `recordSignupConsents(supabase, …)` → `INSERT INTO consent_records` (`packages/db/src/consent/records.ts:105`) |
| 5 | — | RLS refuses. `consent_records` has RLS enabled and its only INSERT-capable policies are `Members create own consent records` (`TO authenticated WITH CHECK (profile_id = auth.uid())`) and the `is_admin()` admin policy. Neither matches `anon`. The row-level check fails with `42501`. |
| 6 | `records.ts:108` | `42501` is not in `MISSING_COLUMN_CODES` (`PGRST204`, `42703`), so the helper correctly returns `{ ok: false }` rather than swallowing it. |
| 7 | `auth-signup.ts:53` | Fails closed and redirects with *"Your account was created, but we could not record your consent, so setup did not finish."* |

### Evidence from the live database (6 Nov 2026)

- `consent_records` grouped by `source`: `intake_start` → 10 rows; `(null)` → 2 rows (5 Apr 2026). **`signup_form` → zero rows, ever.**
- Email confirmation is required *today*: of 10 `auth.users`, the five auto-confirmed-at-creation rows all have `confirmation_sent_at IS NULL` — they are the service-role-created synthetic practitioners. Every account created through the signup form (4 users in April, 1 on 4 Nov 2026) received a confirmation email and was confirmed **later**. The 4 Nov account was confirmed one minute after creation.
- So the defect is live and reproducible, and the 4 Nov account is a worked example of it.

### Why it has stayed invisible

Nothing gates on `platform_terms` or `data_processing`. Only the granular
`REQUIRED_INTAKE_CONSENTS` are checked, and those are written later from the
intake gate in a normal authenticated session — which works, hence 10
`intake_start` rows. The account therefore looks healthy while NI holds no
evidence the user accepted the terms.

The message is also misleading: *"Please sign in to try again"* implies a retry
path. **No code path retries the signup consents.** Signing in does nothing.

---

## 2. Assessment of the short-lived signed-cookie approach

Assessed as asked, then **not recommended** — it fails on one requirement.

| Question | Signed cookie |
|---|---|
| **Payload fields** | `profile_id`, `platform_terms: true`, `data_processing: true`, `consent_version`, `decided_at`, `nonce` |
| **Signing mechanism** | HMAC-SHA256 over the canonical JSON using a server-only secret; `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/auth/callback` |
| **Expiry** | `Max-Age` matched to the Supabase confirmation-link lifetime (24 h by default), plus an `exp` claim inside the signed payload so expiry is signed, not merely advisory |
| **Tamper protection** | Good. `httpOnly` keeps it out of page scripts; the HMAC makes any edit detectable; the `exp` inside the signature stops extension by cookie-jar editing |
| **Replay / idempotency** | Needs a `SELECT` before insert (the member can read their own rows), then `ON CONFLICT DO NOTHING`. The cookie is cleared on success. Replay after clearing is possible until `exp`, which is why the pre-check is required, not optional |
| **Callback on another browser/device** | ❌ **FAILS.** The cookie is bound to the browser that submitted the form. Confirming the email on a phone — the common case — produces a session with no cookie, so no consent is written and the account is left in exactly today's broken state. |
| **If the callback never occurs** | Benign. No session is ever issued, the account is unusable, nothing is collected. The cookie expires. |
| **Timestamp semantics** | Correct if `decided_at` is carried in the payload and written to `consented_at`, leaving `created_at` (which defaults to `now()`) as the persistence time. Both are already columns on the table |
| **Duplicate callback / retry** | Safe *given* the pre-check; without it, duplicate rows, because `consent_records` has **no unique constraint** — only `consent_records_pkey` on `id` |

**Verdict: not robust.** Everything about it is sound except the thing that
matters most. Email confirmation is routinely completed on a different device
from the one that signed up, and on that path this design silently reproduces
the current defect. A consent mechanism that works only when the user happens to
confirm in the same browser is not a consent mechanism.

---

## 3. Recommended architecture — carry the decision on the user, not the browser

Carry the consent decision in **`auth.users.raw_user_meta_data`**, set
server-side at `signUp()`, and persist the rows in `/auth/callback` once a
session exists.

This is device-independent because the carrier is the user record, not the
browser.

### Why this is the right carrier

It is **already the live mechanism in this codebase, demonstrably working
end to end**:

- `auth-signup.ts:22-24` already passes `options: { data: { full_name } }`.
- `handle_new_user()` in the live database reads it:
  `COALESCE(NEW.raw_user_meta_data->>'full_name', '')`.

So this proposal adds no new transport. It puts two more fields through a path
that is already carrying one.

### 3.1 Payload

Set at `signUp()`:

```ts
options: {
  data: {
    full_name: fullName,
    signup_consent: {
      platform_terms: true,
      data_processing: true,
      version:    CONSENT_TEXT_VERSION,   // the version actually shown
      decided_at: now,                    // the decision moment
      sig:        hmac,                   // see 3.2
    },
  },
}
```

The consent **text** is deliberately not carried — it is long, and the server
holds it. It does mean `CONSENT_TEXTS` must become version-addressable
(`CONSENT_TEXTS_BY_VERSION`) so that a user who confirms after the catalogue has
moved on gets the row they were actually shown, not today's wording. That is a
code change in `packages/db/src/consent/purposes.ts`, not a schema change.

### 3.2 Integrity

`raw_user_meta_data` is writable by the user themselves via `updateUser()` once
they hold a session, so the payload is signed:

```
sig = HMAC-SHA256(secret, canonicalJSON({ sub, platform_terms, data_processing, version, decided_at }))
```

The callback recomputes and compares before persisting. A user cannot forge a
decision they did not make, and cannot back-date one.

Three further reasons tampering is not a live risk:

1. The callback consumes the payload on the **first** authenticated request — before the user can realistically call `updateUser()`.
2. Once the rows exist the payload is ignored, so later edits change nothing.
3. The server accepts only `true`. A tampered `false` yields no row, which fails closed.

The asymmetry worth stating: a user forging *their own* consent harms only
themselves. The risk that matters evidentially is a user later denying consent,
and against that the defence is a server-written row carrying the version, the
text and two timestamps — which tampering cannot retroactively create.

### 3.3 Persistence point

`apps/web/app/auth/callback/route.ts:11`, immediately after
`exchangeCodeForSession(code)` succeeds — the first moment a session exists.
The write then goes through the **existing** `Members create own consent
records` policy as the authenticated user. No RLS change, no anon policy, no
service-role write, no change to email confirmation.

### 3.4 Timestamps

| Column | Value | Meaning |
|---|---|---|
| `consented_at` | `signup_consent.decided_at` | when the user actually decided |
| `created_at` | `now()` (column default) | when NI persisted the evidence |

Both columns already exist. The gap between them is itself useful evidence, and
is not hidden.

### 3.5 Idempotency

`consent_records` has **no unique constraint**, so duplicate-callback safety is
explicit: `SELECT` the member's own `signup_form` rows first (permitted by
`Users can view own consent records`) and skip if present. The write is
wrapped so that a double-click, a refreshed callback URL or a retried request
yields one row per purpose, not two.

### The exact uniqueness key — NO DB CONSTRAINT ADDED

As implemented, the replay guard is an **application-level pre-check**, not a
constraint. The key it uses:

```
(profile_id, consent_type, consent_version)  WHERE source = 'signup_form'
```

`source` is inside the key deliberately. A signup payload records **one
historical decision**; if a row for that triple already exists *from signup*,
the decision is on file and must not be written again — including when the
member has since withdrawn it, because replaying a stale payload would
silently re-grant something they revoked. A later genuine re-consent to the
same version arrives through the gate under `source='reaffirmation'` and is
therefore free to append.

Proof it permits all three required behaviours:

| Must permit | Why it does |
|---|---|
| **Future consent versions** | `consent_version` is in the key, so a `s4-final` grant coexists with the member's `s3-draft-2` grant. A version bump appends; it never collides |
| **Withdrawal / re-consent history** | Withdrawal sets `withdrawn_at` on the existing row — an UPDATE, not an insert, so it cannot collide. Re-consent is written with `source='reaffirmation'`, which the `WHERE` excludes entirely. Rows are never deleted, so the full sequence grant → withdrawal → re-grant survives |
| **Separate consent purposes** | `consent_type` is in the key, so `platform_terms` and `data_processing` are independent, as are the five granular intake purposes |

**Canonical dimensions deliberately excluded**, and the condition on that:
`consent_records` also carries `organisation_context` and
`context_practitioner_id`. Both are **NULL in every live row** (0 rows with
either set), and foundational consents are NI-wide rather than
practitioner-scoped — `platform_terms` is not granted *to* a practitioner. So
the key omits them. **If NI ever records a foundational consent per
organisation, this key must gain `organisation_context` first**, or two
organisations' grants would wrongly collide.

Practitioner-scoped consents are a separate matter and are already kept out of
`ConsentPurpose` for exactly this reason — see `practitionerAccess.ts`.

**If the Founder later wants this as a database guarantee:**

```sql
CREATE UNIQUE INDEX consent_records_signup_grant_idx
  ON public.consent_records (profile_id, consent_type, consent_version)
  WHERE source = 'signup_form';
```

Safe to build today: there are **zero** `source='signup_form'` rows in the live
table, and the 10 `intake_start` rows plus 2 legacy NULL-source rows are all
excluded by the `WHERE`. Not applied — the Founder is deciding the constraint
separately, and the app-level guard is complete without it.

### 3.6 Callback never occurs

Nothing to remediate. No session is ever issued, so the account cannot be used
and no health data can be collected under it. One April account is in exactly
this state today. Pruning long-unconfirmed accounts is a separate housekeeping
decision.

### 3.7 Backstop for legacy and edge cases

`ensureFoundationalConsents()` on first authenticated entry (the dashboard
layout). If the rows are absent **and** no valid signed payload is available, it
routes once to a single re-affirmation screen rather than guessing. This is also
the remediation path for every existing account — all of which currently hold no
`signup_form` evidence.

### 3.8 Two small corrections found while reading this path

1. `auth-signup.ts:53-56` — the *"Please sign in to try again"* wording should stop promising a retry that does not exist.
2. `auth/callback/route.ts:17` — the failure branch redirects to `/login?error=Auth+callback+failed`. `/login` exists and redirects to `/auth/login`, so the page resolves correctly, but `apps/web/app/login/page.tsx` calls `redirect('/auth/login')` with no query string, so **the error message is silently dropped**. A user whose confirmation link failed arrives at a blank login form with no explanation. Redirecting straight to `/auth/login?error=…` fixes it.

---

## 4. Does this need a schema change?

**No.** The fix is app-level only:

- `auth-signup.ts` — add the signed `signup_consent` payload to `signUp` metadata; stop attempting the doomed anon insert.
- `auth/callback/route.ts` — verify the payload and persist the rows after `exchangeCodeForSession`.
- `packages/db/src/consent/` — a version-addressable text catalogue, an HMAC helper, `ensureFoundationalConsents()`.

RLS is untouched and nothing is weakened. The one optional index in §3.5 is a
hardening, not a requirement.
