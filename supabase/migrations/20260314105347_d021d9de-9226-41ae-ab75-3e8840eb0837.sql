-- Allow TL/ATL users to move their pending TL orders into CSO queue
DROP POLICY IF EXISTS tl_send_orders_to_cso ON public.orders;

CREATE POLICY tl_send_orders_to_cso
ON public.orders
FOR UPDATE
TO authenticated
USING (
  (
    has_panel(auth.uid(), 'tl'::public.app_panel)
    AND tl_id = get_user_id(auth.uid())
  )
  OR (
    is_atl(auth.uid())
    AND tl_id IN (
      SELECT get_atl_tl_ids(get_user_id(auth.uid()))
    )
  )
)
WITH CHECK (
  status = 'pending_cso'
  AND (
    (
      has_panel(auth.uid(), 'tl'::public.app_panel)
      AND tl_id = get_user_id(auth.uid())
    )
    OR (
      is_atl(auth.uid())
      AND tl_id IN (
        SELECT get_atl_tl_ids(get_user_id(auth.uid()))
      )
    )
  )
);