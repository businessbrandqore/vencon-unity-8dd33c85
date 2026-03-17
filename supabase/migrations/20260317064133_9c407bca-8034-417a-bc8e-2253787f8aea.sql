-- RLS policy: cancellation_executive can read returned/cancelled orders
CREATE POLICY "cancellation_exec_read_returned_cancelled_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  (delivery_status IN ('returned', 'cancelled'))
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'cancellation_executive'
  )
);

-- cancellation_executive can update returned/cancelled orders (fields controlled by HR data ops)
CREATE POLICY "cancellation_exec_update_returned_cancelled_orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  (delivery_status IN ('returned', 'cancelled'))
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'cancellation_executive'
  )
)
WITH CHECK (
  (delivery_status IN ('returned', 'cancelled'))
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'cancellation_executive'
  )
);

-- cancellation_executive can read active campaigns (for data ops config)
CREATE POLICY "cancellation_exec_read_campaigns"
ON public.campaigns
FOR SELECT
TO authenticated
USING (
  (status = 'active')
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'cancellation_executive'
  )
);

-- cancellation_executive can read data operations config
CREATE POLICY "cancellation_exec_read_data_operations"
ON public.campaign_data_operations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'cancellation_executive'
  )
);