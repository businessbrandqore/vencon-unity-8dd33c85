
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- HR and SA can manage templates
CREATE POLICY "hr_sa_manage_templates" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (public.is_hr(auth.uid()) OR public.is_sa(auth.uid()))
  WITH CHECK (public.is_hr(auth.uid()) OR public.is_sa(auth.uid()));

-- All authenticated users can read active templates
CREATE POLICY "read_active_templates" ON public.whatsapp_templates
  FOR SELECT TO authenticated
  USING (is_active = true);
