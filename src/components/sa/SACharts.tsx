import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import type { SAFilterState } from "@/pages/dashboard/SADashboard";

const TEAL = "#0D9488";

interface SAChartsProps {
  filters?: SAFilterState;
}

const SACharts = ({ filters }: SAChartsProps) => {
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [dailyOrders, setDailyOrders] = useState<{ date: string; count: number }[]>([]);
  const [campaignRatios, setCampaignRatios] = useState<{ name: string; ratio: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      setLoading(true);
      const campaignId = filters?.campaignId || "all";
      const dataMode = filters?.dataMode || "all";
      const websiteSource = filters?.websiteSource || "all";

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get filtered lead IDs first
      let leadQuery = supabase.from("leads").select("id").gte("created_at", thirtyDaysAgo.toISOString());
      if (campaignId !== "all") leadQuery = leadQuery.eq("campaign_id", campaignId);
      if (websiteSource !== "all") leadQuery = leadQuery.eq("source", websiteSource);

      if (dataMode !== "all") {
        const { data: modeCampaigns } = await supabase.from("campaigns").select("id").eq("data_mode", dataMode);
        const ids = (modeCampaigns || []).map((c) => c.id);
        if (ids.length > 0) leadQuery = leadQuery.in("campaign_id", ids);
        else {
          setDailyOrders([]);
          setCampaignRatios([]);
          setLoading(false);
          return;
        }
      }

      const { data: filteredLeads } = await leadQuery;
      const leadIds = (filteredLeads || []).map((l) => l.id);

      // Daily orders for filtered leads
      let ordersData: any[] = [];
      if (leadIds.length > 0) {
        const batchSize = 200;
        for (let i = 0; i < leadIds.length; i += batchSize) {
          const batch = leadIds.slice(i, i + batchSize);
          const { data } = await supabase
            .from("orders")
            .select("created_at")
            .in("lead_id", batch)
            .gte("created_at", thirtyDaysAgo.toISOString());
          if (data) ordersData.push(...data);
        }
      }

      const dateMap = new Map<string, number>();
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        dateMap.set(d.toISOString().split("T")[0], 0);
      }
      ordersData.forEach((o) => {
        const date = o.created_at?.split("T")[0];
        if (date && dateMap.has(date)) dateMap.set(date, (dateMap.get(date) || 0) + 1);
      });
      setDailyOrders(Array.from(dateMap.entries()).map(([date, count]) => ({ date: date.slice(5), count })));

      // Campaign receive ratios (based on leads, not orders)
      let campaignsToShow = await supabase.from("campaigns").select("id, name").eq("status", "active");
      let campaignsList = campaignsToShow.data || [];
      if (campaignId !== "all") campaignsList = campaignsList.filter((c) => c.id === campaignId);

      if (campaignsList.length > 0) {
        const ratios = await Promise.all(
          campaignsList.map(async (c) => {
            let lq = supabase.from("leads").select("id").eq("campaign_id", c.id);
            if (websiteSource !== "all") lq = lq.eq("source", websiteSource);
            const { data: cLeads } = await lq;
            const cLeadIds = (cLeads || []).map((l) => l.id);
            if (cLeadIds.length === 0) return { name: c.name, ratio: 0 };

            const { count: deliveredCount } = await supabase
              .from("orders")
              .select("id", { count: "exact", head: true })
              .in("lead_id", cLeadIds.slice(0, 200))
              .eq("delivery_status", "delivered");

            const ratio = cLeadIds.length > 0
              ? Math.round(((deliveredCount || 0) / cLeadIds.length) * 100)
              : 0;
            return { name: c.name, ratio };
          })
        );
        setCampaignRatios(ratios);
      } else {
        setCampaignRatios([]);
      }

      setLoading(false);
    };

    fetchChartData();
  }, [filters?.campaignId, filters?.dataMode, filters?.websiteSource]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border p-6 h-64 animate-pulse" />
        <div className="border border-border p-6 h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="border border-border p-4">
        <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase mb-4">
          {isBn ? "দৈনিক অর্ডার (৩০ দিন)" : "Daily Orders (30 Days)"}
        </h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dailyOrders}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="count" stroke={TEAL} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="border border-border p-4">
        <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase mb-4">
          {isBn ? "ক্যাম্পেইন রিসিভ রেশিও % (লিড ভিত্তিক)" : "Campaign Receive Ratio % (Lead-based)"}
        </h4>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={campaignRatios}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
                fontSize: 12,
              }}
            />
            <Bar dataKey="ratio" fill={TEAL} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SACharts;
