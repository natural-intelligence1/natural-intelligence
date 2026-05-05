# G.1.2 — Practitioner Identity, Work & Lifecycle: Design Proposal

**Status:** Proposed — awaiting approval before any code or migration  
**Date:** 2026-05-05  
**Author:** Claude (G.1.2 sprint)  
**Scope:** `practitioners` rebuild, `case_practitioner_work` creation, `client_cases.status` extension, RLS extensions, middleware gate, runbook

---

## 1. Investigation Summary

### What already exists

Two tables are live in the dev database with real data:

| Table | Rows | Relevant to this design |
|---|---|---|
| `practitioners` | 5 | Full rebuild required |
| `practitioner_applications` | 1 | Preserved as-is; source of some audit fields |

**`practitioners` — current state and gaps**

The existing table uses a surrogate `id` (own UUID) with a separate `profile_id → profiles.id` FK as its identity link. The new design collapses this: `practitioners.id` becomes `auth.users.id` directly, eliminating the join.

Lifecycle tracking exists but is incomplete:
- `lifecycle_status` is a TEXT column with CHECK constraint: `'approved_pending_profile' | 'active' | 'paused' | 'rejected'`
- `is_active` (boolean) runs in parallel and redundantly with `lifecycle_status`
- `activated_at`, `paused_at`, `paused_reason` exist
- `vetted_by` and `accepted_at` exist as partial audit fields

What the new design adds: the full status lifecycle (`pending_review | approved | active | suspended | archived`), complete audit fields (`suspended_by`, `suspended_at`, `suspension_reason`, `archived_by`, `archived_at`, `archive_reason`), and deprecation of `is_active`.

The existing table also carries 30+ practitioner profile columns (bio, modalities, area tags, credentials, social URLs, etc.) used by the admin UI and public directory. These are preserved on the new table — they are not in scope for modification in this sprint.

**`practitioner_applications` — relevant audit fields**

`practitioner_applications` carries `reviewed_by` and `reviewed_at` (who reviewed and when). These cover the application review event. The practitioner record's `verified_by` / `verified_at` fields cover the approval event (admin confirms the practitioner joins the network). These are distinct events; both fields are required and neither is a duplicate.

**What does not exist at all**

- `case_practitioner_work` — no case assignment model of any kind
- No `practitioner_id` column on `client_cases` (the forbidden shortcut is absent — good)
- No middleware in `apps/care` — zero auth protection
- No `is_active_practitioner()` DB function

### Design approach

This is a schema **evolution**, not a greenfield build. The migration strategy is:

1. Rename existing `practitioners` to a backup (`practitioners_v1`)
2. Create new `practitioners` with the correct shape
3. Migrate existing 5 rows (mapping `profile_id` → `id`, remapping lifecycle values)
4. Drop `practitioners_v1` after data verified
5. Create `case_practitioner_work`
6. Extend `client_cases.status`
7. Add RLS extensions across case tables

---

## 2. Status Lifecycle

### Implementation choice: TEXT + CHECK constraint

**Recommendation: TEXT column with CHECK constraint.**

Reasoning: The existing `lifecycle_status` column already uses this pattern. PostgreSQL ENUM types require `ALTER TYPE ... ADD VALUE` to extend — that DDL cannot run inside a transaction block, which makes it awkward in migration files where atomicity is important. For a value set this small and stable (`pending_review | approved | active | suspended | archived`), a CHECK constraint on a text column is the right choice. It can be extended with a simple `DROP CONSTRAINT / ADD CONSTRAINT` pair, fully transactional. It also matches `case_events.event_type`, `reasoning_traces.status`, and every other enumerated field in this codebase.

The existing `trust_level` PostgreSQL ENUM is a legacy; do not adopt that pattern here.

### Transition diagram

```
                   ┌────────────────────────────────────┐
                   │         (invitation / manual)      │
                   ▼                                    │
           pending_review ──────────────────────────────┘
                   │
         admin approves
         records verified_by + verified_at
                   │
                   ▼
              approved
                   │
         admin activates explicitly
         (v1: no auto-activation on login)
                   │
                   ▼
               active ◄──────────────────────────┐
                   │                              │
         admin suspends                  admin reinstates
         records suspended_by            clears suspension fields
         suspended_at, reason                     │
                   │                              │
                   ▼                              │
             suspended ──────────────────────────►┘
                   │
         (any status)
         admin archives
         terminal — records archived_by, archived_at, reason
                   │
                   ▼
              archived  (terminal — no exit)
```

### Permitted transitions (enforced by application, not DB trigger)

| From | To | Authority | Fields recorded |
|---|---|---|---|
| `pending_review` | `approved` | admin | `verified_by`, `verified_at` |
| `approved` | `active` | admin explicit action | — |
| `active` | `suspended` | admin | `suspended_by`, `suspended_at`, `suspension_reason` |
| `suspended` | `active` | admin | clears `suspended_*` fields |
| any | `archived` | admin | `archived_by`, `archived_at`, `archive_reason` |

The DB enforces the value set via CHECK. Transition validity is enforced in server actions (`requireAdmin()` pattern, per existing convention).

**`approved → active` auto-promotion is deferred.** In v1, admin explicitly activates. This keeps middleware thin (one query only, no conditional writes) and avoids a second DB round-trip on every request.

---

## 3. Audit Fields

All fields from Constraint 2 are included. Reference to `auth.users(id)` directly (not `profiles`) — practitioners and their auditors are auth users, and this FK survives profile deletion edge cases. The existing pattern (`vetted_by → profiles`) is updated to `→ auth.users` for consistency with the spec.

| Column | Type | Purpose |
|---|---|---|
| `verified_by` | `uuid REFERENCES auth.users(id)` | Admin who moved `pending_review → approved` |
| `verified_at` | `timestamptz` | When approval was granted |
| `suspended_by` | `uuid REFERENCES auth.users(id)` | Admin who suspended |
| `suspended_at` | `timestamptz` | When suspended |
| `suspension_reason` | `text` | Required at suspension time |
| `archived_by` | `uuid REFERENCES auth.users(id)` | Admin who archived |
| `archived_at` | `timestamptz` | When archived |
| `archive_reason` | `text` | Required at archive time |

**Existing fields mapped:**

| Existing | New | Notes |
|---|---|---|
| `vetted_by` | `verified_by` | Renamed; FK target changes to `auth.users` |
| `accepted_at` | `verified_at` | Renamed |
| `paused_at` | `suspended_at` | Renamed |
| `paused_reason` | `suspension_reason` | Renamed |

The migration maps these fields during data copy. The old names are dropped.

---

## 4. Schema: `practitioners` Table

### DDL

```sql
-- ──────────────────────────────────────────────────────────────────────────────
-- practitioners
-- Identity and lifecycle table for NI's curated practitioner network.
-- practitioners.id IS auth.users.id (1:1, no surrogate key).
-- Profile/directory columns are preserved from the prior schema.
-- Status lifecycle: pending_review → approved → active ↔ suspended → archived
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE practitioners (

  -- ── Identity ──────────────────────────────────────────────────────────────
  -- id IS auth.users.id. ON DELETE RESTRICT: auth user cannot be deleted
  -- while a practitioner record exists. Practitioner must be archived first.
  id                        uuid PRIMARY KEY REFERENCES auth.users(id)
                              ON DELETE RESTRICT,

  -- ── Lifecycle ─────────────────────────────────────────────────────────────
  status                    text NOT NULL DEFAULT 'pending_review'
                              CHECK (status IN (
                                'pending_review', 'approved', 'active',
                                'suspended', 'archived'
                              )),

  -- ── Directory identity ─────────────────────────────────────────────────────
  display_name              text NOT NULL,
  bio                       text,
  credentials_summary       text,
  specialisations           text[] NOT NULL DEFAULT '{}',

  -- ── Audit trail (Constraint 2) ─────────────────────────────────────────────
  verified_by               uuid REFERENCES auth.users(id),
  verified_at               timestamptz,
  suspended_by              uuid REFERENCES auth.users(id),
  suspended_at              timestamptz,
  suspension_reason         text,
  archived_by               uuid REFERENCES auth.users(id),
  archived_at               timestamptz,
  archive_reason            text,

  -- ── Preserved profile columns ──────────────────────────────────────────────
  -- These existed in the prior schema and are retained to avoid admin UI
  -- regression. Future sprint may extract to practitioner_profiles.
  trust_level               trust_level NOT NULL DEFAULT 'unvetted',
  credentials               text[] NOT NULL DEFAULT '{}',
  modalities                text,
  years_experience          integer,
  experience_range          text
                              CHECK (experience_range IN
                                ('0-1','1-3','3-5','5-10','10+')),
  delivery_mode             text
                              CHECK (delivery_mode IN
                                ('online','in_person','both')),
  website_url               text,
  linkedin_url              text,
  instagram_url             text,
  other_social_urls         text,
  city                      text,
  country                   text,
  primary_professions       text[] NOT NULL DEFAULT '{}',
  area_tags                 text[] NOT NULL DEFAULT '{}',
  client_types              text[] NOT NULL DEFAULT '{}',
  collaboration_types       text[] NOT NULL DEFAULT '{}',
  accepts_referrals         boolean NOT NULL DEFAULT true,
  open_to_collaboration     boolean NOT NULL DEFAULT false,
  currently_seeing_clients  boolean,
  practitioner_tier         text NOT NULL DEFAULT 'standard'
                              CHECK (practitioner_tier IN
                                ('standard','featured','specialist','senior')),
  practice_name             text,
  tagline                   text,
  referral_contact_method   text
                              CHECK (referral_contact_method IN
                                ('email','website','platform_message')),
  support_needs             text,
  display_order             integer NOT NULL DEFAULT 0,
  profile_completeness_pct  integer NOT NULL DEFAULT 0,
  is_directory_ready        boolean NOT NULL DEFAULT false,
  is_test_data              boolean NOT NULL DEFAULT false,

  -- ── DEPRECATED: use status = 'active' instead ─────────────────────────────
  -- Retained for admin UI compatibility. A trigger keeps it in sync.
  -- Remove in the sprint after admin app is updated to read status directly.
  is_active                 boolean NOT NULL DEFAULT false,

  -- ── Timestamps ─────────────────────────────────────────────────────────────
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
```

### Indexes

```sql
-- Primary lookup in middleware: practitioners WHERE id = auth.uid()
-- Covered by the PK. No additional index required.

-- Status-based queries (admin list, suspension checks)
CREATE INDEX idx_practitioners_status ON practitioners(status);

-- Preserved from prior schema
CREATE INDEX idx_practitioners_is_test_data ON practitioners(is_test_data)
  WHERE is_test_data = true;
```

### Triggers

```sql
-- Keep updated_at current
CREATE TRIGGER practitioners_updated_at
  BEFORE UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Keep is_active in sync with status (deprecation bridge)
CREATE OR REPLACE FUNCTION sync_practitioner_is_active()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.is_active := (NEW.status = 'active');
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_is_active
  BEFORE INSERT OR UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION sync_practitioner_is_active();

-- Preserve existing profile completeness trigger
CREATE TRIGGER practitioner_completeness_trigger
  BEFORE INSERT OR UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION update_profile_completeness();
```

### RLS

```sql
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;

-- Practitioner reads own full record (required for care app)
CREATE POLICY practitioner_self_select ON practitioners
  FOR SELECT USING (id = auth.uid());

-- Public directory: active + directory-ready rows only
-- (preserves existing behaviour)
CREATE POLICY practitioners_public_directory ON practitioners
  FOR SELECT USING (status = 'active' AND is_directory_ready = true);

-- Service role: unrestricted (admin app writes via service_role)
CREATE POLICY practitioners_service_all ON practitioners
  FOR ALL USING (auth.role() = 'service_role');

-- No INSERT/UPDATE policies for regular users in v1.
-- All lifecycle mutations happen via admin app (service_role).
```

### DB helper function

```sql
-- Parallel to is_admin(). Used in RLS policies on case tables.
CREATE OR REPLACE FUNCTION public.is_active_practitioner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM practitioners
    WHERE id = auth.uid() AND status = 'active'
  )
$$;
```

---

## 5. Schema: `case_practitioner_work` Table

This is the case-to-practitioner join table. It replaces the forbidden `client_cases.practitioner_id` shortcut. Every piece of work a practitioner does on a case is a row here — including historical, completed, and cancelled work.

### DDL

```sql
-- ──────────────────────────────────────────────────────────────────────────────
-- case_practitioner_work
-- Records every work item assigned to a practitioner on a case.
-- Append-only audit log: rows are never deleted, only status-transitioned.
-- Active work: WHERE status IN ('assigned', 'in_review')
-- Full history: unrestricted
-- Practitioner inbox: WHERE practitioner_id = $uid AND status IN (...)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE case_practitioner_work (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Core references ────────────────────────────────────────────────────────
  case_id             uuid NOT NULL REFERENCES client_cases(id)
                        ON DELETE CASCADE,
  practitioner_id     uuid NOT NULL REFERENCES practitioners(id)
                        ON DELETE RESTRICT,

  -- ── Work classification ────────────────────────────────────────────────────
  work_type           text NOT NULL CHECK (work_type IN (
                        'case_review',
                        'safety_review',
                        'protocol_review',
                        'escalation_review',
                        'follow_up_review',
                        'specialist_consult'
                      )),

  -- ── Status ─────────────────────────────────────────────────────────────────
  status              text NOT NULL DEFAULT 'assigned' CHECK (status IN (
                        'assigned',
                        'in_review',
                        'completed',
                        'escalated',
                        'declined',
                        'cancelled'
                      )),

  -- ── Assignment provenance ──────────────────────────────────────────────────
  assigned_by         uuid NOT NULL REFERENCES auth.users(id)
                        ON DELETE RESTRICT,
  assignment_source   text NOT NULL DEFAULT 'admin' CHECK (
                        assignment_source IN (
                          'admin',
                          'matching_engine',
                          'auto_complexity_threshold'
                        )
                      ),

  -- ── Scheduling ────────────────────────────────────────────────────────────
  due_at              timestamptz,

  -- ── Audit timestamps ──────────────────────────────────────────────────────
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  escalated_at        timestamptz,
  escalation_reason   text,
  declined_at         timestamptz,
  decline_reason      text,
  cancelled_at        timestamptz,

  -- ── Output linkage ────────────────────────────────────────────────────────
  -- Populated atomically with status = 'completed'. Points to the case_events
  -- row that records the practitioner's structured output.
  output_event_id     uuid REFERENCES case_events(id),

  -- ── Practitioner notes ─────────────────────────────────────────────────────
  -- Internal only. Not client-visible. Written by the practitioner.
  notes               text,

  -- ── Timestamps ─────────────────────────────────────────────────────────────
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

### Indexes

```sql
-- Practitioner inbox: all open work for a practitioner
CREATE INDEX idx_cpw_practitioner_status
  ON case_practitioner_work(practitioner_id, status);

-- Case detail view: all work on a case
CREATE INDEX idx_cpw_case_status
  ON case_practitioner_work(case_id, status);

-- Overdue detection
CREATE INDEX idx_cpw_status_due
  ON case_practitioner_work(status, due_at)
  WHERE due_at IS NOT NULL;

-- Prevent duplicate active work:
-- A practitioner cannot have two open items of the same type on the same case.
CREATE UNIQUE INDEX idx_cpw_no_duplicate_active
  ON case_practitioner_work(case_id, practitioner_id, work_type)
  WHERE status IN ('assigned', 'in_review');
```

### Trigger

```sql
CREATE TRIGGER case_practitioner_work_updated_at
  BEFORE UPDATE ON case_practitioner_work
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### RLS

```sql
ALTER TABLE case_practitioner_work ENABLE ROW LEVEL SECURITY;

-- Practitioner reads their own assigned work
CREATE POLICY work_practitioner_select ON case_practitioner_work
  FOR SELECT USING (practitioner_id = auth.uid());

-- Practitioner updates their own work
-- Application code enforces which columns may change (status, timestamps,
-- notes, escalation fields). RLS ensures row-level isolation only.
CREATE POLICY work_practitioner_update ON case_practitioner_work
  FOR UPDATE USING (practitioner_id = auth.uid());

-- Service role: unrestricted (admin app creates assignments)
CREATE POLICY work_service_all ON case_practitioner_work
  FOR ALL USING (auth.role() = 'service_role');
```

---

## 6. Schema: `client_cases.status` Migration

### Current CHECK constraint

```sql
CHECK (status IN ('active', 'paused', 'closed'))
```

### New CHECK constraint

```sql
-- ──────────────────────────────────────────────────────────────────────────────
-- client_cases.status — persisted lifecycle states
--
-- Stored states (this column):
--   draft            case created; intake not yet complete
--   intake_complete  intake submitted; AI analysis pending or complete
--   active           ongoing case; protocol delivered or in delivery
--   paused           client or NI has paused the case temporarily
--   closed           case concluded (discharged, inactive, or resolved)
--
-- Derived states (NOT stored here — computed from related tables):
--   analysing        derived: reasoning_traces row exists with status != 'client_visible'
--   awaiting_review  derived: case_practitioner_work rows with status IN ('assigned','in_review')
--   follow_up_due    derived: follow-up date in case_events has passed without response
--
-- Never add derived states to this column. They are observable from the data.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE client_cases
  DROP CONSTRAINT IF EXISTS client_cases_status_check,
  ADD CONSTRAINT client_cases_status_check
    CHECK (status IN ('draft', 'intake_complete', 'active', 'paused', 'closed'));
```

**Existing rows:** Currently 0 rows in dev. The migration must be safe on both empty (fresh) and populated (future) databases. The migration adds `draft` and `intake_complete` as valid values and does not remove any value that existing rows could hold (`active`, `paused`, `closed` are preserved).

---

## 7. Schema: RLS Extensions on Case Tables

Practitioners need read access to case data when they have active work on that case. This is the defence-in-depth layer below the middleware gate.

The same pattern applies to all four case tables.

```sql
-- client_cases: practitioner can read a case if they have active work on it
CREATE POLICY case_practitioner_select ON client_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM case_practitioner_work cpw
      WHERE cpw.case_id = client_cases.id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status IN ('assigned', 'in_review')
    )
  );

-- case_events: same scope
CREATE POLICY case_events_practitioner_select ON case_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM case_practitioner_work cpw
      WHERE cpw.case_id = case_events.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status IN ('assigned', 'in_review')
    )
  );

-- reasoning_traces: same scope
CREATE POLICY reasoning_traces_practitioner_select ON reasoning_traces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM case_practitioner_work cpw
      WHERE cpw.case_id = reasoning_traces.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status IN ('assigned', 'in_review')
    )
  );

-- reasoning_trace_entries: same scope
-- Note: practitioners see ALL visibility levels (internal, practitioner, client)
-- for cases they are actively working on. This is intentional.
CREATE POLICY reasoning_trace_entries_practitioner_select
  ON reasoning_trace_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM case_practitioner_work cpw
      JOIN reasoning_traces rt ON rt.id = reasoning_trace_entries.trace_id
      WHERE cpw.case_id = rt.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status IN ('assigned', 'in_review')
    )
  );
```

**Defence-in-depth contract:** The middleware gate ensures only `status = 'active'` practitioners reach `apps/care` at all. These RLS policies ensure that even a service-role bypass or a future bug in middleware cannot expose a case to a practitioner who has no active work on it.

---

## 8. JWT Cache Strategy

### No Supabase auth hook in v1

Supabase auth hooks can populate `app_metadata` at sign-in, which flows into the JWT. This would allow middleware to read practitioner status from the JWT token without a DB query. However:

- JWT TTL is typically 1 hour. A practitioner suspended at 9:01am would retain JWT access until 10:00am — a full hour gap.
- Constraint 4 requires suspension to take effect on the next request, not the next JWT refresh.

Therefore: **no JWT caching of practitioner status.** The middleware always queries the DB.

The JWT carries `auth.uid()` (the standard Supabase JWT sub claim) which equals `practitioners.id` in the new schema. No custom claims are required.

### Middleware fetch flow

On every request to `apps/care` (excluding static assets):

```
1. createServerClient(anon key + cookies)
2. supabase.auth.getUser()           → resolves auth.uid() from JWT
3. SELECT id, status FROM practitioners WHERE id = auth.uid()
   (one round-trip; uses PK lookup — O(1))
4. Decision:
   status = 'active'           → allow, attach practitioner id to request
   status = 'approved'         → redirect /care/pending-activation
   status = 'pending_review'   → redirect /care/pending-review
   status = 'suspended'        → redirect /care/suspended
   status = 'archived'         → redirect /care/access-revoked
   no practitioner row         → redirect /auth/login (not a practitioner)
```

The anon-key client with the user's JWT can read the practitioner's own row because the `practitioner_self_select` RLS policy allows it (`id = auth.uid()`). No service-role key in middleware.

**Performance:** PK lookup on `practitioners.id = auth.uid()` is O(1). No index beyond the PK is needed for this query. Supabase runs this on the same Postgres connection as the session check — latency addition is minimal.

---

## 9. Middleware Behaviour

### `apps/care/middleware.ts` — pseudocode

```typescript
const STATIC_PATHS = /_next\/static|_next\/image|favicon\.ico|.*\.(svg|png|jpg|jpeg|gif|webp)$/

export async function middleware(request: NextRequest) {
  if (STATIC_PATHS.test(request.nextUrl.pathname)) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  // Step 1: Establish authenticated user identity
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll, setAll } }   // standard cookie handlers
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return redirectWithCookies('/auth/login')

  // Step 2: Single DB query — id and status only
  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('id, status')
    .eq('id', user.id)
    .maybeSingle()

  // Step 3: Gate on active status only
  if (!practitioner) return redirectWithCookies('/auth/login')

  if (practitioner.status !== 'active') {
    const destination = {
      approved:       '/care/pending-activation',
      pending_review: '/care/pending-review',
      suspended:      '/care/suspended',
      archived:       '/care/access-revoked',
    }[practitioner.status] ?? '/auth/login'
    return redirectWithCookies(destination)
  }

  // Allowed through — attach practitioner id to request header for
  // server components that need it without a second DB lookup
  supabaseResponse.headers.set('x-practitioner-id', practitioner.id)
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**What middleware does NOT do:**
- It does not check which cases a practitioner may access (that is RLS)
- It does not check work_type or work status (that is application layer)
- It does not make a second DB call
- It does not write to the DB (no auto-activation — that is an explicit admin action)

---

## 10. `case_events` Writer Wire-up

When `case_practitioner_work.status` transitions to `'completed'`, the application must atomically:

1. Insert a `case_events` row capturing the structured output
2. Set `case_practitioner_work.output_event_id` to the new event's id
3. Set `case_practitioner_work.completed_at = now()`
4. Set `case_practitioner_work.status = 'completed'`

All four steps must succeed or all must fail. A partial write (event written, work row not updated) would leave the data in an inconsistent state.

### Recommended approach: Postgres RPC function

The Supabase JS client does not support multi-statement transactions directly. The correct pattern is a `SECURITY DEFINER` Postgres function called via `.rpc()`:

```sql
-- Postgres function (defined in a migration)
CREATE OR REPLACE FUNCTION complete_practitioner_work(
  p_work_id     uuid,
  p_decision    text,
  p_notes       text,
  p_recommendation text
)
RETURNS uuid   -- returns the new event id
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case_id   uuid;
  v_work_type text;
  v_event_id  uuid;
BEGIN
  -- Verify caller owns this work item and it is in a completable state
  SELECT case_id, work_type INTO v_case_id, v_work_type
  FROM case_practitioner_work
  WHERE id = p_work_id
    AND practitioner_id = auth.uid()
    AND status IN ('assigned', 'in_review')
  FOR UPDATE;                     -- lock the row

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work item not found or not in a completable state';
  END IF;

  -- Step 1: Insert case_events row
  INSERT INTO case_events (
    case_id, event_type, source_table, source_id, event_payload
  )
  VALUES (
    v_case_id,
    v_work_type || '_completed',
    'case_practitioner_work',
    p_work_id,
    jsonb_build_object(
      'decision',        p_decision,
      'notes_summary',   p_notes,
      'recommendation',  p_recommendation
    )
  )
  RETURNING id INTO v_event_id;

  -- Steps 2–4: Update work row atomically
  UPDATE case_practitioner_work
  SET
    status          = 'completed',
    completed_at    = now(),
    output_event_id = v_event_id,
    notes           = p_notes
  WHERE id = p_work_id;

  RETURN v_event_id;
END;
$$;
```

**Application call site** (server action in `apps/care`):

```typescript
// apps/care/app/cases/[caseId]/work/actions.ts
export async function completeWorkItem(
  workId: string,
  output: { decision: string; notes: string; recommendation: string }
) {
  const supabase = createServerClient(...)       // practitioner's anon-key session

  const { data: eventId, error } = await supabase
    .rpc('complete_practitioner_work', {
      p_work_id:        workId,
      p_decision:       output.decision,
      p_notes:          output.notes,
      p_recommendation: output.recommendation,
    })

  if (error) throw error

  revalidatePath(`/cases/${caseId}`)
  return { eventId }
}
```

**Where this lives in the codebase:**

- The Postgres function: defined in migration `0036_g1_complete_work_fn.sql`
- The server action: `apps/care/app/cases/[caseId]/work/actions.ts` (created in Phase G implementation)
- The DB module function: `packages/db/src/practitioners/completeWorkItem.ts` (wraps the RPC call)

---

## 11. Naming and Module Layout

### File tree: `packages/db/src/practitioners/`

```
packages/db/src/practitioners/
  index.ts                    — barrel export
  types.ts                    — domain types (PractitionerStatus, WorkType, etc.)
  getPractitioner.ts          — fetch own practitioner row by user id
  getPractitioner.test.ts
  listAssignedWork.ts         — open work items for a practitioner
  listAssignedWork.test.ts
  listAssignedCases.ts        — cases a practitioner has active work on
  listAssignedCases.test.ts
  assignWork.ts               — create a case_practitioner_work row (admin)
  assignWork.test.ts
  completeWorkItem.ts         — RPC wrapper for the atomic completion function
  completeWorkItem.test.ts
  updatePractitionerStatus.ts — admin: lifecycle transitions with audit fields
  updatePractitionerStatus.test.ts
```

### `packages/db/package.json` — subpath export to add

```json
"./practitioners": "./src/practitioners/index.ts"
```

### Naming conventions applied

| Convention | Example |
|---|---|
| File: camelCase verb-noun | `getPractitioner.ts`, `assignWork.ts` |
| DB table: snake_case plural | `practitioners`, `case_practitioner_work` |
| DB column: snake_case | `practitioner_id`, `suspension_reason` |
| TypeScript type: PascalCase | `PractitionerStatus`, `WorkType`, `WorkItem` |
| Function: camelCase verb-first | `getPractitioner()`, `listAssignedWork()` |

### Naming conflict noted

The existing convention for test files in `packages/db` uses co-located `.test.ts` files. The new module follows this pattern. The existing `intake/` module uses this convention; `crt/` does not (H1 gap from V.8). Both are corrected as part of Phase G.

---

## 12. Initial Practitioner Status — Runbook

**Context:** Pre-revenue, no admin UI for practitioner creation. The first practitioners are added manually by the founder via SQL. This runbook documents the exact steps. A polished admin UI is deferred.

**Runbook document path:** `docs/runbooks/onboard-practitioner.md`

**Prerequisites:**
1. The practitioner has a Supabase auth account (created via invite or dashboard)
2. You know their `auth.users.id` (visible in Supabase dashboard → Authentication → Users)
3. You are running the SQL as the Supabase service role (via dashboard SQL editor or MCP)

### Step-by-step SQL

```sql
-- ── STEP 1: Verify the auth user exists ────────────────────────────────────
SELECT id, email, created_at
FROM auth.users
WHERE id = '<practitioner-auth-uuid>';
-- Must return exactly one row before proceeding.

-- ── STEP 2: Set the profile role to practitioner ───────────────────────────
UPDATE profiles
SET role = 'practitioner'
WHERE id = '<practitioner-auth-uuid>';

-- Verify:
SELECT id, role, full_name FROM profiles WHERE id = '<practitioner-auth-uuid>';

-- ── STEP 3: Insert the practitioner record ─────────────────────────────────
INSERT INTO practitioners (
  id,
  status,
  display_name,
  bio,
  specialisations,
  verified_by,
  verified_at,
  created_at,
  updated_at
)
VALUES (
  '<practitioner-auth-uuid>',
  'approved',                       -- Start at approved. Admin activates below.
  'Dr. Jane Smith',                 -- Display name for directory and admin UI
  NULL,                             -- Bio added when profile is built out
  '{}',
  '<admin-auth-uuid>',              -- Founder's auth.users.id
  now(),
  now(),
  now()
);

-- ── STEP 4: Explicitly activate the practitioner ───────────────────────────
-- When the practitioner is ready to access the care portal:
UPDATE practitioners
SET
  status     = 'active',
  updated_at = now()
WHERE id = '<practitioner-auth-uuid>';

-- ── STEP 5: Verify final state ─────────────────────────────────────────────
SELECT id, status, display_name, verified_by, verified_at
FROM practitioners
WHERE id = '<practitioner-auth-uuid>';
-- Expected: status = 'active', verified_by set, display_name set.
```

**Suspension runbook (when needed):**

```sql
UPDATE practitioners
SET
  status            = 'suspended',
  suspended_by      = '<admin-auth-uuid>',
  suspended_at      = now(),
  suspension_reason = 'Reason here',
  updated_at        = now()
WHERE id = '<practitioner-auth-uuid>';
```

**Archive runbook (terminal):**

```sql
UPDATE practitioners
SET
  status         = 'archived',
  archived_by    = '<admin-auth-uuid>',
  archived_at    = now(),
  archive_reason = 'Reason here',
  updated_at     = now()
WHERE id = '<practitioner-auth-uuid>';
```

---

## 13. Migration Plan

Each migration file contains actual DDL — no comment-only files. Fresh `supabase db reset` must recreate the full schema. Four migration files; one concern per file.

### Sequence

**Migration 0034 — `0034_g1_practitioners_rebuild.sql`**

Rebuild the practitioners table with the new schema. Migrate existing 5 rows. Drop the old table.

Steps:
1. Create `practitioners_v1` as a backup copy
2. Drop RLS policies and triggers on old `practitioners`
3. Drop old `practitioners` table
4. Create new `practitioners` table (full DDL from Section 4)
5. Create `is_active_practitioner()` function
6. Create triggers
7. Enable RLS and create policies
8. Migrate rows from `practitioners_v1`:
   - Map `profile_id` → `id`
   - Map `lifecycle_status` values:
     - `'approved_pending_profile'` → `'approved'`
     - `'active'` → `'active'`
     - `'paused'` → `'suspended'`
     - `'rejected'` → `'archived'` (with `archive_reason = 'Rejected during lifecycle review'`)
   - Map `vetted_by` → `verified_by`, `accepted_at` → `verified_at`
   - Map `paused_at` → `suspended_at`, `paused_reason` → `suspension_reason`
   - Copy all profile columns directly
9. Verify row count matches before dropping backup
10. Drop `practitioners_v1`

**Migration 0035 — `0035_g1_case_practitioner_work.sql`**

Create `case_practitioner_work`. All DDL from Section 5.

Steps:
1. Create table
2. Create indexes (including partial unique index)
3. Create trigger
4. Enable RLS and create policies
5. Create `complete_practitioner_work()` Postgres function (Section 10)

**Migration 0036 — `0036_g1_client_cases_status.sql`**

Update `client_cases.status` CHECK constraint. DDL from Section 6.

Steps:
1. Drop existing CHECK constraint
2. Add new CHECK constraint with `'draft'` and `'intake_complete'` added
3. Add comment block documenting derived states (as a `COMMENT ON TABLE` or inline)

**Migration 0037 — `0037_g1_rls_care_extensions.sql`**

Add practitioner SELECT policies to `client_cases`, `case_events`, `reasoning_traces`, `reasoning_trace_entries`. DDL from Section 7.

Steps:
1. Add `case_practitioner_select` to `client_cases`
2. Add `case_events_practitioner_select` to `case_events`
3. Add `reasoning_traces_practitioner_select` to `reasoning_traces`
4. Add `reasoning_trace_entries_practitioner_select` to `reasoning_trace_entries`

### Migration file naming note

Migration `0033_sprint17_crt_schema.sql` is a comment-only file (V.8 gap C4). That gap is not fixed in these migrations — it is tracked separately in the V.8 gap-fill list. However, migrations 0034–0037 set the correct standard: every migration in this sprint contains actual DDL.

---

## 14. Test Plan

All tests co-located in `packages/db/src/practitioners/*.test.ts`. They run against the real DB (same pattern as `intake/smoke.test.ts`).

### RLS isolation tests

| Test | Setup | Assert |
|---|---|---|
| Member cannot read any practitioner row | Authenticated as `role = 'user'` | Query returns empty |
| Practitioner reads only own row | Two practitioners in DB | Each reads only their own; zero rows from other |
| Practitioner with `status = 'suspended'` reads own row | Suspended practitioner | Still reads own row (self-read RLS is unconditional on status) |
| Member cannot read `case_practitioner_work` | No work row for member | Query returns empty |
| Practitioner reads only own work | Two practitioners, same case | Each sees only own work rows |
| Practitioner cannot read case without active work | Work row with `status = 'completed'` | `client_cases` query returns empty |
| Practitioner with active work reads case | Work row with `status = 'in_review'` | `client_cases` query returns 1 row |
| Practitioner cannot read another practitioner's case | Practitioner B has active work; A queries same case | A gets empty |
| Practitioner reads `reasoning_trace_entries` for own active case | Active work, entries at all visibility levels | Returns all entries (internal, practitioner, client) |

### Lifecycle transition tests

| Test | Action | Assert |
|---|---|---|
| `pending_review → approved` | UPDATE status = 'approved', set verified_by, verified_at | Row reflects change; CHECK constraint passes |
| `approved → active` | UPDATE status = 'active' | Succeeds; is_active trigger sets is_active = true |
| `active → suspended` | UPDATE status = 'suspended' | Succeeds; is_active = false |
| `suspended → active` | UPDATE status = 'active' | Succeeds; is_active = true |
| `active → archived` | UPDATE status = 'archived' | Succeeds; is_active = false; no further updates allowed (application enforces, DB allows) |
| Invalid status value | UPDATE status = 'invalid' | CHECK constraint violation |
| `archived → active` | UPDATE status = 'active' | Application should reject; DB allows (test that application layer enforces the terminal rule) |

### Assignment uniqueness tests

| Test | Setup | Assert |
|---|---|---|
| Duplicate active work blocked | Insert two rows with same (case_id, practitioner_id, work_type) both with status = 'assigned' | Second INSERT raises unique index violation |
| Completed + new active work allowed | First row status = 'completed', insert second active row | Succeeds (partial index only covers assigned/in_review) |
| Two different work_types on same case/practitioner | `case_review` and `safety_review` both active | Succeeds |

### Middleware gate tests

These are integration tests against the middleware function (or an equivalent utility extracted from it).

| Practitioner state | Expected outcome |
|---|---|
| `status = 'active'` | Allowed through |
| `status = 'approved'` | Redirect to `/care/pending-activation` |
| `status = 'pending_review'` | Redirect to `/care/pending-review` |
| `status = 'suspended'` | Redirect to `/care/suspended` |
| `status = 'archived'` | Redirect to `/care/access-revoked` |
| No practitioner row | Redirect to `/auth/login` |
| Valid session, no auth user (JWT spoofing) | `getUser()` returns null; redirect to `/auth/login` |

### `case_events` transaction tests

| Test | Scenario | Assert |
|---|---|---|
| Atomic completion succeeds | Call `complete_practitioner_work()` with valid inputs | Work status = 'completed', output_event_id set, case_events row created, all in one transaction |
| Completion rejected for wrong practitioner | Call with work_id belonging to a different practitioner | Function raises exception; no rows modified |
| Completion rejected for already-completed work | Work already has status = 'completed' | Function raises exception |
| Partial failure impossible | Simulate case_events INSERT failure (invalid data) | Transaction rolls back; work status unchanged |
| Duplicate `case_events` on retry | Retry after transient error | Idempotency must be documented; the RPC function should be designed so retries are safe (check for existing `output_event_id` before inserting) |

---

## Appendix: Key Tensions Resolved

| Tension | Decision |
|---|---|
| `rejected` in existing practitioners | Map to `archived` in migration. `rejected` outcome belongs on `practitioner_applications`, not `practitioners`. A practitioner who was rejected during application should have no `practitioners` row at all in the new design. |
| `is_active` boolean redundancy | Retain with deprecation bridge trigger (sync_is_active). Admin UI continues to work. Remove in the sprint after admin app reads `status` directly. |
| Middleware vs. layout role check | Middleware does the DB check (Constraint 5). Admin app's layout-only pattern is not adopted for care app — care app is the context where suspension must take effect immediately. |
| FK to `auth.users` vs `profiles` | Audit fields reference `auth.users(id)` per Constraint 2. Profile columns reference `profiles.id`. Both are the same UUID value; the distinction is semantic correctness for audit trail (auth user) vs. profile display (profile row). |
| `is_admin()` function pattern | Extended by adding `is_active_practitioner()` using the identical pattern. Consistent with existing DB-side function convention. |
