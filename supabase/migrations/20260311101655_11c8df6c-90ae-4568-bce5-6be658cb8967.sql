-- Drop restrictive policy and recreate as permissive so all authenticated users can read the phone instruction
DROP POLICY IF EXISTS "maintenance_read_phone_instruction" ON public.app_settings;

CREATE POLICY "anyone_read_phone_instruction"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key = 'phone_minutes_instruction');