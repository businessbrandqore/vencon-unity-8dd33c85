import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPanelByType, PanelType } from "@/lib/panelConfig";
import { supabase } from "@/integrations/supabase/client";
import LanguageToggle from "@/components/LanguageToggle";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const PanelDashboard = () => {
  const { panel } = useParams<{ panel: string }>();
  const panelConfig = getPanelByType(panel as PanelType);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuthAndPanel = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate(panelConfig?.loginPath || "/");
        return;
      }

      // Verify this user belongs to this panel
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("panel, name, email")
        .eq("auth_id", session.user.id)
        .single();

      if (userError || !userData) {
        await supabase.auth.signOut();
        navigate(panelConfig?.loginPath || "/");
        return;
      }

      // Panel mismatch — redirect to correct panel
      if (userData.panel !== panel) {
        const correctPanel = getPanelByType(userData.panel as PanelType);
        if (correctPanel) {
          navigate(correctPanel.loginPath);
        } else {
          navigate("/");
        }
        return;
      }

      setUserEmail(userData.email);
      setUserName(userData.name);
      setChecking(false);
    };

    checkAuthAndPanel();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate(panelConfig?.loginPath || "/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, panelConfig, panel]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(panelConfig?.loginPath || "/");
  };

  if (!panelConfig) {
    navigate("/");
    return null;
  }

  if (checking) {
    return (
      <LoadingSpinner text={t("checking_access")} fullPage size="lg" />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LanguageToggle />

      {/* Top bar */}
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-heading text-lg font-bold tracking-[0.15em] text-foreground">
              VENCON
            </span>
            <span
              className="font-heading text-xs tracking-wider uppercase"
              style={{ color: panelConfig.color }}
            >
              {t(panelConfig.nameKey)}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <span className="font-body text-xs text-muted-foreground">
              {userName} ({userEmail})
            </span>
            <button
              onClick={handleLogout}
              className="font-heading text-xs tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="font-heading text-3xl font-bold text-foreground mb-2">
          {t("dashboard")}
        </h2>
        <p className="font-body text-sm text-muted-foreground">
          {t("welcome")}, {userName}
        </p>

        {/* Accent line */}
        <div
          className="mt-8 h-[2px] w-16"
          style={{ backgroundColor: panelConfig.color }}
        />
      </div>
    </div>
  );
};

export default PanelDashboard;
