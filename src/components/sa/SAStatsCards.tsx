import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const TEAL = "#0D9488";

interface StatCard {
  labelKey: string;
  value: string | number;
  isBadge?: boolean;
}

const SAStatsCards = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [
        campaignsRes,
        leadsRes,
        ordersRes,
        deliveredRes,
        confirmedMonthRes,
        employeesRes,
        approvalsRes,
      ] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_status", "delivered").gte("created_at", monthStart),
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("sa_approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      const delivered = deliveredRes.count || 0;
      const confirmed = confirmedMonthRes.count || 0;
      const ratio = confirmed > 0 ? Math.round((delivered / confirmed) * 100) : 0;

      setStats([
        { labelKey: "active_campaigns", value: campaignsRes.count || 0 },
        { labelKey: "leads_today", value: leadsRes.count || 0 },
        { labelKey: "orders_today", value: ordersRes.count || 0 },
        { labelKey: "receive_ratio", value: `${ratio}%` },
        { labelKey: "active_employees", value: employeesRes.count || 0 },
        { labelKey: "pending_approvals_count", value: approvalsRes.count || 0, isBadge: true },
      ]);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const labels: Record<string, { bn: string; en: string }> = {
    active_campaigns: { bn: "সক্রিয় ক্যাম্পেইন", en: "Active Campaigns" },
    leads_today: { bn: "আজকের লিড", en: "Leads Today" },
    orders_today: { bn: "আজকের অর্ডার", en: "Orders Today" },
    receive_ratio: { bn: "রিসিভ রেশিও (এই মাস)", en: "Receive Ratio (Month)" },
    active_employees: { bn: "সক্রিয় কর্মচারী", en: "Active Employees" },
    pending_approvals_count: { bn: "পেন্ডিং অনুমোদন", en: "Pending Approvals" },
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
              {label ? (t("vencon") === "VENCON" ? label.bn : label.en) : stat.labelKey}
            </p>
            <p className="font-heading text-2xl font-bold mt-1" style={{ color: stat.isBadge && Number(String(stat.value)) > 0 ? "#EF4444" : TEAL }}>
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

export default SAStatsCards;
