
-- Allow BDO to read and manage group_creation approvals in sa_approvals
CREATE POLICY "bdo_read_group_approvals" ON public.sa_approvals
FOR SELECT TO authenticated
USING (is_bdo(auth.uid()) AND type = 'group_creation');

CREATE POLICY "bdo_update_group_approvals" ON public.sa_approvals
FOR UPDATE TO authenticated
USING (is_bdo(auth.uid()) AND type = 'group_creation');

-- Allow TL to insert group_creation approvals
CREATE POLICY "tl_insert_group_approvals" ON public.sa_approvals
FOR INSERT TO authenticated
WITH CHECK (has_panel(auth.uid(), 'tl') AND type = 'group_creation' AND requested_by = get_user_id(auth.uid()));

-- Allow TL to read their own group_creation approvals
CREATE POLICY "tl_read_own_group_approvals" ON public.sa_approvals
FOR SELECT TO authenticated
USING (has_panel(auth.uid(), 'tl') AND type = 'group_creation' AND requested_by = get_user_id(auth.uid()));

-- Allow BDO to manage group_members (insert/delete for approval flow)
CREATE POLICY "bdo_all_group_members" ON public.group_members
FOR ALL TO authenticated
USING (is_bdo(auth.uid()))
WITH CHECK (is_bdo(auth.uid()));

-- Allow TL to insert/delete group_members for their campaign agents
CREATE POLICY "tl_manage_group_members" ON public.group_members
FOR ALL TO authenticated
USING (has_panel(auth.uid(), 'tl') AND (
  agent_id IN (SELECT car.agent_id FROM campaign_agent_roles car WHERE car.tl_id = get_user_id(auth.uid()))
  OR group_leader_id IN (SELECT car.agent_id FROM campaign_agent_roles car WHERE car.tl_id = get_user_id(auth.uid()))
))
WITH CHECK (has_panel(auth.uid(), 'tl') AND (
  agent_id IN (SELECT car.agent_id FROM campaign_agent_roles car WHERE car.tl_id = get_user_id(auth.uid()))
  OR group_leader_id IN (SELECT car.agent_id FROM campaign_agent_roles car WHERE car.tl_id = get_user_id(auth.uid()))
));
