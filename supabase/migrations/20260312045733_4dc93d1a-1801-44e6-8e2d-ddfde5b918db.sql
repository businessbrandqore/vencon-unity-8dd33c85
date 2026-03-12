
-- Drop old restrictive TL policy for users table
DROP POLICY IF EXISTS "tl_read_group_users" ON public.users;

-- New policy: TL can see themselves, agents in their campaigns, and group leaders of those agents
CREATE POLICY "tl_read_campaign_users" ON public.users
FOR SELECT TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel) AND (
    id = get_user_id(auth.uid())
    OR id IN (
      SELECT car.agent_id FROM campaign_agent_roles car
      WHERE car.tl_id = get_user_id(auth.uid())
    )
    OR id IN (
      SELECT gm.group_leader_id FROM group_members gm
      WHERE gm.agent_id IN (
        SELECT car2.agent_id FROM campaign_agent_roles car2
        WHERE car2.tl_id = get_user_id(auth.uid())
      )
    )
  )
);

-- Drop old restrictive TL policy for group_members
DROP POLICY IF EXISTS "tl_read_own_group" ON public.group_members;

-- New policy: TL can see group_members for agents in their campaigns
CREATE POLICY "tl_read_campaign_groups" ON public.group_members
FOR SELECT TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel) AND (
    group_leader_id = get_user_id(auth.uid())
    OR agent_id IN (
      SELECT car.agent_id FROM campaign_agent_roles car
      WHERE car.tl_id = get_user_id(auth.uid())
    )
  )
);
