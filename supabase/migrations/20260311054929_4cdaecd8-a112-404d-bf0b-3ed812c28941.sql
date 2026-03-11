
-- Monthly holidays table: HR sets holidays per month, employees can view
CREATE TABLE public.monthly_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  holiday_date date NOT NULL,
  title text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(holiday_date)
);

ALTER TABLE public.monthly_holidays ENABLE ROW LEVEL SECURITY;

-- HR can manage
CREATE POLICY "hr_all_monthly_holidays" ON public.monthly_holidays
  FOR ALL TO authenticated
  USING (is_hr(auth.uid()))
  WITH CHECK (is_hr(auth.uid()));

-- SA can manage
CREATE POLICY "sa_all_monthly_holidays" ON public.monthly_holidays
  FOR ALL TO authenticated
  USING (is_sa(auth.uid()))
  WITH CHECK (is_sa(auth.uid()));

-- All authenticated users can read (employees see holidays)
CREATE POLICY "authenticated_read_monthly_holidays" ON public.monthly_holidays
  FOR SELECT TO authenticated
  USING (true);
