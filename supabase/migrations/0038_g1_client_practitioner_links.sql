-- ──────────────────────────────────────────────────────────────────────────────
-- 0038_g1_client_practitioner_links.sql
-- Creates client_practitioner_links — durable relationship-context table.
--
-- Three-table principle:
--
--   client_practitioner_links  durable relationship context
--                               (who is connected, why, how protected)
--   case_practitioner_work     task-level operational work
--                               (who did what, when, on which case)
--   case_events                longitudinal audit / output memory
--                               (what happened, in what order)
--
-- These tables are complementary and non-overlapping. A practitioner may have
-- a durable link to a client without any active work item. Work items are
-- created against cases, not links. Links persist across cases.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Table
-- ─────────────────────────────────────────────────────────────────────────────
-- ──────────────────────────────────────────────────────────────────────────────
-- client_practitioner_links
-- Durable relationship-context table. Distinct from case_practitioner_work.
--
-- A link records the nature and protection level of a client-practitioner
-- connection. Work happens against cases (case_practitioner_work);
-- relationships persist across cases (this table).
--
-- Lifecycle: created → (active) → ended_at + end_reason
-- Active rows: ended_at IS NULL
--
-- v1: control_level is informational. Admin honours it manually via
-- runbook. Notification-on-change automation is deferred to a
-- later sprint.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE client_practitioner_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Core references ────────────────────────────────────────────────────────
  client_id          uuid NOT NULL REFERENCES auth.users(id)
                       ON DELETE CASCADE,
  practitioner_id    uuid NOT NULL REFERENCES practitioners(id)
                       ON DELETE RESTRICT,

  -- ── Relationship classification ───────────────────────────────────────────
  connection_type    text NOT NULL CHECK (connection_type IN (
                       'brought_by_practitioner',
                       'assigned_by_admin',
                       'chosen_by_client',
                       'added_by_system'
                     )),

  role               text NOT NULL CHECK (role IN (
                       'lead',
                       'specialist',
                       'reviewer',
                       'temporary'
                     )),

  control_level      text NOT NULL CHECK (control_level IN (
                       'keep',
                       'flexible',
                       'one_off'
                     )),

  -- ── Provenance ────────────────────────────────────────────────────────────
  -- NULL when creation_actor = 'system'
  created_by         uuid REFERENCES auth.users(id),
  creation_actor     text NOT NULL CHECK (creation_actor IN (
                       'admin',
                       'practitioner',
                       'system'
                     )),

  -- ── Lifecycle ─────────────────────────────────────────────────────────────
  -- ended_at IS NULL → link is active.
  ended_at           timestamptz,
  -- conventional values: 'declined', 'escalated', 'admin_action',
  -- 'client_request', 'practitioner_archived' (free text permitted)
  end_reason         text,

  -- ── Optional context ──────────────────────────────────────────────────────
  -- internal admin/system notes; not client-visible
  notes              text,

  -- ── Timestamps ─────────────────────────────────────────────────────────────
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Indexes
-- ─────────────────────────────────────────────────────────────────────────────
-- Practitioner's client list (active links only)
CREATE INDEX idx_cpl_practitioner_active
  ON client_practitioner_links(practitioner_id)
  WHERE ended_at IS NULL;

-- Client's care team (active links only)
CREATE INDEX idx_cpl_client_active
  ON client_practitioner_links(client_id)
  WHERE ended_at IS NULL;

-- One active link per (client, practitioner) pair
CREATE UNIQUE INDEX idx_cpl_one_active_per_pair
  ON client_practitioner_links(client_id, practitioner_id)
  WHERE ended_at IS NULL;

-- One active 'lead' practitioner per client
CREATE UNIQUE INDEX idx_cpl_one_active_lead
  ON client_practitioner_links(client_id)
  WHERE ended_at IS NULL AND role = 'lead';

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TRIGGER client_practitioner_links_updated_at
  BEFORE UPDATE ON client_practitioner_links
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE client_practitioner_links ENABLE ROW LEVEL SECURITY;

-- Practitioner sees their own ACTIVE client links only.
-- Ended links are accessible only via service_role (admin audit).
CREATE POLICY cpl_practitioner_select_active ON client_practitioner_links
  FOR SELECT
  USING (
    practitioner_id = auth.uid()
    AND ended_at IS NULL
  );

-- Service role: unrestricted (admin operations + historical audit)
CREATE POLICY cpl_service_all ON client_practitioner_links
  FOR ALL USING (auth.role() = 'service_role');

-- NO direct client-side SELECT policy. Clients access their team
-- only through the helper function getClientTeam() which projects
-- safe columns (no connection_type, no control_level, no notes,
-- no audit fields).
