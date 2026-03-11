
CREATE TABLE public.employee_monthly_offs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  off_date date NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  assigned_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, off_date)
);

ALTER TABLE public.employee_monthly_offs ENABLE ROW LEVEL SECURITY;

-- HR can do everything
CREATE POLICY "hr_all_employee_offs" ON public.employee_monthly_offs
  FOR ALL TO authenticated
  USING (is_hr(auth.uid()))
  WITH CHECK (is_hr(auth.uid()));

-- SA can do everything
CREATE POLICY "sa_all_employee_offs" ON public.employee_monthly_offs
  FOR ALL TO authenticated
  USING (is_sa(auth.uid()))
  WITH CHECK (is_sa(auth.uid()));

-- Employees can read their own
CREATE POLICY "employee_read_own_offs" ON public.employee_monthly_offs
  FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));
