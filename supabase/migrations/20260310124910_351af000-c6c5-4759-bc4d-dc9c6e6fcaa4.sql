
-- Table to track Bronze/Silver agent assignments per campaign
CREATE TABLE public.campaign_agent_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  is_bronze boolean NOT NULL DEFAULT false,
  is_silver boolean NOT NULL DEFAULT false,
  tl_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, agent_id)
);

ALTER TABLE public.campaign_agent_roles ENABLE ROW LEVEL SECURITY;

-- TL can manage their own campaign agent roles
CREATE POLICY "tl_manage_campaign_agent_roles" ON public.campaign_agent_roles
  FOR ALL TO authenticated
  USING (tl_id = get_user_id(auth.uid()))
  WITH CHECK (tl_id = get_user_id(auth.uid()));

-- HR can read all
CREATE POLICY "hr_read_campaign_agent_roles" ON public.campaign_agent_roles
  FOR SELECT TO authenticated
  USING (is_hr(auth.uid()));

-- SA can do all
CREATE POLICY "sa_all_campaign_agent_roles" ON public.campaign_agent_roles
  FOR ALL TO authenticated
  USING (is_sa(auth.uid()))
  WITH CHECK (is_sa(auth.uid()));

-- Agents can read their own roles
CREATE POLICY "agent_read_own_campaign_roles" ON public.campaign_agent_roles
  FOR SELECT TO authenticated
  USING (agent_id = get_user_id(auth.uid()));

-- Also add a campaign_tls junction table to track which TLs are assigned to which campaigns
CREATE TABLE public.campaign_tls (
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  tl_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (campaign_id, tl_id)
);

ALTER TABLE public.campaign_tls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tl_read_own_campaigns" ON public.campaign_tls
  FOR SELECT TO authenticated
  USING (tl_id = get_user_id(auth.uid()));

CREATE POLICY "hr_all_campaign_tls" ON public.campaign_tls
  FOR ALL TO authenticated
  USING (is_hr(auth.uid()))
  WITH CHECK (is_hr(auth.uid()));

CREATE POLICY "sa_all_campaign_tls" ON public.campaign_tls
  FOR ALL TO authenticated
  USING (is_sa(auth.uid()))
  WITH CHECK (is_sa(auth.uid()));

-- TL needs to insert leads (for assigning)
CREATE POLICY "tl_insert_leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (has_panel(auth.uid(), 'tl'::app_panel) AND tl_id = get_user_id(auth.uid()));

-- TL needs to manage pre_orders (update/delete)
CREATE POLICY "tl_update_preorders" ON public.pre_orders
  FOR UPDATE TO authenticated
  USING (has_panel(auth.uid(), 'tl'::app_panel) AND tl_id = get_user_id(auth.uid()));

CREATE POLICY "tl_delete_preorders" ON public.pre_orders
  FOR DELETE TO authenticated
  USING (has_panel(auth.uid(), 'tl'::app_panel) AND tl_id = get_user_id(auth.uid()));

-- TL needs to delete leads from delete sheet
CREATE POLICY "tl_delete_leads" ON public.leads
  FOR DELETE TO authenticated
  USING (has_panel(auth.uid(), 'tl'::app_panel) AND tl_id = get_user_id(auth.uid()));
