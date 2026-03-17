-- Drop and recreate with display name format to match how roles are stored
DROP POLICY IF EXISTS "cancellation_exec_read_returned_cancelled_orders" ON public.orders;
DROP POLICY IF EXISTS "cancellation_exec_update_returned_cancelled_orders" ON public.orders;
DROP POLICY IF EXISTS "cancellation_exec_read_campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "cancellation_exec_read_data_operations" ON public.campaign_data_operations;

-- Recreate with both possible role formats for safety
CREATE POLICY "cancellation_exec_read_returned_cancelled_orders"
ON public.orders FOR SELECT TO authenticated
USING (
  (delivery_status IN ('returned', 'cancelled'))
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('cancellation_executive', 'Cancellation Executive')
  )
);

CREATE POLICY "cancellation_exec_update_returned_cancelled_orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  (delivery_status IN ('returned', 'cancelled'))
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('cancellation_executive', 'Cancellation Executive')
  )
)
WITH CHECK (
  (delivery_status IN ('returned', 'cancelled'))
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('cancellation_executive', 'Cancellation Executive')
  )
);

CREATE POLICY "cancellation_exec_read_campaigns"
ON public.campaigns FOR SELECT TO authenticated
USING (
  (status = 'active')
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('cancellation_executive', 'Cancellation Executive')
  )
);

CREATE POLICY "cancellation_exec_read_data_operations"
ON public.campaign_data_operations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('cancellation_executive', 'Cancellation Executive')
  )
);