# Practitioner lifecycle and client-practitioner link operations

Runbook version: G.1.3d — 2026-05-06  
Applies to: v1 (admin UI not yet built; all operations are SQL via Supabase dashboard or psql)

---

## 1. Architecture context

NI is a curated practitioner network, not an open marketplace. Every practitioner is individually vetted and activated by NI admin. There is no self-service signup that grants portal access.

**Status is the access gate.** The practitioners table in Postgres is the source of truth for whether a practitioner can use the care app. Middleware in `apps/care` reads `practitioners.status` on every request to `/cases/**`. It does not cache, does not use JWT claims, and does not escalate to service-role for this check — it reads the live DB row using the practitioner's authenticated session. A suspension or archive takes effect on the practitioner's next request, typically within one or two seconds.

**Status lifecycle:** `pending_review` → `approved` → `active` → `suspended` (reversible) or `archived` (terminal).

**JWT expiry does not protect a suspended practitioner.** The middleware enforces status on every request regardless of whether the JWT is still valid. A practitioner whose status is `suspended` will be redirected to `/care/suspended` even if their token has not expired.

**Practitioners do not own clients.** The relationship between a practitioner and a client is a separate record in `client_practitioner_links`. A practitioner can be removed from a client's care team independently of their account status. The `control_level` field on the link records the nature of the relationship and the level of protection it carries. See sections 6 and 7.

**The practitioner-led client invitation flow is not active in v1.** When a practitioner brings a client to NI, admin creates the link manually (section 6, Scenario A). There is no system-generated referring-practitioner relationship yet.

---

## 2. Onboarding a new practitioner

**Pre-conditions:**
- The practitioner has a Supabase auth account. Create it via the Supabase dashboard (Authentication → Users → Invite user or Add user), or it may already exist if they signed up via a web form.
- You have their `auth.users.id` (UUID shown in the dashboard user list).
- You have your own admin UUID for audit fields.

---

```sql
-- STEP 1: Verify the auth user exists
SELECT id, email, created_at
FROM auth.users
WHERE id = '<practitioner-auth-uuid>';
```

```
-- Expected: exactly one row with their email and creation date.
-- If no rows: the auth account does not exist. Create it first in
-- the Supabase dashboard before proceeding.
```

---

```sql
-- STEP 2: Set profile role to 'practitioner'
--
-- When any auth user is created, a trigger (on_auth_user_created)
-- automatically inserts a row into public.profiles with role='user'.
-- You must update this to 'practitioner' before the care app will
-- treat them correctly in any role-aware logic.

UPDATE public.profiles
SET role = 'practitioner'
WHERE id = '<practitioner-auth-uuid>';
```

```sql
-- Verification:
SELECT id, role, full_name
FROM public.profiles
WHERE id = '<practitioner-auth-uuid>';
-- Expected: role = 'practitioner'
-- If no row exists: the trigger may not have fired (possible for
-- admin-API-created users depending on method). Insert manually:
--   INSERT INTO public.profiles (id, role, full_name)
--   VALUES ('<practitioner-auth-uuid>', 'practitioner', '<their name>');
```

---

```sql
-- STEP 3: Create the practitioners row
--
-- Insert with status='approved' (not 'pending_review') because
-- admin is performing the onboarding and has already done the human
-- review. Set verified_by and verified_at to record who approved them
-- and when.
--
-- Populate as many profile fields as you have available.
-- display_name is the only NOT NULL field without a default.
-- Fields marked OPTIONAL can be left out and filled in later.

INSERT INTO public.practitioners (
  id,
  status,
  display_name,
  verified_by,
  verified_at,

  -- OPTIONAL — fill in where known; leave out if not yet available:
  -- bio,
  -- credentials_summary,
  -- specialisations,        -- text[], e.g. ARRAY['gut_health', 'hormones']
  -- primary_professions,    -- text[], e.g. ARRAY['nutritional_therapist']
  -- area_tags,              -- text[], e.g. ARRAY['metabolic_health']
  -- modalities,             -- free text, e.g. 'Functional medicine, NLP'
  -- city,
  -- country,
  -- years_experience,       -- integer
  -- currently_seeing_clients, -- boolean
  -- accepts_referrals,      -- boolean, defaults true
  -- open_to_collaboration,  -- boolean, defaults false
  -- practice_name,
  -- tagline,
  -- website_url,

  practitioner_tier,          -- 'standard' or 'featured'
  trust_level                 -- 'unvetted' or 'vetted'
                              -- Use 'vetted' only if credentials have
                              -- been independently verified.
)
VALUES (
  '<practitioner-auth-uuid>',
  'approved',
  '<display name>',
  '<your-admin-uuid>',
  now(),

  'standard',
  'unvetted'
);
```

```sql
-- Verification:
SELECT id, status, display_name, verified_by, verified_at, practitioner_tier
FROM public.practitioners
WHERE id = '<practitioner-auth-uuid>';
-- Expected: status = 'approved', verified_at is populated
```

---

```sql
-- STEP 4: Activate the practitioner
--
-- Activation is a separate step so you can review the row before
-- granting care app access. Once activated, they can log in and
-- reach /cases immediately.

UPDATE public.practitioners
SET status = 'active'
WHERE id = '<practitioner-auth-uuid>';
```

```sql
-- Verification:
SELECT id, status, is_active
FROM public.practitioners
WHERE id = '<practitioner-auth-uuid>';
-- Expected: status = 'active', is_active = true
-- (is_active is maintained automatically by a trigger; do not set it manually)
```

---

```sql
-- STEP 5: Final verification — confirm the full picture
SELECT
  u.email,
  pr.role        AS profile_role,
  p.status,
  p.display_name,
  p.is_active,
  p.practitioner_tier,
  p.trust_level,
  p.verified_at
FROM public.practitioners  p
JOIN public.profiles        pr ON pr.id = p.id
JOIN auth.users             u  ON u.id  = p.id
WHERE p.id = '<practitioner-auth-uuid>';
-- Expected:
--   profile_role   = 'practitioner'
--   status         = 'active'
--   is_active      = true
--   verified_at    is not null
```

The practitioner can now sign in and access the care portal.

---

## 3. Suspending a practitioner

**When to use:** temporary access removal — complaint under investigation, contract renewal pending, requested leave of absence. Use suspension when the situation may reverse. Use archive (section 5) when it won't.

`suspension_reason` is mandatory. Future audit review depends on it. Do not suspend without a reason.

```sql
-- SUSPEND
UPDATE public.practitioners
SET
  status            = 'suspended',
  suspended_by      = '<your-admin-uuid>',
  suspended_at      = now(),
  suspension_reason = '<reason — be specific: e.g. "complaint under investigation ref #123">'
WHERE id = '<practitioner-auth-uuid>';
```

```sql
-- Verification:
SELECT status, suspended_at, suspension_reason
FROM public.practitioners
WHERE id = '<practitioner-auth-uuid>';
-- Expected: status = 'suspended', suspended_at and suspension_reason populated
```

**Effect:** the practitioner's next request to `/cases/**` will redirect to `/care/suspended`. This takes effect within seconds — no JWT expiry delay. Their existing `case_practitioner_work` assignments are preserved for audit. Work items are not cancelled; they will resume if the practitioner is reinstated.

---

## 4. Reinstating a suspended practitioner

Reinstatement sets status back to `active` and clears the suspension fields.

```sql
-- REINSTATE
UPDATE public.practitioners
SET
  status            = 'active',
  suspended_by      = NULL,
  suspended_at      = NULL,
  suspension_reason = NULL
WHERE id = '<practitioner-auth-uuid>'
  AND status = 'suspended';  -- guard: only reinstate if currently suspended
```

```sql
-- Verification:
SELECT status, suspended_at, suspension_reason, is_active
FROM public.practitioners
WHERE id = '<practitioner-auth-uuid>';
-- Expected: status = 'active', is_active = true, suspension fields NULL
```

Their care app access resumes on their next request.

---

## 5. Archiving a practitioner (terminal)

**When to use:** the practitioner has left the network — resignation, contract ended, removed for cause.

`archive_reason` is mandatory. Do not archive without a reason.

```sql
-- ARCHIVE
UPDATE public.practitioners
SET
  status         = 'archived',
  archived_by    = '<your-admin-uuid>',
  archived_at    = now(),
  archive_reason = '<reason — e.g. "contract ended 2026-04-30, mutual agreement">'
WHERE id = '<practitioner-auth-uuid>';
```

```sql
-- Verification:
SELECT status, archived_at, archive_reason, is_active
FROM public.practitioners
WHERE id = '<practitioner-auth-uuid>';
-- Expected: status = 'archived', is_active = false, archive fields populated
```

**Effect:**
- Their next request redirects to `/care/access-revoked`.
- Their `case_practitioner_work` assignments are preserved for audit but they cannot action them.
- Their `client_practitioner_links` are not ended automatically — do this as a follow-up using section 8 for each active link.

**Archive is intended to be terminal.** There is no "unarchive" SQL in this runbook. If you genuinely need to reactivate an archived practitioner, that is significant enough to treat as a fresh onboarding rather than a status flip. Re-insert into `practitioners` and follow section 2 from Step 3.

---

## 6. Creating a client-practitioner link

A link connects a practitioner to a client for an ongoing care relationship. This is separate from one-off case work.

**Database constraint:** there can be only one active `lead` per client at a time (`idx_cpl_one_active_lead`). There can be only one active link per practitioner-client pair at a time (`idx_cpl_one_active_per_pair`). Violating either will produce a unique-constraint error. If you need to change the lead, end the existing lead link first (section 8), then create the new one.

---

### Scenario A — Practitioner brings a client to NI

The practitioner referred this client to NI. This is the protected relationship.

```sql
-- SCENARIO A: practitioner-originated link
INSERT INTO public.client_practitioner_links (
  client_id,
  practitioner_id,
  connection_type,
  role,
  control_level,
  creation_actor,
  created_by
)
VALUES (
  '<client-auth-uuid>',
  '<practitioner-auth-uuid>',
  'brought_by_practitioner',
  'lead',
  'keep',          -- protected; see section 7
  'admin',         -- admin acting on the practitioner's behalf in v1
  '<your-admin-uuid>'
);
```

```sql
-- Verification:
SELECT id, connection_type, role, control_level, created_at
FROM public.client_practitioner_links
WHERE client_id = '<client-auth-uuid>'
  AND practitioner_id = '<practitioner-auth-uuid>'
  AND ended_at IS NULL;
-- Expected: one row, control_level = 'keep'
```

---

### Scenario B — NI assigns a practitioner to a client

Admin is connecting a practitioner to a client based on NI's matching decision.

```sql
-- SCENARIO B: admin-assigned link
INSERT INTO public.client_practitioner_links (
  client_id,
  practitioner_id,
  connection_type,
  role,
  control_level,
  creation_actor,
  created_by
)
VALUES (
  '<client-auth-uuid>',
  '<practitioner-auth-uuid>',
  'assigned_by_admin',
  'lead',          -- or 'specialist' depending on case complexity
  'flexible',      -- or 'one_off' for a short-term, scoped engagement
  'admin',
  '<your-admin-uuid>'
);
```

```sql
-- Verification:
SELECT id, connection_type, role, control_level, created_at
FROM public.client_practitioner_links
WHERE client_id = '<client-auth-uuid>'
  AND practitioner_id = '<practitioner-auth-uuid>'
  AND ended_at IS NULL;
-- Expected: one row
```

---

### Scenario C — Client selects a practitioner from the directory

The client chose this practitioner. Admin records it until client self-service exists.

```sql
-- SCENARIO C: client-selected link
INSERT INTO public.client_practitioner_links (
  client_id,
  practitioner_id,
  connection_type,
  role,
  control_level,
  creation_actor,
  created_by
)
VALUES (
  '<client-auth-uuid>',
  '<practitioner-auth-uuid>',
  'chosen_by_client',
  'specialist',    -- 'lead' is rare in v1 for client-chosen relationships
  'flexible',
  'admin',         -- admin acting on the client's selection until self-service exists
  '<your-admin-uuid>'
);
```

```sql
-- Verification:
SELECT id, connection_type, role, control_level, created_at
FROM public.client_practitioner_links
WHERE client_id = '<client-auth-uuid>'
  AND practitioner_id = '<practitioner-auth-uuid>'
  AND ended_at IS NULL;
-- Expected: one row
```

---

**If INSERT fails with a unique constraint error on `idx_cpl_one_active_lead`:**

The client already has an active lead. You must end that relationship first. Find the current lead:

```sql
SELECT id, practitioner_id, connection_type, control_level, created_at
FROM public.client_practitioner_links
WHERE client_id = '<client-auth-uuid>'
  AND role = 'lead'
  AND ended_at IS NULL;
```

Review `control_level` before proceeding. If it is `keep`, this is a protected relationship — do not end it without a clear reason and admin authorisation. See section 7. Once you have confirmed the end is appropriate, use section 8 to end the existing link, then retry the INSERT.

---

## 7. control_level meaning and admin responsibility

`control_level` is informational in v1. The system stores it; admin enforces it. There is no automated protection — you are the protection.

**`keep`**
Protected relationship. The practitioner brought this client to NI, or has earned a durable claim through ongoing care. Admin must not assign competing practitioners with overlapping work without explicit consultation with the keep-holder. Admin must not end a `keep` link except for a clear reason — practitioner archived, client requested change, conflict of interest confirmed — and that reason must be recorded in `end_reason` when the link is ended.

**`flexible`**
Working relationship, admin-managed. Admin can adjust, reassign, or end this relationship based on operational needs without consulting the practitioner first. Common for NI-orchestrated matches and client-led selections.

**`one_off`**
Short-term engagement for a specific piece of work. Expected to be ended when the work completes. Useful for specialist consults that do not establish ongoing care. When the `case_practitioner_work` associated with this link is completed, end the link using section 8 with `end_reason = 'admin_action'` (or a more specific reason).

**Admin responsibility statement:**

Until automation exists, you are responsible for honouring `control_level = 'keep'` when making assignment decisions. The field is a label you read, not a constraint the system enforces. If you assign work that conflicts with a `keep` relationship without coordination, you have broken the protection NI promises its practitioners. Take it seriously.

---

## 8. Ending a client-practitioner link

**When to use:** practitioner archived, client requested a change of practitioner, conflict of interest discovered, scope completed for a `one_off` link, or any other reason a relationship should close.

Both `ended_at` and `end_reason` are required. Always populate `end_reason` — you will need it later for audit or dispute resolution.

```sql
-- END A LINK
UPDATE public.client_practitioner_links
SET
  ended_at   = now(),
  end_reason = '<reason>'
WHERE id = '<link-uuid>'
  AND ended_at IS NULL;  -- guard: only end if currently active
```

**Conventional `end_reason` values:**

| Value | Meaning |
|---|---|
| `declined` | Practitioner declined to take the client |
| `escalated` | Case complexity exceeded the practitioner's scope |
| `admin_action` | Administrative decision (add context in `notes` if useful) |
| `client_request` | Client asked for a change |
| `practitioner_archived` | Practitioner has left the network |

Free text is permitted for situations not covered above. Use enough detail that someone reading it cold six months later understands why the link ended.

```sql
-- Verification:
SELECT id, practitioner_id, client_id, ended_at, end_reason
FROM public.client_practitioner_links
WHERE id = '<link-uuid>';
-- Expected: ended_at is populated, end_reason is populated
-- The row remains in the table for audit; it is simply inactive.
```

---

## 9. Common operational queries

```sql
-- All active practitioners
SELECT id, display_name, practitioner_tier, trust_level, created_at
FROM public.practitioners
WHERE status = 'active'
ORDER BY display_name;
```

```sql
-- Practitioners pending approval (submitted but not yet reviewed)
SELECT p.id, p.display_name, u.email, p.created_at
FROM public.practitioners p
JOIN auth.users u ON u.id = p.id
WHERE p.status = 'pending_review'
ORDER BY p.created_at;
```

```sql
-- A practitioner's active client links
SELECT l.id, l.role, l.control_level, l.connection_type,
       l.created_at, u.email AS client_email
FROM public.client_practitioner_links l
JOIN auth.users u ON u.id = l.client_id
WHERE l.practitioner_id = '<practitioner-auth-uuid>'
  AND l.ended_at IS NULL
ORDER BY l.created_at;
```

```sql
-- A client's care team (active links only)
SELECT l.role, l.control_level, l.connection_type,
       p.display_name, p.status AS practitioner_status,
       l.created_at
FROM public.client_practitioner_links l
JOIN public.practitioners p ON p.id = l.practitioner_id
WHERE l.client_id = '<client-auth-uuid>'
  AND l.ended_at IS NULL
ORDER BY l.role, l.created_at;
```

```sql
-- All historical links for a client (audit view — includes ended)
SELECT l.id, l.role, l.control_level, l.connection_type,
       p.display_name, l.created_at, l.ended_at, l.end_reason
FROM public.client_practitioner_links l
JOIN public.practitioners p ON p.id = l.practitioner_id
WHERE l.client_id = '<client-auth-uuid>'
ORDER BY l.created_at DESC;
```

```sql
-- Practitioners with no active client links (unassigned)
SELECT p.id, p.display_name, p.practitioner_tier
FROM public.practitioners p
WHERE p.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.client_practitioner_links l
    WHERE l.practitioner_id = p.id AND l.ended_at IS NULL
  )
ORDER BY p.display_name;
```

```sql
-- Open work items by practitioner
SELECT w.practitioner_id, p.display_name,
       count(*) FILTER (WHERE w.status = 'assigned')  AS assigned,
       count(*) FILTER (WHERE w.status = 'in_review') AS in_review
FROM public.case_practitioner_work w
JOIN public.practitioners p ON p.id = w.practitioner_id
WHERE w.status IN ('assigned', 'in_review')
GROUP BY w.practitioner_id, p.display_name
ORDER BY (assigned + in_review) DESC;
```

```sql
-- Overdue work items (assigned or in_review, past due_at)
SELECT w.id, p.display_name, w.work_type, w.status,
       w.due_at, w.assigned_at,
       extract(day from now() - w.due_at)::int AS days_overdue
FROM public.case_practitioner_work w
JOIN public.practitioners p ON p.id = w.practitioner_id
WHERE w.status IN ('assigned', 'in_review')
  AND w.due_at < now()
ORDER BY w.due_at;
```

---

## 10. Future automation reference

The following operations are currently performed manually via this runbook.

**Currently manual (admin SQL via this runbook):**
- Practitioner onboarding and status transitions
- Case-practitioner work assignment
- Client-practitioner link creation and ending
- Honouring `control_level = 'keep'` when making assignment decisions
- Notification when relationships change

**Future scope (not yet built):**
- Practitioner self-service signup
- Practitioner-led client invitation flow (referring-practitioner relationship)
- Client-facing practitioner directory with self-service selection
- CareTeam Builder — AI-orchestrated multi-practitioner coordination
- Real-time notification on link and assignment changes
- Automated enforcement of `control_level = 'keep'` on new assignments
