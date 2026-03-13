
-- Off-day change appeals
CREATE TABLE public.off_day_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  off_id uuid NOT NULL REFERENCES public.employee_monthly_offs(id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES public.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.off_day_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_insert_own_off_appeals" ON public.off_day_appeals FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id(auth.uid()));

CREATE POLICY "employee_read_own_off_appeals" ON public.off_day_appeals FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));

CREATE POLICY "hr_all_off_appeals" ON public.off_day_appeals FOR ALL TO authenticated
  USING (is_hr(auth.uid())) WITH CHECK (is_hr(auth.uid()));

CREATE POLICY "sa_all_off_appeals" ON public.off_day_appeals FOR ALL TO authenticated
  USING (is_sa(auth.uid())) WITH CHECK (is_sa(auth.uid()));

-- Employee complaints
CREATE TABLE public.employee_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complainant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES public.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_complaints ENABLE ROW LEVEL SECURITY;

-- Employees can file complaints
CREATE POLICY "employee_insert_complaints" ON public.employee_complaints FOR INSERT TO authenticated
  WITH CHECK (complainant_id = get_user_id(auth.uid()));

-- Employees can read their own filed complaints
CREATE POLICY "employee_read_own_complaints" ON public.employee_complaints FOR SELECT TO authenticated
  USING (complainant_id = get_user_id(auth.uid()));

-- SA full access
CREATE POLICY "sa_all_complaints" ON public.employee_complaints FOR ALL TO authenticated
  USING (is_sa(auth.uid())) WITH CHECK (is_sa(auth.uid()));

-- HR full access
CREATE POLICY "hr_all_complaints" ON public.employee_complaints FOR ALL TO authenticated
  USING (is_hr(auth.uid())) WITH CHECK (is_hr(auth.uid()));

-- BDO read all
CREATE POLICY "bdo_read_complaints" ON public.employee_complaints FOR SELECT TO authenticated
  USING (is_bdo(auth.uid()));

-- TL read complaints for their campaign agents
CREATE POLICY "tl_read_complaints" ON public.employee_complaints FOR SELECT TO authenticated
  USING (has_panel(auth.uid(), 'tl') AND (
    target_id IN (SELECT car.agent_id FROM campaign_agent_roles car WHERE car.tl_id = get_user_id(auth.uid()))
  ));

-- Read approved complaint count (for red dots) - SA/HR/BDO/TL can read target complaints
CREATE POLICY "privileged_read_target_complaints" ON public.employee_complaints FOR SELECT TO authenticated
  USING (
    status = 'approved' AND (
      is_sa(auth.uid()) OR is_hr(auth.uid()) OR is_bdo(auth.uid()) OR
      has_panel(auth.uid(), 'tl')
    )
  );
