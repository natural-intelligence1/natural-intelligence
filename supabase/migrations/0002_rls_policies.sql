-- Enable RLS on all tables
alter table profiles enable row level security;
alter table practitioners enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;
alter table intake_forms enable row level security;
alter table care_plans enable row level security;
alter table assignments enable row level security;
alter table subscriptions enable row level security;

-- Helper function: get current user role
create or replace function get_my_role()
returns user_role as $$
  select role from profiles where id = auth.uid()
$$ language sql security definer stable;

-- Helper function: is admin
create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$ language sql security definer stable;

-- PROFILES policies
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Admin full access to profiles" on profiles for all using (is_admin());
create policy "Public can read practitioner profiles" on profiles for select using (
  exists (select 1 from practitioners where profile_id = profiles.id)
);

-- PRACTITIONERS policies
create policy "Public can read practitioners" on practitioners for select using (true);
create policy "Practitioners can update own record" on practitioners for update using (
  profile_id = auth.uid()
);
create policy "Admin full access to practitioners" on practitioners for all using (is_admin());

-- POSTS policies
create policy "Anyone can read published posts" on posts for select using (status = 'published');
create policy "Authors can manage own posts" on posts for all using (author_id = auth.uid());
create policy "Admin full access to posts" on posts for all using (is_admin());

-- COMMENTS policies
create policy "Anyone can read comments on published posts" on comments for select using (
  exists (select 1 from posts where posts.id = comments.post_id and posts.status = 'published')
);
create policy "Authenticated users can create comments" on comments for insert with check (
  auth.uid() = author_id
);
create policy "Authors can update own comments" on comments for update using (author_id = auth.uid());
create policy "Admin full access to comments" on comments for all using (is_admin());

-- CONVERSATIONS policies
create policy "Participants can view their conversations" on conversations for select using (
  exists (
    select 1 from conversation_participants
    where conversation_id = conversations.id and profile_id = auth.uid()
  )
);
create policy "Admin full access to conversations" on conversations for all using (is_admin());

-- CONVERSATION PARTICIPANTS policies
create policy "Participants can view own participation" on conversation_participants for select using (
  profile_id = auth.uid()
);
create policy "Admin full access to participants" on conversation_participants for all using (is_admin());

-- MESSAGES policies
create policy "Participants can view messages in their conversations" on messages for select using (
  exists (
    select 1 from conversation_participants
    where conversation_id = messages.conversation_id and profile_id = auth.uid()
  )
);
create policy "Participants can send messages" on messages for insert with check (
  sender_id = auth.uid() and
  exists (
    select 1 from conversation_participants
    where conversation_id = messages.conversation_id and profile_id = auth.uid()
  )
);
create policy "Admin full access to messages" on messages for all using (is_admin());

-- INTAKE FORMS policies
create policy "Users can read own intake forms" on intake_forms for select using (user_id = auth.uid());
create policy "Users can create own intake form" on intake_forms for insert with check (user_id = auth.uid());
create policy "Admin full access to intake forms" on intake_forms for all using (is_admin());

-- CARE PLANS policies
create policy "Users can read own care plans" on care_plans for select using (user_id = auth.uid());
create policy "Assigned practitioners can read care plans" on care_plans for select using (
  exists (
    select 1 from assignments
    where care_plan_id = care_plans.id
    and practitioner_id in (
      select id from practitioners where profile_id = auth.uid()
    )
  )
);
create policy "Admin full access to care plans" on care_plans for all using (is_admin());

-- ASSIGNMENTS policies
create policy "Users can view own assignments" on assignments for select using (user_id = auth.uid());
create policy "Practitioners can view own assignments" on assignments for select using (
  practitioner_id in (select id from practitioners where profile_id = auth.uid())
);
create policy "Admin full access to assignments" on assignments for all using (is_admin());

-- SUBSCRIPTIONS policies
create policy "Users can read own subscription" on subscriptions for select using (user_id = auth.uid());
create policy "Admin full access to subscriptions" on subscriptions for all using (is_admin());
