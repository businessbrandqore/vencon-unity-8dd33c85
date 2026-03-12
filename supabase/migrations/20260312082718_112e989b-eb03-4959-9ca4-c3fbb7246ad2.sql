
-- Allow BDO to manage (INSERT, UPDATE, DELETE) campaign_agent_roles
CREATE POLICY "bdo_manage_campaign_agent_roles"
ON public.campaign_agent_roles
FOR ALL
TO authenticated
USING (is_bdo(auth.uid()))
WITH CHECK (is_bdo(auth.uid()));
