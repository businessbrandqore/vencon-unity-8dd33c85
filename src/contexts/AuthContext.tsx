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
  // Track if we received a definitive auth event (not just initial null)
  const gotAuthEventRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    resolvedRef.current = false;
    gotAuthEventRef.current = false;

    const resolveWithUser = async (
      session: { user: { id: string } } | null,
      isDefinitive: boolean
    ) => {
      const currentRequest = ++requestIdRef.current;

      if (!session) {
        // Only redirect to login if this is a DEFINITIVE "no session" signal
        // AND we don't have a valid cache (prevents premature logout)
        if (isDefinitive) {
          resolvedRef.current = true;
          
          // If we have a cached user, try to refresh the session first
          const cached = loadCachedUser(requiredPanel);
          if (cached) {
            // Try refreshing the session before giving up
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData?.session && mounted) {
              // Session refreshed successfully, resolve with it
              void resolveWithUser({ user: { id: refreshData.session.user.id } }, true);
              return;
            }
          }
          
          // Truly no session — clear and redirect
          saveCachedUser(null);
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          navigate(loginPath, { replace: true });
        }
        return;
      }

      // Check localStorage cache first for instant render
      const cached = loadCachedUser(requiredPanel);
      if (cached && cached.authId === session.user.id && mounted) {
        setUser(cached);
        setLoading(false);
        resolvedRef.current = true;
        return;
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        gotAuthEventRef.current = true;
        saveCachedUser(null);
        setUser(null);
        setLoading(false);
        navigate(loginPath, { replace: true });
        return;
      }

      if (event === "INITIAL_SESSION") {
        gotAuthEventRef.current = true;
        if (session) {
          void resolveWithUser({ user: { id: session.user.id } }, true);
        } else {
          // No session on initial load — but only redirect if no cache
          void resolveWithUser(null, true);
        }
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        gotAuthEventRef.current = true;
        if (session) {
          void resolveWithUser({ user: { id: session.user.id } }, true);
        }
        return;
      }
    });

    // Safety timeout: if no auth event fires within 10 seconds and we have no cache,
    // redirect to login. If we have cache, keep showing cached state.
    const safetyTimer = setTimeout(() => {
      if (!gotAuthEventRef.current && mounted && !hasValidCache) {
        setLoading(false);
        navigate(loginPath, { replace: true });
      }
    }, 10000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [navigate, requiredPanel, loginPath, hasValidCache]);

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
