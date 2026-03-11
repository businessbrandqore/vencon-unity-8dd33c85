import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SAStatsCards from "@/components/sa/SAStatsCards";
import SAApprovalsTable from "@/components/sa/SAApprovalsTable";
import SACharts from "@/components/sa/SACharts";
import SAQuickLinks from "@/components/sa/SAQuickLinks";
import SAEmployeeOverview from "@/components/sa/SAEmployeeOverview";
import SARecentActivity from "@/components/sa/SARecentActivity";
import SASystemHealth from "@/components/sa/SASystemHealth";
import SARevenueSummary from "@/components/sa/SARevenueSummary";

const SADashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "কোম্পানি অ্যানালিটিক্স" : "Company Analytics"}
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {isBn ? "রিয়েল-টাইম কোম্পানি পারফরম্যান্স ওভারভিউ" : "Real-time overview of company performance"}
        </p>
      </div>

      {/* Stats Row */}
      <SAStatsCards />

      {/* Two-column: Revenue + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SARevenueSummary />
        <SASystemHealth />
        <SAEmployeeOverview />
      </div>

      {/* Approvals */}
      <SAApprovalsTable />

      {/* Charts */}
      <SACharts />

      {/* Bottom: Recent Activity + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SARecentActivity />
        <SAQuickLinks />
      </div>
    </div>
  );
};

export default SADashboard;
