import { supabase } from "@/integrations/supabase/client";
import { PanelType } from "@/lib/panelConfig";

export interface AuthUserRecord {
  id: string;
  auth_id: string;
  name: string;
  email: string;
  panel: PanelType;
  role: string;
}

export class AuthRequestTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "AuthRequestTimeoutError";
  }
}

export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: number | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new AuthRequestTimeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
};

export const fetchUserPanelByAuthId = async (authId: string, timeoutMs = 3500): Promise<PanelType | null> => {
  try {
    const rpcResult = await withTimeout(
      supabase.rpc("get_user_panel", { _auth_id: authId }),
      timeoutMs,
      "get_user_panel",
    );

    if (rpcResult.error) throw rpcResult.error;
    return (rpcResult.data as PanelType | null) ?? null;
  } catch {
    const queryResult = await withTimeout(
      supabase.from("users").select("panel").eq("auth_id", authId).maybeSingle(),
      timeoutMs,
      "users.panel lookup",
    );

    if (queryResult.error) throw queryResult.error;
    return (queryResult.data?.panel as PanelType | null) ?? null;
  }
};

export const fetchUserIdByAuthId = async (authId: string, timeoutMs = 3500): Promise<string | null> => {
  try {
    const rpcResult = await withTimeout(
      supabase.rpc("get_user_id", { _auth_id: authId }),
      timeoutMs,
      "get_user_id",
    );

    if (rpcResult.error) throw rpcResult.error;
    return rpcResult.data ?? null;
  } catch {
    const queryResult = await withTimeout(
      supabase.from("users").select("id").eq("auth_id", authId).maybeSingle(),
      timeoutMs,
      "users.id lookup",
    );

    if (queryResult.error) throw queryResult.error;
    return queryResult.data?.id ?? null;
  }
};

export const fetchAuthUserRecord = async (authId: string, timeoutMs = 6000): Promise<AuthUserRecord | null> => {
  const result = await withTimeout(
    supabase
      .from("users")
      .select("id, auth_id, name, email, panel, role")
      .eq("auth_id", authId)
      .maybeSingle(),
    timeoutMs,
    "users profile lookup",
  );

  if (result.error) throw result.error;
  return (result.data as AuthUserRecord | null) ?? null;
};

const defaultRoleByPanel: Record<PanelType, string> = {
  sa: "Super Admin",
  hr: "HR",
  tl: "Team Leader",
  employee: "Employee",
};

export const buildTemporaryAuthUser = ({
  authId,
  email,
  panel,
  userId,
  name,
}: {
  authId: string;
  email?: string | null;
  panel: PanelType;
  userId: string;
  name?: string | null;
}) => ({
  id: userId,
  authId,
  email: email || "",
  panel,
  role: defaultRoleByPanel[panel],
  name: name?.trim() || email?.split("@")[0] || "User",
});