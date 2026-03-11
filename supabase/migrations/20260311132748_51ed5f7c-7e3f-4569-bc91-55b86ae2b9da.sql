-- BDO can read all campaign_agent_roles
CREATE POLICY "bdo_read_all_campaign_agent_roles"
  ON public.campaign_agent_roles
  FOR SELECT
  TO authenticated
  USING (is_bdo(auth.uid()));

-- BDO can read all campaign_tls
CREATE POLICY "bdo_read_all_campaign_tls"
  ON public.campaign_tls
  FOR SELECT
  TO authenticated
  USING (is_bdo(auth.uid()));

-- BDO can read all campaigns
CREATE POLICY "bdo_read_all_campaigns"
  ON public.campaigns
  FOR SELECT
  TO authenticated
  USING (is_bdo(auth.uid()));