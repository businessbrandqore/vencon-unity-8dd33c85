
CREATE TABLE public.campaign_data_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  data_mode text NOT NULL DEFAULT 'lead',
  fields_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  routing_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, data_mode)
);

ALTER TABLE public.campaign_data_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_all_data_operations" ON public.campaign_data_operations
  FOR ALL TO authenticated
  USING (is_hr(auth.uid()))
  WITH CHECK (is_hr(auth.uid()));

CREATE POLICY "sa_all_data_operations" ON public.campaign_data_operations
  FOR ALL TO authenticated
  USING (is_sa(auth.uid()))
  WITH CHECK (is_sa(auth.uid()));

CREATE POLICY "tl_read_data_operations" ON public.campaign_data_operations
  FOR SELECT TO authenticated
  USING (has_panel(auth.uid(), 'tl'::app_panel) AND campaign_id IN (
    SELECT campaign_id FROM public.campaign_tls WHERE tl_id = get_user_id(auth.uid())
  ));

CREATE POLICY "employee_read_data_operations" ON public.campaign_data_operations
  FOR SELECT TO authenticated
  USING (has_panel(auth.uid(), 'employee'::app_panel));
