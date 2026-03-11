ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_phone text;