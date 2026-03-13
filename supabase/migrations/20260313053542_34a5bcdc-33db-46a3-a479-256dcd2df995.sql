-- Allow warehouse roles (warehouse_assistant, warehouse_supervisor, inventory_manager) to read send_today and dispatched orders
CREATE POLICY "warehouse_roles_read_dispatch_orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
        AND users.role IN ('warehouse_assistant', 'warehouse_supervisor', 'inventory_manager')
    )
    AND status IN ('send_today', 'dispatched')
  );

-- Allow warehouse roles to read active campaigns (for filter)
CREATE POLICY "warehouse_roles_read_campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
        AND users.role IN ('warehouse_assistant', 'warehouse_supervisor', 'inventory_manager')
    )
    AND status = 'active'
  );

-- Allow warehouse roles to read leads (for campaign mapping)
CREATE POLICY "warehouse_roles_read_leads_for_campaign" ON public.leads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
        AND users.role IN ('warehouse_assistant', 'warehouse_supervisor', 'inventory_manager')
    )
  );