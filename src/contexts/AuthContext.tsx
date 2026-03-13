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

  const hasValidCache = !!cachedUser && cachedUser.panel === requiredPanel;

  const [user, setUser] = useState<UserData | null>(hasValidCache ? cachedUser : null);
  const [loading, setLoading] = useState(!hasValidCache);

  useEffect(() => {
    let mounted = true;
    let requestId = 0;

    const resolveWithUser = async (session: { user: { id: string } } | null, showLoading = false) => {
      const currentRequest = ++requestId;

      if (!session) {
        if (cachedUser && cachedUser.panel === requiredPanel && mounted) {
          setUser(cachedUser);
          setLoading(false);
          return;
        }

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
        return;
      }

      if (showLoading && mounted) {
        setLoading(true);
      }

      const { data: userData, error } = await supabase
        .from("users")
        .select("id, auth_id, name, email, panel, role")
        .eq("auth_id", session.user.id)
        .single();

      if (!mounted || currentRequest !== requestId) return;

      if (error || !userData) {
        cachedUser = null;
        setUser(null);
        setLoading(false);
        void supabase.auth.signOut();
        navigate(loginPath, { replace: true });
        return;
      }

      if (userData.panel !== requiredPanel) {
        cachedUser = null;
        setUser(null);
        setLoading(false);
        const correctPanel = getPanelByType(userData.panel as PanelType);
        navigate(correctPanel ? correctPanel.loginPath : "/", { replace: true });
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
      setUser(mappedUser);
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        cachedUser = null;
        setUser(null);
        setLoading(false);
        navigate(loginPath, { replace: true });
        return;
      }

      if (session) {
        void resolveWithUser({ user: { id: session.user.id } }, false);
      }
    });

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      void resolveWithUser(session ? { user: { id: session.user.id } } : null, !hasValidCache);
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, requiredPanel, loginPath, hasValidCache]);

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
