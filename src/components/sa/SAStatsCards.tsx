import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { ShoppingCart, CheckCircle, XCircle, RotateCcw, Target } from "lucide-react";
import type { SAFilterState } from "@/pages/dashboard/SADashboard";

interface StatCard {
  labelKey: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

interface SAStatsCardsProps {
  filters?: SAFilterState;
}

const SAStatsCards = ({ filters }: SAStatsCardsProps) => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);
  const isBn = t("vencon") === "VENCON";

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const campaignId = filters?.campaignId || "all";
      const dataMode = filters?.dataMode || "all";
      const websiteSource = filters?.websiteSource || "all";

      // --- Build lead query to get filtered lead IDs ---
      let leadQuery = supabase
        .from("leads")
        .select("id, source")
        .gte("created_at", monthStart);

      if (campaignId !== "all") leadQuery = leadQuery.eq("campaign_id", campaignId);
      if (websiteSource !== "all") leadQuery = leadQuery.eq("source", websiteSource);

      // For data_mode filter, we need campaign ids that match the mode
      let campaignIdsForMode: string[] | null = null;
      if (dataMode !== "all") {
        const { data: modeCampaigns } = await supabase
          .from("campaigns")
          .select("id")
          .eq("data_mode", dataMode);
        campaignIdsForMode = (modeCampaigns || []).map((c) => c.id);
        if (campaignIdsForMode.length > 0) {
          leadQuery = leadQuery.in("campaign_id", campaignIdsForMode);
        } else {
          // No campaigns match → zero results
          setStats(buildStats(0, 0, 0, 0, 0));
          setLoading(false);
          return;
        }
      }

      const { data: filteredLeads } = await leadQuery;
      const totalLeads = filteredLeads?.length || 0;
      const leadIds = (filteredLeads || []).map((l) => l.id);

      if (leadIds.length === 0) {
        setStats(buildStats(0, 0, 0, 0, 0));
        setLoading(false);
        return;
      }

      // --- Get orders for these leads ---
      // Supabase .in() has a limit, batch if needed
      const batchSize = 200;
      let totalOrders = 0;
      let delivered = 0;
      let cancelled = 0;
      let returned = 0;

      for (let i = 0; i < leadIds.length; i += batchSize) {
        const batch = leadIds.slice(i, i + batchSize);
        const [ordersRes, deliveredRes, cancelledRes, returnedRes] = await Promise.all([
          supabase.from("orders").select("id", { count: "exact", head: true }).in("lead_id", batch).gte("created_at", monthStart),
          supabase.from("orders").select("id", { count: "exact", head: true }).in("lead_id", batch).eq("delivery_status", "delivered").gte("created_at", monthStart),
          supabase.from("orders").select("id", { count: "exact", head: true }).in("lead_id", batch).eq("status", "rejected").gte("created_at", monthStart),
          supabase.from("orders").select("id", { count: "exact", head: true }).in("lead_id", batch).eq("delivery_status", "returned").gte("created_at", monthStart),
        ]);
        totalOrders += ordersRes.count || 0;
        delivered += deliveredRes.count || 0;
        cancelled += cancelledRes.count || 0;
        returned += returnedRes.count || 0;
      }

      setStats(buildStats(totalLeads, totalOrders, delivered, cancelled, returned));
      setLoading(false);
    };

    const buildStats = (totalLeads: number, totalOrders: number, delivered: number, cancelled: number, returned: number): StatCard[] => {
      const salesRatio = totalLeads > 0 ? ((totalOrders / totalLeads) * 100).toFixed(1) : "0.0";
      const receiveRatio = totalLeads > 0 ? ((delivered / totalLeads) * 100).toFixed(1) : "0.0";
      const cancelRatio = totalLeads > 0 ? ((cancelled / totalLeads) * 100).toFixed(1) : "0.0";
      const returnRatio = totalLeads > 0 ? ((returned / totalLeads) * 100).toFixed(1) : "0.0";

      return [
        {
          labelKey: "total_sales",
          value: `${salesRatio}%`,
          sub: `${totalOrders} / ${totalLeads} ${isBn ? "লিড" : "leads"}`,
          icon: ShoppingCart,
          iconColor: "#EA580C",
          iconBg: "rgba(234, 88, 12, 0.15)",
        },
        {
          labelKey: "receive_ratio",
          value: `${receiveRatio}%`,
          sub: `${delivered} / ${totalLeads} ${isBn ? "লিড" : "leads"}`,
          icon: CheckCircle,
          iconColor: "#22C55E",
          iconBg: "rgba(34, 197, 94, 0.15)",
        },
        {
          labelKey: "cancel_ratio",
          value: `${cancelRatio}%`,
          sub: `${cancelled} / ${totalLeads} ${isBn ? "লিড" : "leads"}`,
          icon: XCircle,
          iconColor: "#EF4444",
          iconBg: "rgba(239, 68, 68, 0.15)",
        },
        {
          labelKey: "return_ratio",
          value: `${returnRatio}%`,
          sub: `${returned} / ${totalLeads} ${isBn ? "লিড" : "leads"}`,
          icon: RotateCcw,
          iconColor: "#F59E0B",
          iconBg: "rgba(245, 158, 11, 0.15)",
        },
      ];
    };

    fetchStats();
  }, [filters?.campaignId, filters?.dataMode, filters?.websiteSource]);

  const labels: Record<string, { bn: string; en: string }> = {
    total_sales: { bn: "Sales Ratio", en: "Sales Ratio" },
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

export default SAStatsCards;
