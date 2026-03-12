-- Update BDO RLS policies on sa_approvals to also handle gl_campaign_assignment type
DROP POLICY IF EXISTS "bdo_read_group_approvals" ON public.sa_approvals;
DROP POLICY IF EXISTS "bdo_update_group_approvals" ON public.sa_approvals;

CREATE POLICY "bdo_read_group_approvals" ON public.sa_approvals
FOR SELECT TO authenticated
USING (is_bdo(auth.uid()) AND type IN ('group_creation', 'gl_campaign_assignment'));

CREATE POLICY "bdo_update_group_approvals" ON public.sa_approvals
FOR UPDATE TO authenticated
USING (is_bdo(auth.uid()) AND type IN ('group_creation', 'gl_campaign_assignment'));