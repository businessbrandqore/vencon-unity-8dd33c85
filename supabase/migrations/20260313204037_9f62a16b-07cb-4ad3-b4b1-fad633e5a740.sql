
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS thana text,
  ADD COLUMN IF NOT EXISTS gift_name text,
  ADD COLUMN IF NOT EXISTS advance_payment numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS card_name text,
  ADD COLUMN IF NOT EXISTS order_media text;
