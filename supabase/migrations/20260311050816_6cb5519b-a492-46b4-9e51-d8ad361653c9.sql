
-- Add data_mode to campaigns (lead vs processing)
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS data_mode text NOT NULL DEFAULT 'lead';

-- Create campaign_websites table for multiple WordPress sites per campaign
CREATE TABLE public.campaign_websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  site_url text NOT NULL,
  webhook_secret text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_websites ENABLE ROW LEVEL SECURITY;

-- SA full access
CREATE POLICY "sa_all_campaign_websites" ON public.campaign_websites FOR ALL TO authenticated
  USING (is_sa(auth.uid())) WITH CHECK (is_sa(auth.uid()));

-- HR full access  
CREATE POLICY "hr_all_campaign_websites" ON public.campaign_websites FOR ALL TO authenticated
  USING (is_hr(auth.uid())) WITH CHECK (is_hr(auth.uid()));

-- TL read own campaign websites
CREATE POLICY "tl_read_campaign_websites" ON public.campaign_websites FOR SELECT TO authenticated
  USING (has_panel(auth.uid(), 'tl') AND campaign_id IN (
    SELECT campaign_id FROM public.campaign_tls WHERE tl_id = get_user_id(auth.uid())
  ));
