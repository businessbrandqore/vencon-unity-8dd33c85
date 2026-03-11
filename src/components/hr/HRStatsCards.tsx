import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { ShoppingCart, CheckCircle, XCircle, RotateCcw } from "lucide-react";

interface StatCard {
  labelKey: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

const HRStatsCards = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);
  const isBn = t("vencon") === "VENCON";

  useEffect(() => {
    const fetchStats = async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [ordersRes, deliveredRes, cancelledRes, returnedRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_status", "delivered").gte("created_at", monthStart),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "rejected").gte("created_at", monthStart),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_status", "returned").gte("created_at", monthStart),
      ]);

      const total = ordersRes.count || 0;
      const delivered = deliveredRes.count || 0;
      const cancelled = cancelledRes.count || 0;
      const returned = returnedRes.count || 0;

      const receiveRatio = total > 0 ? Math.round((delivered / total) * 100) : 0;
      const cancelRatio = total > 0 ? Math.round((cancelled / total) * 100) : 0;
      const returnRatio = total > 0 ? Math.round((returned / total) * 100) : 0;

      setStats([
        {
          labelKey: "total_sales",
          value: `${total > 0 ? "100" : "0"}%`,
          sub: `${total} orders`,
          icon: ShoppingCart,
          iconColor: "#EA580C",
          iconBg: "rgba(234, 88, 12, 0.15)",
        },
        {
          labelKey: "receive_ratio",
          value: `${receiveRatio}.0%`,
          sub: `${delivered} orders`,
          icon: CheckCircle,
          iconColor: "#22C55E",
          iconBg: "rgba(34, 197, 94, 0.15)",
        },
        {
          labelKey: "cancel_ratio",
          value: `${cancelRatio}.0%`,
          sub: `${cancelled} orders`,
          icon: XCircle,
          iconColor: "#EF4444",
          iconBg: "rgba(239, 68, 68, 0.15)",
        },
        {
          labelKey: "return_ratio",
          value: `${returnRatio}.0%`,
          sub: `${returned} orders`,
          icon: RotateCcw,
          iconColor: "#F59E0B",
          iconBg: "rgba(245, 158, 11, 0.15)",
        },
      ]);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const labels: Record<string, { bn: string; en: string }> = {
    total_sales: { bn: "Total Sales", en: "Total Sales" },
    receive_ratio: { bn: "Receive Ratio", en: "Receive Ratio" },
    cancel_ratio: { bn: "Cancel Ratio", en: "Cancel Ratio" },
    return_ratio: { bn: "Return Ratio", en: "Return Ratio" },
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const label = labels[stat.labelKey];
        const Icon = stat.icon;
        return (
          <div key={stat.labelKey} className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: stat.iconBg }}
            >
              <Icon className="h-5 w-5" style={{ color: stat.iconColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs text-muted-foreground">
                {label ? (isBn ? label.bn : label.en) : stat.labelKey}
              </p>
              <p className="font-heading text-2xl font-bold mt-0.5" style={{ color: stat.iconColor }}>
                {stat.value}
              </p>
              <p className="font-body text-[11px] text-muted-foreground">{stat.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HRStatsCards;
