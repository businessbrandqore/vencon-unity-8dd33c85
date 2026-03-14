-- Allow agent to unassign routed leads after status change (without opening broad update access)
DROP POLICY IF EXISTS "employee_update_own_leads" ON public.leads;

CREATE POLICY "employee_update_own_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  assigned_to = get_user_id(auth.uid())
)
WITH CHECK (
  assigned_to = get_user_id(auth.uid())
  OR (
    assigned_to IS NULL
    AND status IN (
      'order_confirm',
      '_order_confirm',
      'pre_order',
      'pre_order_confirm',
      'pending_tl',
      'pending_cso',
      'tl_delete_sheet'
    )
  )
);