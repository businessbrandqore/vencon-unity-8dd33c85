
-- Settings table for HR customization
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb DEFAULT '{}',
  updated_by uuid REFERENCES public.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_hr_read_settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (is_sa(auth.uid()) OR is_hr(auth.uid()));

CREATE POLICY "sa_hr_upsert_settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_sa(auth.uid()) OR is_hr(auth.uid()));

CREATE POLICY "sa_hr_update_settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (is_sa(auth.uid()) OR is_hr(auth.uid()));

-- Storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('app-assets', 'app-assets', true);

CREATE POLICY "sa_hr_upload_assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-assets' AND (is_sa(auth.uid()) OR is_hr(auth.uid())));

CREATE POLICY "public_read_assets" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'app-assets');
