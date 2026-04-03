-- Applied via Supabase MCP 2026-04-03
-- RLS for new Phase 1 tables

alter table post_likes enable row level security;
create policy "Anyone can view post likes" on post_likes for select using (true);
create policy "Members can like posts" on post_likes for insert with check (profile_id = auth.uid());
create policy "Members can unlike own likes" on post_likes for delete using (profile_id = auth.uid());

alter table events enable row level security;
create policy "Anyone can view published events" on events for select using (status = 'published');
create policy "Admin full access to events" on events for all using (is_admin());
create policy "Practitioners can manage own events" on events for all using (hosted_by = auth.uid());

alter table event_registrations enable row level security;
create policy "Members can view own registrations" on event_registrations for select using (member_id = auth.uid());
create policy "Members can register for events" on event_registrations for insert with check (member_id = auth.uid());
create policy "Members can cancel own registration" on event_registrations for delete using (member_id = auth.uid());
create policy "Admin full access to registrations" on event_registrations for all using (is_admin());

alter table resources enable row level security;
create policy "Anyone can view published resources" on resources for select using (status = 'published');
create policy "Admin full access to resources" on resources for all using (is_admin());
create policy "Authors can manage own resources" on resources for all using (author_id = auth.uid());

alter table practitioner_applications enable row level security;
create policy "Public can submit applications" on practitioner_applications for insert with check (true);
create policy "Admin full access to applications" on practitioner_applications for all using (is_admin());

alter table support_requests enable row level security;
create policy "Anyone can submit support requests" on support_requests for insert with check (true);
create policy "Members can view own requests" on support_requests for select using (member_id = auth.uid());
create policy "Admin full access to support requests" on support_requests for all using (is_admin());

alter table consent_records enable row level security;
create policy "Users can view own consent records" on consent_records for select using (profile_id = auth.uid());
create policy "Anyone can create consent record" on consent_records for insert with check (true);
create policy "Admin full access to consent records" on consent_records for all using (is_admin());
