
-- Add webhook_secret to campaigns table
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS webhook_secret text DEFAULT encode(gen_random_bytes(32), 'hex');

-- Add import_source column to leads for tracking import method
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS import_source text DEFAULT NULL;

-- Create lead_import_logs table
CREATE TABLE IF NOT EXISTS public.lead_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  source text NOT NULL DEFAULT 'webhook',
  leads_imported integer NOT NULL DEFAULT 0,
  duplicates_skipped integer NOT NULL DEFAULT 0,
  total_received integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  imported_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lead_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_all_import_logs" ON public.lead_import_logs FOR ALL TO authenticated
  USING (is_hr(auth.uid())) WITH CHECK (is_hr(auth.uid()));

CREATE POLICY "sa_all_import_logs" ON public.lead_import_logs FOR ALL TO authenticated
  USING (is_sa(auth.uid())) WITH CHECK (is_sa(auth.uid()));

-- Backfill existing campaigns with webhook_secret
UPDATE public.campaigns SET webhook_secret = encode(gen_random_bytes(32), 'hex') WHERE webhook_secret IS NULL;
