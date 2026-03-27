ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS success_ratio numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fraud_total integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fraud_success integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fraud_cancel integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fraud_check_error text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fraud_checked_at timestamptz DEFAULT NULL;