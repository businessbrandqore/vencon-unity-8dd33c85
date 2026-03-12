
-- Some tables already in publication, add remaining ones safely
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'campaign_agent_roles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_agent_roles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'group_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'campaign_tls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_tls;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'users') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'campaigns') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pre_orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_orders;
  END IF;
END $$;
