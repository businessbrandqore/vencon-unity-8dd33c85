import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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

// Persist cached user in localStorage so it survives app restarts (WebView + browser)
const SESSION_CACHE_KEY = "vencon_auth_cache";

const loadCachedUser = (panel: PanelType): UserData | null => {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserData;
    return parsed.panel === panel ? parsed : null;
  } catch {
    return null;
  }
};

const saveCachedUser = (u: UserData | null) => {
  if (u) {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(u));
  } else {
    localStorage.removeItem(SESSION_CACHE_KEY);
  }
};

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

  const cachedUser = loadCachedUser(requiredPanel);
  const hasValidCache = !!cachedUser;

  const [user, setUser] = useState<UserData | null>(cachedUser);
  const [loading, setLoading] = useState(!hasValidCache);
  const resolvedRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    resolvedRef.current = false;

    const resolveWithUser = async (
      session: { user: { id: string } } | null,
      showLoading = false
    ) => {
      const currentRequest = ++requestIdRef.current;

      if (!session) {
        // Don't redirect if we haven't definitively resolved yet —
        // onAuthStateChange INITIAL_SESSION is the definitive source
        if (!resolvedRef.current) {
          resolvedRef.current = true;
        }
        saveCachedUser(null);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        navigate(loginPath, { replace: true });
        return;
      }

      // Check sessionStorage cache first for instant render
      const cached = loadCachedUser(requiredPanel);
      if (cached && cached.authId === session.user.id && mounted) {
        setUser(cached);
        setLoading(false);
        resolvedRef.current = true;
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

      if (!mounted || currentRequest !== requestIdRef.current) return;

      if (error || !userData) {
        saveCachedUser(null);
        setUser(null);
        setLoading(false);
        void supabase.auth.signOut();
        navigate(loginPath, { replace: true });
        return;
      }

      if (userData.panel !== requiredPanel) {
        saveCachedUser(null);
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

      saveCachedUser(mappedUser);
      resolvedRef.current = true;
      setUser(mappedUser);
      setLoading(false);
    };

    // onAuthStateChange fires INITIAL_SESSION first — this is the primary source
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        saveCachedUser(null);
        setUser(null);
        setLoading(false);
        navigate(loginPath, { replace: true });
        return;
      }

      if (session) {
        void resolveWithUser({ user: { id: session.user.id } }, false);
      } else if (event === "INITIAL_SESSION") {
        // Definitively no session — redirect
        resolvedRef.current = true;
        saveCachedUser(null);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        navigate(loginPath, { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, requiredPanel, loginPath]);

  const signOut = async () => {
    saveCachedUser(null);
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

export const useAuthSafe = () => {
  return useContext(AuthContext);
};
