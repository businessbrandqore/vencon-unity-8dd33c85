-- Fix recursive RLS evaluation between campaign_agent_roles and group_members
-- by using a SECURITY DEFINER helper function for group membership checks.

CREATE OR REPLACE FUNCTION public.is_group_member_of_leader(_leader_id uuid, _agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_leader_id = _leader_id
      AND gm.agent_id = _agent_id
  );
$$;

DROP POLICY IF EXISTS "gl_read_group_users" ON public.users;
CREATE POLICY "gl_read_group_users"
ON public.users
FOR SELECT
TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::public.app_panel)
  AND public.is_group_member_of_leader(get_user_id(auth.uid()), users.id)
);

DROP POLICY IF EXISTS "gl_read_group_campaign_agent_roles" ON public.campaign_agent_roles;
CREATE POLICY "gl_read_group_campaign_agent_roles"
ON public.campaign_agent_roles
FOR SELECT
TO authenticated
USING (
  has_panel(auth.uid(), 'tl'::public.app_panel)
  AND public.is_group_member_of_leader(get_user_id(auth.uid()), campaign_agent_roles.agent_id)
);