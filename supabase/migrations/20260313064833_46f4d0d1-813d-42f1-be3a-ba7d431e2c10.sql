
-- Allow maintenance_officer to read all attendance records (for desk reports)
CREATE POLICY "maintenance_read_attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'maintenance_officer'
  ));
