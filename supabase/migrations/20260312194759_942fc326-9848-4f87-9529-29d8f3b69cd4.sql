
-- GL needs to read leads for their group agents
CREATE POLICY "gl_read_group_agent_leads"
ON public.leads FOR SELECT TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel) AND 
  assigned_to IN (
    SELECT gm.agent_id FROM group_members gm 
    WHERE gm.group_leader_id = get_user_id(auth.uid())
  )
);

-- GL needs to read orders for their group agents
CREATE POLICY "gl_read_group_agent_orders"
ON public.orders FOR SELECT TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel) AND 
  agent_id IN (
    SELECT gm.agent_id FROM group_members gm 
    WHERE gm.group_leader_id = get_user_id(auth.uid())
  )
);

-- GL needs to read incentive_config for their role
CREATE POLICY "gl_read_incentive_config"
ON public.incentive_config FOR SELECT TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel) AND role = 'group_leader' AND status = 'approved'
);

-- GL needs to read leave_requests for their group agents
CREATE POLICY "gl_read_group_agent_leaves"
ON public.leave_requests FOR SELECT TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel) AND 
  user_id IN (
    SELECT gm.agent_id FROM group_members gm 
    WHERE gm.group_leader_id = get_user_id(auth.uid())
  )
);
