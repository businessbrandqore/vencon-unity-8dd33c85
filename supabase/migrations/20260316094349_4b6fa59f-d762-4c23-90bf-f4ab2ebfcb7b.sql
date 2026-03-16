-- Allow TLs to read all leads in their assigned campaigns (not just tl_id = self)
CREATE POLICY "tl_read_campaign_leads"
ON public.leads FOR SELECT
TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel)
  AND campaign_id IN (
    SELECT ct.campaign_id FROM campaign_tls ct WHERE ct.tl_id = get_user_id(auth.uid())
  )
);

-- Allow TLs to update all leads in their assigned campaigns
CREATE POLICY "tl_update_campaign_leads"
ON public.leads FOR UPDATE
TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::app_panel)
  AND campaign_id IN (
    SELECT ct.campaign_id FROM campaign_tls ct WHERE ct.tl_id = get_user_id(auth.uid())
  )
)
WITH CHECK (
  has_panel(auth.uid(), 'tl'::app_panel)
  AND campaign_id IN (
    SELECT ct.campaign_id FROM campaign_tls ct WHERE ct.tl_id = get_user_id(auth.uid())
  )
);