-- ENUMS
create type user_role as enum ('user', 'practitioner', 'admin');
create type trust_level as enum ('vetted', 'unvetted');
create type content_status as enum ('draft', 'published', 'archived');
create type intake_status as enum ('pending', 'reviewing', 'assigned', 'active', 'closed');
create type message_status as enum ('sent', 'delivered', 'read', 'filtered');
create type subscription_status as enum ('inactive', 'active', 'cancelled', 'past_due');

-- PROFILES (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'user',
  full_name text,
  avatar_url text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PRACTITIONERS
create table practitioners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  trust_level trust_level not null default 'unvetted',
  specialties text[] default '{}',
  credentials text[] default '{}',
  location text,
  accepted_at timestamptz,
  vetted_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- POSTS
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  title text,
  body text not null,
  post_type text not null default 'update' check (post_type in ('post', 'update')),
  status content_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- COMMENTS
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CONVERSATIONS
create table conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

-- CONVERSATION PARTICIPANTS
create table conversation_participants (
  conversation_id uuid references conversations(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  primary key (conversation_id, profile_id)
);

-- MESSAGES
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  status message_status not null default 'sent',
  filtered_reason text,
  created_at timestamptz default now()
);

-- INTAKE FORMS
create table intake_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  status intake_status not null default 'pending',
  health_goals text,
  current_conditions text,
  medications text,
  lifestyle_notes text,
  submitted_at timestamptz default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CARE PLANS
create table care_plans (
  id uuid primary key default gen_random_uuid(),
  intake_form_id uuid not null references intake_forms(id),
  user_id uuid not null references profiles(id),
  created_by uuid not null references profiles(id),
  plan_details text not null,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ASSIGNMENTS (practitioner to user via care plan)
create table assignments (
  id uuid primary key default gen_random_uuid(),
  care_plan_id uuid not null references care_plans(id),
  practitioner_id uuid not null references practitioners(id),
  user_id uuid not null references profiles(id),
  assigned_by uuid not null references profiles(id),
  active boolean default true,
  created_at timestamptz default now()
);

-- SUBSCRIPTIONS
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  care_plan_id uuid references care_plans(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  status subscription_status not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- UPDATED_AT trigger function
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger profiles_updated_at before update on profiles for each row execute procedure handle_updated_at();
create trigger practitioners_updated_at before update on practitioners for each row execute procedure handle_updated_at();
create trigger posts_updated_at before update on posts for each row execute procedure handle_updated_at();
create trigger comments_updated_at before update on comments for each row execute procedure handle_updated_at();
create trigger intake_forms_updated_at before update on intake_forms for each row execute procedure handle_updated_at();
create trigger care_plans_updated_at before update on care_plans for each row execute procedure handle_updated_at();
create trigger subscriptions_updated_at before update on subscriptions for each row execute procedure handle_updated_at();
