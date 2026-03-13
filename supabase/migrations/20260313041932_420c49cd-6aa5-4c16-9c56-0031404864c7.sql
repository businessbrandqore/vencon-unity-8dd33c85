-- CSO can read all pending_cso orders for verification
CREATE POLICY "cso_read_pending_orders" ON public.orders
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'cso'
  )
  AND status IN ('pending_cso', 'send_today', 'rejected')
);

-- CSO can update pending_cso orders (approve/reject)
CREATE POLICY "cso_update_pending_orders" ON public.orders
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'cso'
  )
  AND status = 'pending_cso'
);

-- CSO can insert data_requests
CREATE POLICY "cso_insert_data_requests" ON public.data_requests
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = get_user_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'cso'
  )
);

-- CSO can read own data_requests
CREATE POLICY "cso_read_own_data_requests" ON public.data_requests
FOR SELECT TO authenticated
USING (
  requested_by = get_user_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'cso'
  )
);
