import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SAStatsCards from "@/components/sa/SAStatsCards";
import SAApprovalsTable from "@/components/sa/SAApprovalsTable";
import SACharts from "@/components/sa/SACharts";
import SAQuickLinks from "@/components/sa/SAQuickLinks";

const SADashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Company Analytics
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Real-time overview of company performance
        </p>
      </div>

      <SAStatsCards />
      <SAApprovalsTable />
      <SACharts />
      <SAQuickLinks />
    </div>
  );
};

export default SADashboard;
