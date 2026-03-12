DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'gl_read_group_users'
  ) THEN
    CREATE POLICY "gl_read_group_users"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (
      has_panel(auth.uid(), 'tl'::public.app_panel)
      AND EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_leader_id = get_user_id(auth.uid())
          AND gm.agent_id = users.id
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'campaign_agent_roles'
      AND policyname = 'gl_read_group_campaign_agent_roles'
  ) THEN
    CREATE POLICY "gl_read_group_campaign_agent_roles"
    ON public.campaign_agent_roles
    FOR SELECT
    TO authenticated
    USING (
      has_panel(auth.uid(), 'tl'::public.app_panel)
      AND EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_leader_id = get_user_id(auth.uid())
          AND gm.agent_id = campaign_agent_roles.agent_id
      )
    );
  END IF;
END
$$;