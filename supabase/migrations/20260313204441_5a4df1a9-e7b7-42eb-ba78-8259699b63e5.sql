
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS upsell text,
  ADD COLUMN IF NOT EXISTS success_ratio integer;
