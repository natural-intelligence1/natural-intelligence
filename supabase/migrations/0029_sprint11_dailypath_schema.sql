-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 11 — DailyPath schema  (RECORD ONLY — already applied to production)
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables created directly in Supabase dashboard (production-only branch).
-- This file exists for auditability; do NOT re-run against a live database.
-- ─────────────────────────────────────────────────────────────────────────────
--
--   ███  THIS FILE DOES NOT DESCRIBE THE LIVE SCHEMA. DO NOT READ IT AS  ███
--   ███  EVIDENCE OF WHAT PRODUCTION CONTAINS. THE LIVE CATALOGUE IS     ███
--   ███  THE ONLY AUTHORITY.                                             ███
--
-- This is a RETROSPECTIVE, HAND-WRITTEN REPRESENTATION of tables created by
-- hand in the Supabase dashboard. It was never executed, and the hand-created
-- tables never matched it. Nothing below has been corrected or re-applied —
-- the file is left exactly as written so the historical record stays intact.
-- Only this notice was added.
--
-- Divergences confirmed against pg_catalog on 2026-10-09:
--
--   daily_adherence
--     · file says      item_id uuid not null references protocol_items(id)
--       LIVE           NO item_id COLUMN AT ALL
--     · file says      unique (member_id, protocol_id, item_id, log_date)
--       LIVE           unique (member_id, protocol_id, item_name, log_date)
--     · live also has  dose, timing, notes  (absent from this file)
--
--   protocol_items
--     · file says      sort_order           LIVE  display_order
--     · live item_type CHECK also allows 'practitioner'
--
--   protocol_templates
--     · file says      status, duration_weeks, root_cause_id
--       LIVE           created_by, is_published (no status / duration_weeks)
--
--   adherence_streaks
--     · file says      protocol_id + unique (member_id, protocol_id)
--       LIVE           NO protocol_id; unique (member_id) only — streaks are
--                      per MEMBER, not per protocol
--
-- Consequence, for the record: application code written against this file
-- queried daily_adherence.item_id for an extended period. Because that column
-- does not exist, the DailyPath page failed and item metadata silently
-- resolved to defaults. Corrected in fix/dailypath-live-schema by matching the
-- live schema; the database was deliberately NOT changed to suit stale code.
-- Verify against the live catalogue, never against this folder.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── protocol_templates ───────────────────────────────────────────────────────
create table if not exists public.protocol_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  duration_weeks  int4 not null default 12,
  root_cause_key  text,                        -- matches root_causes.key
  root_cause_id   uuid references public.root_causes(id),
  status          text not null default 'published',
  created_at      timestamptz default now()
);

-- 5 seeded templates (one per root cause)
insert into public.protocol_templates (name, description, duration_weeks, root_cause_key, status) values
  ('HPA Axis Reset Protocol',
   'A 12-week programme to restore healthy cortisol rhythm through adaptogenic herbs, nervous system regulation, and sleep architecture support.',
   12, 'hpa_dysregulation', 'published'),
  ('Mitochondrial Recharge Protocol',
   'Targeted nutrients and lifestyle practices to restore cellular energy production and reduce oxidative burden.',
   12, 'mitochondrial_dysfunction', 'published'),
  ('Gut Restoration Protocol',
   'A phased approach to rebalancing the gut microbiome, reducing intestinal permeability, and calming systemic inflammation.',
   16, 'gut_dysbiosis', 'published'),
  ('Thyroid Optimisation Protocol',
   'Support for thyroid hormone conversion, receptor sensitivity, and cofactor nutrition across a structured 12-week plan.',
   12, 'thyroid_imbalance', 'published'),
  ('Blood Sugar Balance Protocol',
   'A nutrition-first protocol targeting insulin sensitivity, meal timing, and the supplements that stabilise glucose metabolism.',
   8, 'blood_sugar_dysregulation', 'published')
on conflict do nothing;

-- ── protocol_items ────────────────────────────────────────────────────────────
create table if not exists public.protocol_items (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.protocol_templates(id) on delete cascade,
  name            text not null,
  item_type       text not null default 'supplement',  -- supplement|lifestyle|nutrition|test
  dose            text,
  timing          text,
  duration_weeks  int4,           -- null = full protocol duration
  notes           text,
  sort_order      int4 not null default 0,
  created_at      timestamptz default now()
);

-- 19 seeded items (representative — full seed applied via dashboard)
-- Items are linked to templates by template name; IDs inserted via dashboard script.

-- ── member_protocols ──────────────────────────────────────────────────────────
create table if not exists public.member_protocols (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.profiles(id) on delete cascade,
  template_id  uuid not null references public.protocol_templates(id),
  name         text not null,
  status       text not null default 'active',  -- active|paused|archived
  started_at   date not null,
  paused_at    timestamptz,
  created_at   timestamptz default now()
);

alter table public.member_protocols enable row level security;

create policy "Members can manage own protocols"
  on public.member_protocols
  for all
  using  (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ── daily_adherence ───────────────────────────────────────────────────────────
create table if not exists public.daily_adherence (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.profiles(id) on delete cascade,
  protocol_id  uuid not null references public.member_protocols(id) on delete cascade,
  item_id      uuid not null references public.protocol_items(id),
  item_name    text not null,
  log_date     date not null,
  completed    boolean not null default false,
  completed_at timestamptz,
  skipped      boolean not null default false,
  skip_reason  text,
  created_at   timestamptz default now(),
  unique (member_id, protocol_id, item_id, log_date)
);

alter table public.daily_adherence enable row level security;

create policy "Members can manage own adherence"
  on public.daily_adherence
  for all
  using  (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ── adherence_streaks ─────────────────────────────────────────────────────────
create table if not exists public.adherence_streaks (
  id                   uuid primary key default gen_random_uuid(),
  member_id            uuid not null references public.profiles(id) on delete cascade,
  protocol_id          uuid not null references public.member_protocols(id) on delete cascade,
  current_streak       int4 not null default 0,
  longest_streak       int4 not null default 0,
  last_completed_date  date,
  total_days_completed int4 not null default 0,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique (member_id, protocol_id)
);

alter table public.adherence_streaks enable row level security;

create policy "Members can manage own streaks"
  on public.adherence_streaks
  for all
  using  (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists daily_adherence_member_protocol_date_idx
  on public.daily_adherence (member_id, protocol_id, log_date);

create index if not exists member_protocols_member_status_idx
  on public.member_protocols (member_id, status);
