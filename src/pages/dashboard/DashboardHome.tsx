import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPanelByType } from "@/lib/panelConfig";

const DashboardHome = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const panelConfig = user ? getPanelByType(user.panel) : null;

  if (!user || !panelConfig) return null;

  return (
    <div>
      <h2 className="font-heading text-3xl font-bold text-foreground mb-2">
        {t("dashboard")}
      </h2>
      <p className="font-body text-sm text-muted-foreground">
        {t("welcome")}, {user.name}
      </p>
      <div
        className="mt-8 h-[2px] w-16"
        style={{ backgroundColor: panelConfig.color }}
      />
    </div>
  );
};

export default DashboardHome;
