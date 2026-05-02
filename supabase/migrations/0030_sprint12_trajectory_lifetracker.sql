-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 12 — Trajectory + LifeTracker schema  (RECORD ONLY — already applied)
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables created directly in Supabase dashboard (production).
-- This file exists for auditability; do NOT re-run against a live database.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── biomarker_trajectory ──────────────────────────────────────────────────────
-- One row per biomarker per lab report; feeds the Trajectory chart.
create table if not exists public.biomarker_trajectory (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.profiles(id) on delete cascade,
  report_id       uuid references public.lab_reports(id) on delete set null,
  marker_key      text not null,
  marker_name     text not null,
  value           numeric,
  unit            text,
  functional_zone int4,
  report_date     date,
  created_at      timestamptz default now()
);

alter table public.biomarker_trajectory enable row level security;

create policy "Members can view own trajectory"
  on public.biomarker_trajectory
  for select
  using (member_id = auth.uid());

create index if not exists biomarker_trajectory_member_marker_date_idx
  on public.biomarker_trajectory (member_id, marker_key, report_date);

-- ── lifetracker_checkins ──────────────────────────────────────────────────────
-- One check-in per member per day; stores 5 ratings (1-10 each).
create table if not exists public.lifetracker_checkins (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references public.profiles(id) on delete cascade,
  checkin_date     date not null,
  energy_rating    int4 check (energy_rating between 1 and 10),
  sleep_rating     int4 check (sleep_rating  between 1 and 10),
  mood_rating      int4 check (mood_rating   between 1 and 10),
  digestion_rating int4 check (digestion_rating between 1 and 10),
  overall_rating   int4 check (overall_rating   between 1 and 10),
  notes            text,
  created_at       timestamptz default now(),
  unique (member_id, checkin_date)
);

alter table public.lifetracker_checkins enable row level security;

create policy "Members can manage own checkins"
  on public.lifetracker_checkins
  for all
  using  (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ── lifetracker_goals ────────────────────────────────────────────────────────
-- Member health goals with optional target metrics.
create table if not exists public.lifetracker_goals (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  description     text,
  category        text,            -- energy|sleep|mood|fitness|nutrition|digestion|weight|other
  target_value    numeric,
  target_unit     text,
  target_date     date,
  baseline_value  numeric,
  current_value   numeric,
  status          text not null default 'active',  -- active|completed|paused|archived
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.lifetracker_goals enable row level security;

create policy "Members can manage own goals"
  on public.lifetracker_goals
  for all
  using  (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ── vitality_scores ───────────────────────────────────────────────────────────
-- One computed vitality score per member per day.
-- overall_score = (physical+cognitive+emotional+hormonal)/4 × 0.6 + adherence_pct × 0.4
create table if not exists public.vitality_scores (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references public.profiles(id) on delete cascade,
  score_date      date not null,
  physical_score  numeric,
  cognitive_score numeric,
  emotional_score numeric,
  hormonal_score  numeric,
  biomarker_score numeric,
  adherence_pct   numeric,
  overall_score   numeric,
  notes           text,
  created_at      timestamptz default now(),
  unique (member_id, score_date)
);

alter table public.vitality_scores enable row level security;

create policy "Members can manage own vitality scores"
  on public.vitality_scores
  for all
  using  (member_id = auth.uid())
  with check (member_id = auth.uid());

create index if not exists vitality_scores_member_date_idx
  on public.vitality_scores (member_id, score_date desc);
