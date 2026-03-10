import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SAStatsCards from "@/components/sa/SAStatsCards";
import SAApprovalsTable from "@/components/sa/SAApprovalsTable";
import SACharts from "@/components/sa/SACharts";
import SAQuickLinks from "@/components/sa/SAQuickLinks";

const SADashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "ড্যাশবোর্ড" : "Dashboard"}
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {isBn ? "স্বাগতম" : "Welcome"}, {user.name}
        </p>
      </div>

      {/* Stats Cards */}
      <SAStatsCards />

      {/* Pending Approvals — most prominent */}
      <SAApprovalsTable />

      {/* Charts */}
      <SACharts />

      {/* Quick Links */}
      <SAQuickLinks />
    </div>
  );
};

export default SADashboard;
