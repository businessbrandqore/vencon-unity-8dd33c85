import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const BLUE = "#1D4ED8";

interface StatCard {
  labelKey: string;
  value: string | number;
  isBadge?: boolean;
}

const HRStatsCards = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);
  const isBn = t("vencon") === "VENCON";

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [
        employeesRes,
        campaignsRes,
        pendingApprovalsRes,
        totalEmployeesRes,
        checkedInRes,
        leaveRes,
        incentiveRes,
      ] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("sa_approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true).neq("panel", "sa"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("incentive_config").select("amount_per_order").eq("status", "approved"),
      ]);

      const totalEmp = totalEmployeesRes.count || 0;
      const checkedIn = checkedInRes.count || 0;
      const attendancePct = totalEmp > 0 ? Math.round((checkedIn / totalEmp) * 100) : 0;

      const incentivePool = (incentiveRes.data || []).reduce(
        (sum, row) => sum + (Number(row.amount_per_order) || 0),
        0
      );

      setStats([
        { labelKey: "active_employees", value: employeesRes.count || 0 },
        { labelKey: "active_campaigns", value: campaignsRes.count || 0 },
        { labelKey: "pending_sa_approvals", value: pendingApprovalsRes.count || 0, isBadge: true },
        { labelKey: "attendance_today", value: `${attendancePct}%` },
        { labelKey: "pending_leaves", value: leaveRes.count || 0, isBadge: true },
        { labelKey: "incentive_pool", value: `৳${incentivePool.toLocaleString()}` },
      ]);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const labels: Record<string, { bn: string; en: string }> = {
    active_employees: { bn: "সক্রিয় কর্মচারী", en: "Active Employees" },
    active_campaigns: { bn: "সক্রিয় ক্যাম্পেইন", en: "Active Campaigns" },
    pending_sa_approvals: { bn: "পেন্ডিং SA অনুমোদন", en: "Pending SA Approvals" },
    attendance_today: { bn: "আজকের উপস্থিতি", en: "Today's Attendance" },
    pending_leaves: { bn: "পেন্ডিং ছুটি", en: "Pending Leaves" },
    incentive_pool: { bn: "ইনসেন্টিভ পুল (মাস)", en: "Incentive Pool (Month)" },
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[1px] bg-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-background p-4 h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[1px] bg-border">
      {stats.map((stat) => {
        const label = labels[stat.labelKey];
        return (
          <div key={stat.labelKey} className="bg-background p-4 relative">
            <p className="font-body text-[11px] text-muted-foreground tracking-wide">
              {label ? (isBn ? label.bn : label.en) : stat.labelKey}
            </p>
            <p
              className="font-heading text-2xl font-bold mt-1"
              style={{
                color:
                  stat.isBadge && Number(String(stat.value)) > 0
                    ? "#EF4444"
                    : BLUE,
              }}
            >
              {stat.value}
            </p>
            {stat.isBadge && Number(String(stat.value)) > 0 && (
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HRStatsCards;
