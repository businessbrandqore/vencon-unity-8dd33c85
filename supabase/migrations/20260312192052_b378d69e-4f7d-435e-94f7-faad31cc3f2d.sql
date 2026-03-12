-- Allow HR to insert into campaign_agent_roles
CREATE POLICY "hr_insert_campaign_agent_roles"
  ON public.campaign_agent_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (is_hr(auth.uid()));

-- Also fix: insert Siraj into campaign_agent_roles for Campaign Alpha
INSERT INTO public.campaign_agent_roles (campaign_id, agent_id, tl_id, is_bronze, is_silver)
VALUES (
  '49de7ead-7039-45f6-ae87-5651a2edb4b8',
  '8d99277f-1442-410a-aef4-0e971e96050a',
  'a2242f0d-828f-4a2e-bcd9-9ded5d8260b1',
  true,
  false
);