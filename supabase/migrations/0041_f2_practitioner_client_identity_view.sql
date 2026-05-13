-- F2 — practitioner_client_identity view
--
-- Exposes a column-scoped (id, full_name, avatar_url, role) identity view
-- for practitioners reading assigned client profiles.
--
-- Replaces the full-row SELECT policy approach (rejected: application-layer
-- projection is not a security boundary). The view is SECURITY DEFINER so
-- it bypasses the underlying profiles RLS; the WHERE clause is the access gate.
--
-- Exposed columns: id, full_name, avatar_url, role — nothing else.
-- NOT exposed: bio, onboarding_intent, heard_about, timestamps, is_test_data.
--
-- Access rules (additive OR):
--   1. Practitioner has any work item (any status) on a case for this client
--   2. Own profile (self-access)
--   3. Admin access via is_admin()
--
-- Note: no status filter on case_practitioner_work — practitioners retain
-- identity visibility across work history (assigned, in_review, completed,
-- escalated), consistent with F1 spirit.

CREATE OR REPLACE VIEW public.practitioner_client_identity
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  p.role
FROM public.profiles p
WHERE
  EXISTS (
    SELECT 1
    FROM public.case_practitioner_work cpw
    JOIN public.client_cases cc ON cc.id = cpw.case_id
    WHERE cc.client_id = p.id
      AND cpw.practitioner_id = auth.uid()
  )
  OR auth.uid() = p.id
  OR is_admin();

GRANT SELECT ON public.practitioner_client_identity TO authenticated;
