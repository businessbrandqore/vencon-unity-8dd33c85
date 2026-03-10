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

export const AuthProvider = ({
  children,
  requiredPanel,
}: {
  children: ReactNode;
  requiredPanel: PanelType;
}) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const panelConfig = getPanelByType(requiredPanel);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate(panelConfig?.loginPath || "/");
        return;
      }

      const { data: userData, error } = await supabase
        .from("users")
        .select("id, auth_id, name, email, panel, role")
        .eq("auth_id", session.user.id)
        .single();

      if (error || !userData) {
        await supabase.auth.signOut();
        navigate(panelConfig?.loginPath || "/");
        return;
      }

      if (userData.panel !== requiredPanel) {
        const correctPanel = getPanelByType(userData.panel as PanelType);
        if (correctPanel) {
          navigate(correctPanel.loginPath);
        } else {
          navigate("/");
        }
        return;
      }

      if (mounted) {
        setUser({
          id: userData.id,
          authId: userData.auth_id,
          name: userData.name,
          email: userData.email,
          panel: userData.panel as PanelType,
          role: userData.role,
        });
        setLoading(false);
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && mounted) {
        setUser(null);
        navigate(panelConfig?.loginPath || "/");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, requiredPanel, panelConfig]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate(panelConfig?.loginPath || "/");
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
