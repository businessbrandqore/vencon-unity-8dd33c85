-- Allow TL users to view unassigned fresh/bronze leads for campaigns assigned to them
DROP POLICY IF EXISTS "tl_read_unassigned_campaign_fresh_leads" ON public.leads;
CREATE POLICY "tl_read_unassigned_campaign_fresh_leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel)
  AND tl_id IS NULL
  AND assigned_to IS NULL
  AND campaign_id IN (
    SELECT ct.campaign_id
    FROM public.campaign_tls ct
    WHERE ct.tl_id = get_user_id(auth.uid())
  )
);

-- Allow TL users to claim (assign/update) those unassigned leads into their own ownership
DROP POLICY IF EXISTS "tl_claim_unassigned_campaign_fresh_leads" ON public.leads;
CREATE POLICY "tl_claim_unassigned_campaign_fresh_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel)
  AND tl_id IS NULL
  AND assigned_to IS NULL
  AND campaign_id IN (
    SELECT ct.campaign_id
    FROM public.campaign_tls ct
    WHERE ct.tl_id = get_user_id(auth.uid())
  )
)
WITH CHECK (
  has_panel(auth.uid(), 'tl'::app_panel)
  AND tl_id = get_user_id(auth.uid())
);

-- ATL users should be able to view unassigned campaign fresh data under their mapped TL campaigns
DROP POLICY IF EXISTS "atl_read_unassigned_campaign_fresh_leads" ON public.leads;
CREATE POLICY "atl_read_unassigned_campaign_fresh_leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  is_atl(auth.uid())
  AND tl_id IS NULL
  AND assigned_to IS NULL
  AND campaign_id IN (
    SELECT DISTINCT car.campaign_id
    FROM public.campaign_agent_roles car
    WHERE car.agent_id = get_user_id(auth.uid())
      AND car.tl_id IN (
        SELECT get_atl_tl_ids(get_user_id(auth.uid()))
      )
  )
);

-- ATL users should be able to claim those leads into their mapped TL ownership
DROP POLICY IF EXISTS "atl_claim_unassigned_campaign_fresh_leads" ON public.leads;
CREATE POLICY "atl_claim_unassigned_campaign_fresh_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  is_atl(auth.uid())
  AND tl_id IS NULL
  AND assigned_to IS NULL
  AND campaign_id IN (
    SELECT DISTINCT car.campaign_id
    FROM public.campaign_agent_roles car
    WHERE car.agent_id = get_user_id(auth.uid())
      AND car.tl_id IN (
        SELECT get_atl_tl_ids(get_user_id(auth.uid()))
      )
  )
)
WITH CHECK (
  is_atl(auth.uid())
  AND tl_id IN (
    SELECT get_atl_tl_ids(get_user_id(auth.uid()))
  )
);