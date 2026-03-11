-- Allow maintenance officers to read and update phone_minutes_instruction in app_settings
CREATE POLICY "maintenance_read_phone_instruction"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key = 'phone_minutes_instruction');

CREATE POLICY "maintenance_update_phone_instruction"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (key = 'phone_minutes_instruction' AND EXISTS (
  SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'maintenance_officer'
));

CREATE POLICY "maintenance_insert_phone_instruction"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (key = 'phone_minutes_instruction' AND EXISTS (
  SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'maintenance_officer'
));