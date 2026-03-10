
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS father_phone text,
  ADD COLUMN IF NOT EXISTS mother_name text,
  ADD COLUMN IF NOT EXISTS mother_phone text,
  ADD COLUMN IF NOT EXISTS guardian_type text,
  ADD COLUMN IF NOT EXISTS off_days text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gps_location text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;
