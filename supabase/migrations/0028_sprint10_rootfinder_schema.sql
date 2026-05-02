-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 10 — RootFinder schema  (RECORD ONLY — already applied to production)
-- ─────────────────────────────────────────────────────────────────────────────
-- Tables created directly in Supabase dashboard (production-only branch).
-- This file exists for auditability; do NOT re-run against a live database.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── root_causes ──────────────────────────────────────────────────────────────
create table if not exists public.root_causes (
  id                      uuid primary key default gen_random_uuid(),
  key                     text not null unique,
  name                    text not null,
  description             text,
  colour                  text,                    -- hex colour for UI (e.g. '#4E7A5C')
  sphere_position_theta   float8,                  -- Bloch sphere: polar angle (0–π)
  sphere_position_phi     float8,                  -- Bloch sphere: azimuthal angle (0–2π)
  created_at              timestamptz default now()
);

-- 10 seeded root causes
insert into public.root_causes (key, name, description, colour, sphere_position_theta, sphere_position_phi) values
  ('hpa_dysregulation',        'HPA Axis Dysregulation',       'Chronic stress disrupting the hypothalamic-pituitary-adrenal feedback loop.',                    '#B8935A', 0.52, 0.00),
  ('mitochondrial_dysfunction','Mitochondrial Dysfunction',    'Impaired cellular energy production affecting every organ system.',                             '#4E7A5C', 0.78, 1.05),
  ('gut_dysbiosis',            'Gut Dysbiosis',                'Imbalance in the gut microbiome leading to systemic inflammation and immune dysregulation.',    '#7A6E4E', 1.05, 2.09),
  ('thyroid_imbalance',        'Thyroid Imbalance',            'Sub-clinical or overt dysfunction of thyroid hormone conversion and receptor sensitivity.',    '#5A6E8A', 1.31, 3.14),
  ('nutrient_depletion',       'Nutrient Depletion',           'Functional deficiencies in key micronutrients despite apparent dietary sufficiency.',           '#8A5A7A', 0.26, 4.19),
  ('chronic_inflammation',     'Chronic Inflammation',         'Low-grade systemic inflammation driven by lifestyle, diet, or unresolved infection.',           '#8A4E4E', 1.57, 5.24),
  ('detoxification_burden',    'Detoxification Burden',        'Overloaded phase I/II liver detox pathways leading to toxin accumulation.',                     '#6E8A5A', 2.09, 0.52),
  ('blood_sugar_dysregulation','Blood Sugar Dysregulation',    'Insulin resistance or reactive hypoglycaemia driving energy crashes and cravings.',             '#8A7A4E', 2.36, 1.57),
  ('nervous_system_dysregulation','Nervous System Dysregulation','Autonomic imbalance (sympathetic dominance) impairing rest, repair, and digestion.',         '#4E6E8A', 2.62, 2.62),
  ('hormonal_imbalance',       'Hormonal Imbalance',           'Oestrogen/progesterone/testosterone ratio disruption affecting mood, energy, and cycles.',     '#8A5A6E', 2.88, 4.71)
on conflict (key) do nothing;

-- ── symptoms ─────────────────────────────────────────────────────────────────
create table if not exists public.symptoms (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  category    text,
  description text,
  created_at  timestamptz default now()
);

-- 51 seeded symptoms (abridged DDL — full seed applied via dashboard)
-- Representative sample shown; all 51 rows are live in production.
insert into public.symptoms (key, name, category) values
  ('fatigue',                'Fatigue',                     'energy'),
  ('brain_fog',              'Brain fog',                   'cognition'),
  ('poor_sleep',             'Poor sleep',                  'sleep'),
  ('anxiety',                'Anxiety',                     'mood'),
  ('low_mood',               'Low mood',                    'mood'),
  ('irritability',           'Irritability',                'mood'),
  ('joint_pain',             'Joint pain',                  'pain'),
  ('muscle_aches',           'Muscle aches',                'pain'),
  ('headaches',              'Headaches',                   'pain'),
  ('bloating',               'Bloating',                    'digestive'),
  ('constipation',           'Constipation',                'digestive'),
  ('diarrhoea',              'Diarrhoea',                   'digestive'),
  ('acid_reflux',            'Acid reflux',                 'digestive'),
  ('nausea',                 'Nausea',                      'digestive'),
  ('sugar_cravings',         'Sugar cravings',              'metabolic'),
  ('weight_gain',            'Weight gain',                 'metabolic'),
  ('weight_loss',            'Weight loss',                 'metabolic'),
  ('cold_intolerance',       'Cold intolerance',            'temperature'),
  ('heat_intolerance',       'Heat intolerance',            'temperature'),
  ('night_sweats',           'Night sweats',                'temperature'),
  ('hair_loss',              'Hair loss',                   'skin_hair'),
  ('dry_skin',               'Dry skin',                    'skin_hair'),
  ('acne',                   'Acne',                        'skin_hair'),
  ('eczema',                 'Eczema',                      'skin_hair'),
  ('brittle_nails',          'Brittle nails',               'skin_hair'),
  ('heart_palpitations',     'Heart palpitations',          'cardiovascular'),
  ('dizziness',              'Dizziness',                   'cardiovascular'),
  ('low_blood_pressure',     'Low blood pressure',          'cardiovascular'),
  ('frequent_urination',     'Frequent urination',          'hormonal'),
  ('pms',                    'PMS',                         'hormonal'),
  ('irregular_periods',      'Irregular periods',           'hormonal'),
  ('low_libido',             'Low libido',                  'hormonal'),
  ('infertility',            'Infertility',                 'hormonal'),
  ('memory_issues',          'Memory issues',               'cognition'),
  ('poor_concentration',     'Poor concentration',          'cognition'),
  ('word_finding_difficulty','Word-finding difficulty',     'cognition'),
  ('light_sensitivity',      'Light sensitivity',           'nervous'),
  ('sound_sensitivity',      'Sound sensitivity',           'nervous'),
  ('tingling',               'Tingling / numbness',         'nervous'),
  ('chemical_sensitivity',   'Chemical sensitivity',        'immune'),
  ('frequent_infections',    'Frequent infections',         'immune'),
  ('slow_wound_healing',     'Slow wound healing',          'immune'),
  ('allergies',              'Allergies',                   'immune'),
  ('food_intolerances',      'Food intolerances',           'immune'),
  ('shortness_of_breath',    'Shortness of breath',         'respiratory'),
  ('chronic_cough',          'Chronic cough',               'respiratory'),
  ('poor_exercise_tolerance','Poor exercise tolerance',     'energy'),
  ('post_exertional_malaise','Post-exertional malaise',     'energy'),
  ('teeth_grinding',         'Teeth grinding',              'stress'),
  ('jaw_clenching',          'Jaw clenching',               'stress'),
  ('overwhelm',              'Overwhelm',                   'stress')
on conflict (key) do nothing;

-- ── symptom_root_mappings ────────────────────────────────────────────────────
create table if not exists public.symptom_root_mappings (
  id            uuid primary key default gen_random_uuid(),
  symptom_id    uuid not null references public.symptoms(id)    on delete cascade,
  root_cause_id uuid not null references public.root_causes(id) on delete cascade,
  weight        float8 not null default 1.0,
  unique (symptom_id, root_cause_id)
);

-- ~85 mappings applied directly via dashboard seed script (omitted here for brevity)

-- ── member_symptom_logs ──────────────────────────────────────────────────────
create table if not exists public.member_symptom_logs (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.profiles(id) on delete cascade,
  symptom_id  uuid not null references public.symptoms(id) on delete cascade,
  severity    int2 check (severity between 1 and 3),
  duration    text,
  notes       text,
  session_id  uuid,
  logged_at   timestamptz default now()
);

alter table public.member_symptom_logs enable row level security;

create policy "Members can manage own symptom logs"
  on public.member_symptom_logs
  for all
  using  (member_id = auth.uid())
  with check (member_id = auth.uid());

-- ── rootfinder_results ───────────────────────────────────────────────────────
create table if not exists public.rootfinder_results (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null,
  member_id        uuid not null references public.profiles(id) on delete cascade,
  root_cause_id    uuid not null references public.root_causes(id),
  rank             int2 not null,
  weighted_score   float8 not null,
  confidence_score float8 not null,
  symptom_count    int4 not null default 0,
  created_at       timestamptz default now()
);

alter table public.rootfinder_results enable row level security;

create policy "Members can read own rootfinder results"
  on public.rootfinder_results
  for select
  using (member_id = auth.uid());

-- Indexes
create index if not exists rootfinder_results_member_session_idx
  on public.rootfinder_results (member_id, session_id);

create index if not exists member_symptom_logs_session_idx
  on public.member_symptom_logs (session_id);
