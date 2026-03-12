
-- Allow TL to read attendance of agents in their campaigns
CREATE POLICY "tl_read_campaign_agent_attendance" ON public.attendance
FOR SELECT TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel) AND (
    user_id IN (
      SELECT car.agent_id FROM campaign_agent_roles car
      WHERE car.tl_id = get_user_id(auth.uid())
    )
  )
);
