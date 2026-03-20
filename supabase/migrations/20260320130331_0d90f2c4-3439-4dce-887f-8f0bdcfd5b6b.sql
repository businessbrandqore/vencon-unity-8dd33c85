-- Fix campaign deletion so approving a delete request actually removes the campaign and all related data.
-- Root cause: orders/pre_orders still reference leads without cascade, which blocks deleting leads when a campaign is deleted.

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_lead_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_lead_id_fkey
FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

ALTER TABLE public.pre_orders
DROP CONSTRAINT IF EXISTS pre_orders_lead_id_fkey;

ALTER TABLE public.pre_orders
ADD CONSTRAINT pre_orders_lead_id_fkey
FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;