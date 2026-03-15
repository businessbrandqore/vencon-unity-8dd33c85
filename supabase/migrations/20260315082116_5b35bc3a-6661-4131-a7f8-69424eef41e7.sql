
-- Remove duplicate triggers on leads table (keep only on_lead_change)
DROP TRIGGER IF EXISTS lead_routing_trigger ON public.leads;
DROP TRIGGER IF EXISTS trg_lead_routing_ins ON public.leads;
DROP TRIGGER IF EXISTS trg_lead_routing_upd ON public.leads;

-- Remove duplicate triggers on orders table (keep only on_order_change)
DROP TRIGGER IF EXISTS order_routing_trigger ON public.orders;
DROP TRIGGER IF EXISTS trg_order_routing_ins ON public.orders;
DROP TRIGGER IF EXISTS trg_order_routing_upd ON public.orders;
