
-- Allow HR to update campaigns
CREATE POLICY "hr_update_campaigns" ON public.campaigns
FOR UPDATE TO authenticated
USING (is_hr(auth.uid()))
WITH CHECK (is_hr(auth.uid()));

-- Allow HR to insert campaigns
CREATE POLICY "hr_insert_campaigns" ON public.campaigns
FOR INSERT TO authenticated
WITH CHECK (is_hr(auth.uid()));

-- Allow HR to delete campaign_websites
CREATE POLICY "hr_delete_campaign_websites" ON public.campaign_websites
FOR DELETE TO authenticated
USING (is_hr(auth.uid()));

-- Allow HR to insert campaign_websites
CREATE POLICY "hr_insert_campaign_websites" ON public.campaign_websites
FOR INSERT TO authenticated
WITH CHECK (is_hr(auth.uid()));

-- Allow HR to update campaign_websites
CREATE POLICY "hr_update_campaign_websites" ON public.campaign_websites
FOR UPDATE TO authenticated
USING (is_hr(auth.uid()))
WITH CHECK (is_hr(auth.uid()));
