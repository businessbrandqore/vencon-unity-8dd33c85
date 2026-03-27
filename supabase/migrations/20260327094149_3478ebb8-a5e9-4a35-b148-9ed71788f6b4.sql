
-- Add break tracking columns to attendance table
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS break_start timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS break_end timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS break_deduction numeric DEFAULT 0;

-- Add guardian detail columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS guardian_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS guardian_phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS guardian_relation text DEFAULT NULL;
