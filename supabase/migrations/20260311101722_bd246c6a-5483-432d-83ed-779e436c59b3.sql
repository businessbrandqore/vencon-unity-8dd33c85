-- Replace the restrictive SA/HR read policy to also allow phone_minutes_instruction for all
DROP POLICY IF EXISTS "sa_hr_read_settings" ON public.app_settings;

CREATE POLICY "sa_hr_read_settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);