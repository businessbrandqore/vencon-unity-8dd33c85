import { useState, useEffect, useCallback } from "react";
import SalaryCard from "@/components/SalaryCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, RefreshCw, Phone, Target, Package, Truck, BarChart3, MessageSquare } from "lucide-react";

type TimePeriod = "daily" | "monthly" | "yearly";

interface AgentData {
  id: string;
  name: string;
  phone: string | null;
  leadsToday: number;
  confirmedToday: number;
  delivered: number;
  totalOrders: number;
  receiveRatio: number;
  moodToday: string | null;
  leadsMonthly: number;
  confirmedMonthly: number;
  deliveredMonthly: number;
  totalOrdersMonthly: number;
  ratioMonthly: number;
  leadsYearly: number;
  confirmedYearly: number;
  deliveredYearly: number;
  totalOrdersYearly: number;
  ratioYearly: number;
}

export default function GroupLeaderDashboard() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("daily");
  const [activeTab, setActiveTab] = useState("overview");

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get group members
    const { data: members } = await supabase
      .from("group_members")
      .select("agent_id")
      .eq("group_leader_id", user.id);

    if (!members || members.length === 0) { setAgents([]); setLoading(false); return; }

    const agentIds = members.map((m) => m.agent_id);

    // Get agent info
    const { data: usersData } = await supabase
      .from("users")
      .select("id, name, phone")
      .in("id", agentIds);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    // Fetch all data in parallel
    const [leadsToday, ordersToday, leadsMonth, ordersMonth, ordersYear, attData] = await Promise.all([
      supabase.from("leads").select("assigned_to").in("assigned_to", agentIds).gte("created_at", todayStart.toISOString()),
      supabase.from("orders").select("agent_id, delivery_status, created_at").in("agent_id", agentIds).gte("created_at", todayStart.toISOString()),
      supabase.from("leads").select("assigned_to").in("assigned_to", agentIds).gte("created_at", monthStart.toISOString()),
      supabase.from("orders").select("agent_id, delivery_status, created_at").in("agent_id", agentIds).gte("created_at", monthStart.toISOString()),
      supabase.from("orders").select("agent_id, delivery_status").in("agent_id", agentIds).gte("created_at", yearStart.toISOString()),
      supabase.from("attendance").select("user_id, mood_in").in("user_id", agentIds).eq("date", todayStart.toISOString().slice(0, 10)),
    ]);

    const moodMap: Record<string, string> = {};
    (attData.data || []).forEach((a) => { if (a.user_id) moodMap[a.user_id] = a.mood_in || ""; });

    const agentList: AgentData[] = (usersData || []).map((u) => {
      const tLeads = (leadsToday.data || []).filter(l => l.assigned_to === u.id).length;
      const tOrders = (ordersToday.data || []).filter(o => o.agent_id === u.id);
      const tDelivered = tOrders.filter(o => o.delivery_status === "delivered").length;

      const mLeads = (leadsMonth.data || []).filter(l => l.assigned_to === u.id).length;
      const mOrders = (ordersMonth.data || []).filter(o => o.agent_id === u.id);
      const mDelivered = mOrders.filter(o => o.delivery_status === "delivered").length;

      const yOrders = (ordersYear.data || []).filter(o => o.agent_id === u.id);
      const yDelivered = yOrders.filter(o => o.delivery_status === "delivered").length;

      return {
        id: u.id,
        name: u.name,
        phone: u.phone,
        leadsToday: tLeads,
        confirmedToday: tOrders.length,
        delivered: tDelivered,
        totalOrders: tOrders.length,
        receiveRatio: tOrders.length > 0 ? Math.round((tDelivered / tOrders.length) * 100) : 0,
        moodToday: moodMap[u.id] || null,
        leadsMonthly: mLeads,
        confirmedMonthly: mOrders.length,
        deliveredMonthly: mDelivered,
        totalOrdersMonthly: mOrders.length,
        ratioMonthly: mOrders.length > 0 ? Math.round((mDelivered / mOrders.length) * 100) : 0,
        leadsYearly: 0,
        confirmedYearly: yOrders.length,
        deliveredYearly: yDelivered,
        totalOrdersYearly: yOrders.length,
        ratioYearly: yOrders.length > 0 ? Math.round((yDelivered / yOrders.length) * 100) : 0,
      };
    });

    setAgents(agentList);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime for orders/leads
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("gl-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadData]);

  const getStats = (a: AgentData) => {
    if (timePeriod === "daily") return { leads: a.leadsToday, orders: a.confirmedToday, delivered: a.delivered, ratio: a.receiveRatio };
    if (timePeriod === "monthly") return { leads: a.leadsMonthly, orders: a.confirmedMonthly, delivered: a.deliveredMonthly, ratio: a.ratioMonthly };
    return { leads: a.leadsYearly, orders: a.confirmedYearly, delivered: a.deliveredYearly, ratio: a.ratioYearly };
  };

  const totalStats = agents.reduce((acc, a) => {
    const s = getStats(a);
    return {
      leads: acc.leads + s.leads,
      orders: acc.orders + s.orders,
      delivered: acc.delivered + s.delivered,
    };
  }, { leads: 0, orders: 0, delivered: 0 });

  const avgRatio = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + getStats(a).ratio, 0) / agents.length)
    : 0;

  const MOOD_EMOJIS: Record<string, string> = {
    happy: "😊", sad: "😢", excited: "🎉", tired: "😴", neutral: "😐", angry: "😠",
  };

  const periodLabel = timePeriod === "daily" ? "আজকের" : timePeriod === "monthly" ? "মাসিক" : "বাৎসরিক";

  if (loading) return <div className="p-6 text-muted-foreground flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <SalaryCard />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Users className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
          গ্রুপ লিডার ড্যাশবোর্ড
        </h1>
        <div className="flex items-center gap-2">
          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <SelectTrigger className="w-28 bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">দৈনিক</SelectItem>
              <SelectItem value="monthly">মাসিক</SelectItem>
              <SelectItem value="yearly">বাৎসরিক</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-[hsl(var(--panel-employee)/0.3)]">
          <CardContent className="pt-5 pb-4 text-center">
            <Target className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">{periodLabel} লিড</p>
            <p className="text-2xl font-heading font-bold text-foreground">{totalStats.leads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Package className="h-4 w-4 mx-auto mb-1 text-blue-500" />
            <p className="text-xs text-muted-foreground">{periodLabel} অর্ডার</p>
            <p className="text-2xl font-heading font-bold text-foreground">{totalStats.orders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Truck className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
            <p className="text-xs text-muted-foreground">{periodLabel} ডেলিভারি</p>
            <p className="text-2xl font-heading font-bold text-foreground">{totalStats.delivered}</p>
          </CardContent>
        </Card>
        <Card className="border-[hsl(var(--panel-employee)/0.3)]">
          <CardContent className="pt-5 pb-4 text-center">
            <BarChart3 className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--panel-employee))]" />
            <p className="text-xs text-muted-foreground">গড় রিসিভ রেশিও</p>
            <p className={cn("text-2xl font-heading font-bold",
              avgRatio >= 60 ? "text-emerald-500" : avgRatio >= 40 ? "text-amber-500" : "text-destructive"
            )}>{avgRatio}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Users className="h-3.5 w-3.5 mr-1.5" /> এজেন্ট পারফরম্যান্স ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="mood">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> আজকের মুড
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">এজেন্ট</TableHead>
                      <TableHead className="text-center">{periodLabel} লিড</TableHead>
                      <TableHead className="text-center">{periodLabel} অর্ডার</TableHead>
                      <TableHead className="text-center">{periodLabel} ডেলিভারি</TableHead>
                      <TableHead className="text-center">রিসিভ রেশিও</TableHead>
                      <TableHead className="text-center">ফোন</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          কোনো এজেন্ট আপনার গ্রুপে নেই
                        </TableCell>
                      </TableRow>
                    ) : agents.map((a) => {
                      const s = getStats(a);
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                {a.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{a.name}</p>
                                {a.moodToday && (
                                  <span className="text-xs">{MOOD_EMOJIS[a.moodToday] || "—"}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono">{s.leads}</TableCell>
                          <TableCell className="text-center font-mono">{s.orders}</TableCell>
                          <TableCell className="text-center font-mono">{s.delivered}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-mono text-xs",
                                s.ratio >= 60 ? "text-emerald-500 border-emerald-500/50" :
                                s.ratio >= 40 ? "text-amber-500 border-amber-500/50" :
                                "text-destructive border-destructive/50"
                              )}
                            >
                              {s.ratio}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {a.phone ? (
                              <a href={`tel:${a.phone}`} className="flex items-center justify-center gap-1 hover:text-primary">
                                <Phone className="h-3 w-3" /> {a.phone}
                              </a>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mood">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">আজকের এজেন্ট মুড</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {agents.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                    <span className="text-2xl">{a.moodToday ? (MOOD_EMOJIS[a.moodToday] || "❓") : "⬜"}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.moodToday ? a.moodToday : "চেক-ইন হয়নি"}
                      </p>
                    </div>
                  </div>
                ))}
                {agents.length === 0 && (
                  <p className="col-span-full text-center text-muted-foreground py-8">কোনো এজেন্ট নেই</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
