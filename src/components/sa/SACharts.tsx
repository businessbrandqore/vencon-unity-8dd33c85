import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

const TEAL = "#0D9488";

const SACharts = () => {
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [dailyOrders, setDailyOrders] = useState<{ date: string; count: number }[]>([]);
  const [campaignRatios, setCampaignRatios] = useState<{ name: string; ratio: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      // Daily orders for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: orders } = await supabase
        .from("orders")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Group by date
      const dateMap = new Map<string, number>();
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        dateMap.set(d.toISOString().split("T")[0], 0);
      }
      orders?.forEach((o) => {
        const date = o.created_at?.split("T")[0];
        if (date && dateMap.has(date)) {
          dateMap.set(date, (dateMap.get(date) || 0) + 1);
        }
      });
      setDailyOrders(
        Array.from(dateMap.entries()).map(([date, count]) => ({
          date: date.slice(5), // MM-DD
          count,
        }))
      );

      // Campaign receive ratios
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("status", "active");

      if (campaigns && campaigns.length > 0) {
        const ratios = await Promise.all(
          campaigns.map(async (c) => {
            const { data: leads } = await supabase
              .from("leads")
              .select("id")
              .eq("campaign_id", c.id);

            const leadIds = leads?.map((l) => l.id) || [];
            if (leadIds.length === 0) return { name: c.name, ratio: 0 };

            const { count: totalOrders } = await supabase
              .from("orders")
              .select("id", { count: "exact", head: true })
              .in("lead_id", leadIds);

            const { count: delivered } = await supabase
              .from("orders")
              .select("id", { count: "exact", head: true })
              .in("lead_id", leadIds)
              .eq("delivery_status", "delivered");

            const ratio = (totalOrders || 0) > 0
              ? Math.round(((delivered || 0) / (totalOrders || 1)) * 100)
              : 0;

            return { name: c.name, ratio };
          })
        );
        setCampaignRatios(ratios);
      }

      setLoading(false);
    };

    fetchChartData();
  }, []);

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
      {/* Daily Orders Line Chart */}
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

      {/* Campaign Receive Ratio Bar Chart */}
      <div className="border border-border p-4">
        <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase mb-4">
          {isBn ? "ক্যাম্পেইন রিসিভ রেশিও %" : "Campaign Receive Ratio %"}
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
