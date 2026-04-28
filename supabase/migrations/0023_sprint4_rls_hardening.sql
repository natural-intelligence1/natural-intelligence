-- Sprint 4 RLS hardening
-- Applied directly via Supabase MCP on 2026-04-28
-- Fixes: INSERT policies {public} → {authenticated}
-- Adds: member SELECT on support_requests
-- Fixes: practitioners UPDATE WITH CHECK clause

DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
CREATE POLICY "Authenticated users can create comments"
ON comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Members can register for events" ON event_registrations;
CREATE POLICY "Members can register for events"
ON event_registrations FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid());

DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages"
ON messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = messages.conversation_id
    AND profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can like posts" ON post_likes;
CREATE POLICY "Authenticated users can like posts"
ON post_likes FOR INSERT TO authenticated
WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Practitioners can update own record" ON practitioners;
CREATE POLICY "Practitioners can update own record"
ON practitioners FOR UPDATE TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Members can view own support requests" ON support_requests;
CREATE POLICY "Members can view own support requests"
ON support_requests FOR SELECT TO authenticated
USING (member_id = auth.uid());
