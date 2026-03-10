import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPanelByType, PanelType } from "@/lib/panelConfig";
import { supabase } from "@/integrations/supabase/client";
import LanguageToggle from "@/components/LanguageToggle";

const PanelDashboard = () => {
  const { panel } = useParams<{ panel: string }>();
  const panelConfig = getPanelByType(panel as PanelType);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate(panelConfig?.loginPath || "/");
        return;
      }
      setUserEmail(session.user.email || "");
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate(panelConfig?.loginPath || "/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, panelConfig]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(panelConfig?.loginPath || "/");
  };

  if (!panelConfig) {
    navigate("/");
    return null;
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
            <span className="font-body text-xs text-muted-foreground">{userEmail}</span>
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
          {t("welcome")}
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
