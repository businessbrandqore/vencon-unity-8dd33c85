import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PanelType, getPanelByType } from "@/lib/panelConfig";

interface UserData {
  id: string;
  authId: string;
  name: string;
  email: string;
  panel: PanelType;
  role: string;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
let cachedUser: UserData | null = null;

export const AuthProvider = ({
  children,
  requiredPanel,
}: {
  children: ReactNode;
  requiredPanel: PanelType;
}) => {
  const navigate = useNavigate();
  const panelConfig = getPanelByType(requiredPanel);
  const loginPath = panelConfig?.loginPath || "/";

  const hasValidCache =
    !!cachedUser && cachedUser.panel === requiredPanel;

  const [user, setUser] = useState<UserData | null>(hasValidCache ? cachedUser : null);
  const [loading, setLoading] = useState(!hasValidCache);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        cachedUser = null;
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        navigate(loginPath, { replace: true });
        return;
      }

      if (
        cachedUser &&
        cachedUser.authId === session.user.id &&
        cachedUser.panel === requiredPanel &&
        mounted
      ) {
        setUser(cachedUser);
        setLoading(false);
      }

      const { data: userData, error } = await supabase
        .from("users")
        .select("id, auth_id, name, email, panel, role")
        .eq("auth_id", session.user.id)
        .single();

      if (error || !userData) {
        cachedUser = null;
        await supabase.auth.signOut();
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        navigate(loginPath, { replace: true });
        return;
      }

      if (userData.panel !== requiredPanel) {
        cachedUser = null;
        const correctPanel = getPanelByType(userData.panel as PanelType);
        if (correctPanel) {
          navigate(correctPanel.loginPath, { replace: true });
        } else {
          navigate("/", { replace: true });
        }
        return;
      }

      const mappedUser: UserData = {
        id: userData.id,
        authId: userData.auth_id,
        name: userData.name,
        email: userData.email,
        panel: userData.panel as PanelType,
        role: userData.role,
      };

      cachedUser = mappedUser;
      if (mounted) {
        setUser(mappedUser);
        setLoading(false);
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && mounted) {
        cachedUser = null;
        setUser(null);
        setLoading(false);
        navigate(loginPath, { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, requiredPanel, loginPath]);

  const signOut = async () => {
    cachedUser = null;
    await supabase.auth.signOut();
    navigate(loginPath, { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
