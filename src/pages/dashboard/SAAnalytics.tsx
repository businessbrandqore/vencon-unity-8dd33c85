import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const TEAL = "#0D9488";
const PIE_COLORS = ["#0D9488", "#EF4444", "#F59E0B", "#3B82F6", "#6B7280"];

type DateRange = "today" | "week" | "month" | "custom";

const SAAnalytics = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [totalLeads, setTotalLeads] = useState(0);
  const [orderConfirm, setOrderConfirm] = useState(0);
  const [receiveCount, setReceiveCount] = useState(0);
  const [cancelCount, setCancelCount] = useState(0);
  const [returnCount, setReturnCount] = useState(0);
  const [incentivePayout, setIncentivePayout] = useState(0);
  const [profitSharePaid, setProfitSharePaid] = useState(0);
  const [topAgents, setTopAgents] = useState<any[]>([]);
  const [deliveryBreakdown, setDeliveryBreakdown] = useState<any[]>([]);
  const [dailyOrders, setDailyOrders] = useState<any[]>([]);

  const getDateRange = useCallback((): { start: string; end: string } => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    switch (dateRange) {
      case "today":
        return { start: todayStr, end: format(new Date(now.getTime() + 86400000), "yyyy-MM-dd") };
      case "week":
        return { start: format(startOfWeek(now, { weekStartsOn: 6 }), "yyyy-MM-dd"), end: format(new Date(now.getTime() + 86400000), "yyyy-MM-dd") };
      case "month":
        return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(new Date(now.getTime() + 86400000), "yyyy-MM-dd") };
      case "custom":
        return {
          start: customStart ? format(customStart, "yyyy-MM-dd") : todayStr,
          end: customEnd ? format(new Date(customEnd.getTime() + 86400000), "yyyy-MM-dd") : format(new Date(now.getTime() + 86400000), "yyyy-MM-dd"),
        };
      default:
        return { start: todayStr, end: format(new Date(now.getTime() + 86400000), "yyyy-MM-dd") };
    }
  }, [dateRange, customStart, customEnd]);

  // Fetch campaigns list
  useEffect(() => {
    supabase.from("campaigns").select("id, name").then(({ data }) => {
      if (data) setCampaigns(data);
    });
  }, []);

  // Fetch all analytics data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { start, end } = getDateRange();

      // Build lead query
      let leadQuery = supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end);
      if (campaignFilter !== "all") leadQuery = leadQuery.eq("campaign_id", campaignFilter);
      const { count: leadsCount } = await leadQuery;
      setTotalLeads(leadsCount || 0);

      // Get lead IDs for campaign filter (needed for orders)
      let leadIdsForOrders: string[] | null = null;
      if (campaignFilter !== "all") {
        const { data: filteredLeads } = await supabase.from("leads").select("id").eq("campaign_id", campaignFilter);
        leadIdsForOrders = filteredLeads?.map((l) => l.id) || [];
      }

      // Orders query helper
      const orderQuery = async (additionalFilter?: Record<string, string>): Promise<{ count: number }> => {
        if (leadIdsForOrders !== null && leadIdsForOrders.length === 0) {
          return { count: 0 };
        }
        let q = supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end) as any;
        if (leadIdsForOrders !== null && leadIdsForOrders.length > 0) {
          q = q.in("lead_id", leadIdsForOrders);
        }
        if (additionalFilter) {
          Object.entries(additionalFilter).forEach(([k, v]) => { q = q.eq(k, v); });
        }
        const res = await q;
        return { count: res.count || 0 };
      };

      const [confirmRes, deliveredRes, cancelledRes, returnedRes] = await Promise.all([
        orderQuery(),
        orderQuery({ delivery_status: "delivered" }),
        orderQuery({ delivery_status: "cancelled" }),
        orderQuery({ delivery_status: "returned" }),
      ]);

      const confirmed = confirmRes.count || 0;
      const delivered = deliveredRes.count || 0;
      const cancelled = cancelledRes.count || 0;
      const returned = returnedRes.count || 0;

      setOrderConfirm(confirmed);
      setReceiveCount(delivered);
      setCancelCount(cancelled);
      setReturnCount(returned);

      // Incentive payout (placeholder - sum from incentive_config)
      setIncentivePayout(0);
      setProfitSharePaid(0);

      // Delivery breakdown for pie chart
      const inTransitRes = await orderQuery({ delivery_status: "in_transit" });
      const pendingRes = await orderQuery({ delivery_status: "pending" });
      setDeliveryBreakdown([
        { name: isBn ? "ডেলিভারড" : "Delivered", value: delivered },
        { name: isBn ? "রিটার্নড" : "Returned", value: returned },
        { name: isBn ? "ক্যান্সেলড" : "Cancelled", value: cancelled },
        { name: isBn ? "ইন ট্রানজিট" : "In Transit", value: inTransitRes.count || 0 },
        { name: isBn ? "পেন্ডিং" : "Pending", value: pendingRes.count || 0 },
      ]);

      // Daily orders (last 30 days)
      const thirtyAgo = subDays(new Date(), 30);
      let dailyQ = supabase.from("orders").select("created_at").gte("created_at", format(thirtyAgo, "yyyy-MM-dd"));
      if (leadIdsForOrders !== null && leadIdsForOrders.length > 0) {
        dailyQ = dailyQ.in("lead_id", leadIdsForOrders);
      }
      const { data: dailyData } = await dailyQ;
      const dateMap = new Map<string, number>();
      for (let i = 0; i < 30; i++) {
        const d = subDays(new Date(), 29 - i);
        dateMap.set(format(d, "yyyy-MM-dd"), 0);
      }
      dailyData?.forEach((o) => {
        const date = o.created_at?.split("T")[0];
        if (date && dateMap.has(date)) dateMap.set(date, (dateMap.get(date) || 0) + 1);
      });
      setDailyOrders(Array.from(dateMap.entries()).map(([date, count]) => ({ date: date.slice(5), count })));

      // Top 10 agents by receive ratio
      const { data: agents } = await supabase
        .from("users")
        .select("id, name")
        .eq("role", "telesales_executive")
        .eq("is_active", true);

      if (agents && agents.length > 0) {
        const agentStats = await Promise.all(
          agents.map(async (agent) => {
            let confQ = supabase.from("orders").select("id", { count: "exact", head: true }).eq("agent_id", agent.id).gte("created_at", start).lt("created_at", end);
            let delQ = supabase.from("orders").select("id", { count: "exact", head: true }).eq("agent_id", agent.id).eq("delivery_status", "delivered").gte("created_at", start).lt("created_at", end);

            const [c, d] = await Promise.all([confQ, delQ]);
            const conf = c.count || 0;
            const del = d.count || 0;
            const ratio = conf > 0 ? Math.round((del / conf) * 100) : 0;
            return { name: agent.name, confirmed: conf, delivered: del, ratio, incentive: 0 };
          })
        );
        agentStats.sort((a, b) => b.ratio - a.ratio);
        setTopAgents(agentStats.slice(0, 10));
      }

      setLoading(false);
    };

    fetchData();
  }, [dateRange, customStart, customEnd, campaignFilter, getDateRange, isBn]);

  const pct = (n: number, total: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : "0%";

  const statCards = [
    { label: isBn ? "মোট লিড" : "Total Leads", value: totalLeads },
    { label: isBn ? "অর্ডার কনফার্মড" : "Orders Confirmed", value: `${orderConfirm} (${pct(orderConfirm, totalLeads)})` },
    { label: isBn ? "রিসিভ" : "Received", value: `${receiveCount} (${pct(receiveCount, orderConfirm)})` },
    { label: isBn ? "ক্যান্সেল" : "Cancelled", value: `${cancelCount} (${pct(cancelCount, orderConfirm)})` },
    { label: isBn ? "রিটার্ন" : "Returned", value: `${returnCount} (${pct(returnCount, orderConfirm)})` },
    { label: isBn ? "ইনসেনটিভ পেআউট" : "Incentive Payout", value: `৳${incentivePayout.toLocaleString()}` },
    { label: isBn ? "প্রফিট শেয়ার" : "Profit Share", value: `৳${profitSharePaid.toLocaleString()}` },
  ];

  const handleExportPdf = () => {
    window.print();
  };

  if (!user) return null;

  return (
    <div className="space-y-6 print:space-y-4" id="analytics-page">
      {/* Header + Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "কোম্পানি অ্যানালিটিক্স" : "Company Analytics"}
        </h2>
        <button
          onClick={handleExportPdf}
          className="px-4 py-2 text-xs font-heading tracking-wider border border-border hover:bg-secondary transition-colors print:hidden"
          style={{ color: TEAL }}
        >
          {isBn ? "PDF এক্সপোর্ট" : "Export PDF"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {(["today", "week", "month", "custom"] as DateRange[]).map((r) => {
          const labels: Record<DateRange, string> = {
            today: isBn ? "আজ" : "Today",
            week: isBn ? "এই সপ্তাহ" : "This Week",
            month: isBn ? "এই মাস" : "This Month",
            custom: isBn ? "কাস্টম" : "Custom",
          };
          return (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className="px-3 py-1.5 text-xs font-heading tracking-wider border transition-colors"
              style={{
                borderColor: dateRange === r ? TEAL : "hsl(var(--border))",
                color: dateRange === r ? TEAL : "hsl(var(--muted-foreground))",
                backgroundColor: dateRange === r ? `${TEAL}15` : "transparent",
              }}
            >
              {labels[r]}
            </button>
          );
        })}

        {dateRange === "custom" && (
          <div className="flex gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <button className="px-3 py-1.5 text-xs font-body border border-border">
                  {customStart ? format(customStart, "dd/MM/yy") : (isBn ? "শুরু" : "Start")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <button className="px-3 py-1.5 text-xs font-body border border-border">
                  {customEnd ? format(customEnd, "dd/MM/yy") : (isBn ? "শেষ" : "End")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-body bg-transparent border border-border text-foreground focus:outline-none"
        >
          <option value="all">{isBn ? "সব ক্যাম্পেইন" : "All Campaigns"}</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-[1px] bg-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-background p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-[1px] bg-border">
            {statCards.map((s) => (
              <div key={s.label} className="bg-background p-4">
                <p className="font-body text-[11px] text-muted-foreground">{s.label}</p>
                <p className="font-heading text-lg font-bold mt-1" style={{ color: TEAL }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Orders */}
            <div className="border border-border p-4">
              <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase mb-4">
                {isBn ? "দৈনিক অর্ডার (৩০ দিন)" : "Daily Orders (30 Days)"}
              </h4>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyOrders}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke={TEAL} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Delivery Breakdown Pie */}
            <div className="border border-border p-4">
              <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase mb-4">
                {isBn ? "ডেলিভারি স্ট্যাটাস" : "Delivery Status Breakdown"}
              </h4>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={deliveryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}>
                    {deliveryBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 10 Agents */}
          <div>
            <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase mb-4">
              {isBn ? "টপ ১০ টেলিসেলস এক্সিকিউটিভ (রিসিভ রেশিও)" : "Top 10 Telesales Executives (Receive Ratio)"}
            </h4>
            <div className="border border-border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {[isBn ? "নাম" : "Name", isBn ? "কনফার্মড" : "Confirmed", isBn ? "ডেলিভারড" : "Delivered", isBn ? "রেশিও" : "Ratio", isBn ? "ইনসেনটিভ" : "Incentive"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-heading text-xs tracking-wider text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topAgents.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center font-body text-xs text-muted-foreground">{isBn ? "ডেটা নেই" : "No data"}</td></tr>
                  ) : (
                    topAgents.map((a, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-body text-xs text-foreground">{a.name}</td>
                        <td className="px-4 py-3 font-body text-xs text-foreground">{a.confirmed}</td>
                        <td className="px-4 py-3 font-body text-xs text-foreground">{a.delivered}</td>
                        <td className="px-4 py-3 font-heading text-xs font-bold" style={{ color: TEAL }}>{a.ratio}%</td>
                        <td className="px-4 py-3 font-body text-xs text-foreground">৳{a.incentive}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SAAnalytics;
