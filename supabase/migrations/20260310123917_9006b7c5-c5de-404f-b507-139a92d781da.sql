
-- Allow HR and SA to insert audit logs
CREATE POLICY "hr_insert_audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_hr(auth.uid()));

CREATE POLICY "sa_insert_audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_sa(auth.uid()));
