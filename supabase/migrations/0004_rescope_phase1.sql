-- Applied via Supabase MCP 2026-04-03
-- Rescope to Phase 1 MVP: drop clinical tables, add community platform tables

drop table if exists care_plans cascade;
drop table if exists assignments cascade;
drop table if exists intake_forms cascade;

alter type user_role add value if not exists 'member';

alter table practitioners
  add column if not exists modalities text,
  add column if not exists years_experience int,
  add column if not exists website_url text,
  add column if not exists linkedin_url text,
  add column if not exists is_active boolean not null default true,
  add column if not exists display_order int not null default 0;

alter table posts
  add column if not exists image_urls text[] default '{}',
  add column if not exists like_count int not null default 0;

create table if not exists post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, profile_id)
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null default 'workshop'
    check (event_type in ('workshop', 'group_session', 'qa', 'webinar')),
  practitioner_id uuid references practitioners(id),
  hosted_by uuid references profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  is_online boolean default true,
  meeting_url text,
  max_capacity int,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled', 'completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  member_id uuid not null references profiles(id) on delete cascade,
  registered_at timestamptz default now(),
  attended boolean default false,
  unique(event_id, member_id)
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  body text,
  resource_type text not null default 'article'
    check (resource_type in ('article', 'guide', 'video_link', 'podcast_link', 'external_link')),
  author_id uuid references profiles(id),
  topic_tags text[] default '{}',
  status content_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists practitioner_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  specialties text[] default '{}',
  credentials text,
  bio text,
  years_experience int,
  modalities text,
  website_url text,
  linkedin_url text,
  motivation text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  submitted_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists support_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id),
  full_name text not null,
  email text not null,
  phone text,
  request_type text not null default 'general'
    check (request_type in ('general', 'referral', 'charity_referral', 'practitioner_match', 'other')),
  description text not null,
  urgency text default 'normal'
    check (urgency in ('low', 'normal', 'high')),
  status text not null default 'new'
    check (status in ('new', 'in_review', 'actioned', 'closed')),
  assigned_to uuid references profiles(id),
  admin_notes text,
  submitted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  email text,
  consent_type text not null
    check (consent_type in ('platform_terms', 'marketing', 'data_processing', 'workshop_waiver')),
  consented boolean not null default false,
  consented_at timestamptz,
  ip_address text,
  created_at timestamptz default now()
);

create trigger events_updated_at
  before update on events
  for each row execute procedure handle_updated_at();

create trigger resources_updated_at
  before update on resources
  for each row execute procedure handle_updated_at();

create trigger practitioner_applications_updated_at
  before update on practitioner_applications
  for each row execute procedure handle_updated_at();

create trigger support_requests_updated_at
  before update on support_requests
  for each row execute procedure handle_updated_at();
