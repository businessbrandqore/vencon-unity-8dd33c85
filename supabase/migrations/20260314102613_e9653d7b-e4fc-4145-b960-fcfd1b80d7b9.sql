
-- Drop and recreate the employee_update_own_leads policy to allow setting assigned_to to NULL
DROP POLICY IF EXISTS "employee_update_own_leads" ON public.leads;

CREATE POLICY "employee_update_own_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (assigned_to = get_user_id(auth.uid()))
WITH CHECK (
  (assigned_to = get_user_id(auth.uid()))
  OR
  (assigned_to IS NULL)
);
