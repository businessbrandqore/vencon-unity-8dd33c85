import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import HRStatsCards from "@/components/hr/HRStatsCards";
import HRQuickActions from "@/components/hr/HRQuickActions";
import HRMoodChart from "@/components/hr/HRMoodChart";
import HRRecentActivity from "@/components/hr/HRRecentActivity";

const HRDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "ড্যাশবোর্ড" : "Dashboard"}
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {isBn ? "স্বাগতম" : "Welcome"}, {user.name}
        </p>
      </div>

      <HRStatsCards />
      <HRQuickActions />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HRMoodChart />
        <HRRecentActivity />
      </div>
    </div>
  );
};

export default HRDashboard;
