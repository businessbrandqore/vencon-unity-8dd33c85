
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'campaign_tls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_tls;
  END IF;
END $$;
