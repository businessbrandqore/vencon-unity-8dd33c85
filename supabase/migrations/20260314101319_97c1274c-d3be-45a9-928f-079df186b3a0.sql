
-- Drop the old restrictive policy
DROP POLICY IF EXISTS "employee_update_own_leads" ON public.leads;

-- Recreate with a more permissive WITH CHECK that allows unsetting assigned_to
-- The employee can update their own leads, and can set assigned_to to NULL (for order routing)
CREATE POLICY "employee_update_own_leads"
ON public.leads FOR UPDATE
TO authenticated
USING (assigned_to = get_user_id(auth.uid()))
WITH CHECK (
  (assigned_to = get_user_id(auth.uid()))
  OR
  (assigned_to IS NULL)
);
