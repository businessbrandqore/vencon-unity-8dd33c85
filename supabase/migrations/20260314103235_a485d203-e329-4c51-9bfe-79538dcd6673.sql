-- Allow employees to momentarily read leads they just transferred via order/pre-order,
-- so UPDATE does not fail when assigned_to becomes NULL.
DROP POLICY IF EXISTS "employee_read_recent_transferred_leads" ON public.leads;

CREATE POLICY "employee_read_recent_transferred_leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  assigned_to IS NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.lead_id = leads.id
        AND o.agent_id = get_user_id(auth.uid())
        AND o.created_at >= (now() - interval '30 minutes')
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.pre_orders p
      WHERE p.lead_id = leads.id
        AND p.agent_id = get_user_id(auth.uid())
        AND p.created_at >= (now() - interval '30 minutes')
    )
  )
);