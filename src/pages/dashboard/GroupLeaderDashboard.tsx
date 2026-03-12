import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Users, TrendingUp, RefreshCw, Phone, Target, Package, Truck, BarChart3,
  DollarSign, Clock, ChevronDown, ChevronUp, Info, AlertTriangle, CheckCircle,
  Trophy, Award,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😊", sad: "😢", excited: "🎉", tired: "😴", neutral: "😐", angry: "😠",
};
const MOOD_LABELS: Record<string, string> = {
  happy: "খুশি", sad: "দুঃখিত", excited: "উৎসাহিত", tired: "ক্লান্ত", neutral: "সাধারণ", angry: "রাগান্বিত",
};
const MOOD_COLORS: Record<string, string> = {
  happy: "#22c55e", sad: "#3b82f6", excited: "#f59e0b", tired: "#8b5cf6", neutral: "#6b7280", angry: "#ef4444",
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (v: number) => v.toLocaleString("bn-BD");

interface AgentData {
  id: string;
  name: string;
  phone: string | null;
  bronzeLeads: number;
  silverLeads: number;
  leadsToday: number;
  calledToday: number;
  confirmedToday: number;
  confirmedMonth: number;
  deliveredMonth: number;
  cancelledMonth: number;
  totalLeadsMonth: number;
  calledMonth: number;
  ratioMonth: number;
  moodToday: string | null;
  clockIn: string | null;
  clockOut: string | null;
  isLate: boolean;
  shiftStart: string | null;
  shiftEnd: string | null;
  moodNote: string | null;
  hasLeaveToday: boolean;
}

interface DailyTrend {
  day: string;
  confirmed: number;
  delivered: number;
}

export default function GroupLeaderDashboard() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [salaryData, setSalaryData] = useState<any>(null);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [incentiveThreshold, setIncentiveThreshold] = useState(0);
  const [campaignName, setCampaignName] = useState<string | null>(null);

  const now = new Date();
  const monthStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return d.toISOString();
  }, []);
  const monthEnd = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch GL's campaign from campaign_agent_roles
    const { data: carData } = await supabase
      .from("campaign_agent_roles")
      .select("campaign_id, campaigns(id, name)")
      .eq("agent_id", user.id)
      .limit(1);
    if (carData && carData.length > 0) {
      const c = carData[0] as any;
      setCampaignName(c.campaigns?.name || null);
    }

    const { data: members } = await supabase
      .from("group_members")
      .select("agent_id")
      .eq("group_leader_id", user.id);

    if (!members || members.length === 0) {
      setAgents([]);
      setLoading(false);
      return;
    }

    const agentIds = members.map((m) => m.agent_id);
    const today = todayStr();

    const [
      usersRes, leadsAllRes, ordersMonthRes, attTodayRes, leavesRes, incentiveRes,
    ] = await Promise.all([
      supabase.from("users").select("id, name, phone, shift_start, shift_end").in("id", agentIds).eq("is_active", true),
      supabase.from("leads").select("id, assigned_to, status, agent_type, updated_at, called_date").in("assigned_to", agentIds),
      supabase.from("orders").select("id, agent_id, delivery_status, status, created_at").in("agent_id", agentIds).gte("created_at", monthStart).lte("created_at", monthEnd),
      supabase.from("attendance").select("user_id, clock_in, clock_out, mood_in, mood_note, is_late").in("user_id", agentIds).eq("date", today),
      supabase.from("leave_requests").select("user_id, status, start_date, end_date").in("user_id", agentIds).eq("status", "approved").lte("start_date", today).gte("end_date", today),
      supabase.from("incentive_config").select("minimum_threshold").eq("role", "group_leader").eq("status", "approved").limit(1),
    ]);

    const threshold = incentiveRes.data?.[0]?.minimum_threshold || 0;
    setIncentiveThreshold(threshold);

    const attMap: Record<string, any> = {};
    (attTodayRes.data || []).forEach((a) => { if (a.user_id) attMap[a.user_id] = a; });

    const leaveSet = new Set((leavesRes.data || []).map((l) => l.user_id));

    const agentList: AgentData[] = (usersRes.data || []).map((u) => {
      const att = attMap[u.id];
      const agentLeads = (leadsAllRes.data || []).filter((l) => l.assigned_to === u.id);
      const todayLeads = agentLeads.filter((l) => l.updated_at && l.updated_at.slice(0, 10) === today && l.status !== "fresh");
      const calledToday = agentLeads.filter((l) => l.called_date && l.called_date.slice(0, 10) === today);
      const bronzeLeads = agentLeads.filter((l) => l.agent_type === "bronze").length;
      const silverLeads = agentLeads.filter((l) => l.agent_type === "silver").length;

      const agentOrders = (ordersMonthRes.data || []).filter((o) => o.agent_id === u.id);
      const confirmedMonth = agentOrders.filter((o) => o.status !== "rejected").length;
      const deliveredMonth = agentOrders.filter((o) => o.delivery_status === "delivered").length;
      const cancelledMonth = agentOrders.filter((o) => o.status === "rejected" || o.delivery_status === "returned").length;
      const todayOrders = agentOrders.filter((o) => o.created_at && o.created_at.slice(0, 10) === today);

      return {
        id: u.id,
        name: u.name,
        phone: u.phone,
        bronzeLeads,
        silverLeads,
        leadsToday: todayLeads.length,
        calledToday: calledToday.length,
        confirmedToday: todayOrders.length,
        confirmedMonth,
        deliveredMonth,
        cancelledMonth,
        totalLeadsMonth: agentLeads.filter((l) => l.updated_at && l.updated_at >= monthStart).length,
        calledMonth: agentLeads.filter((l) => l.called_date && l.called_date >= monthStart.slice(0, 10)).length,
        ratioMonth: confirmedMonth > 0 ? Math.round((deliveredMonth / confirmedMonth) * 100 * 10) / 10 : 0,
        moodToday: att?.mood_in || null,
        clockIn: att?.clock_in || null,
        clockOut: att?.clock_out || null,
        isLate: att?.is_late || false,
        shiftStart: u.shift_start,
        shiftEnd: u.shift_end,
        moodNote: att?.mood_note || null,
        hasLeaveToday: leaveSet.has(u.id),
      };
    });

    setAgents(agentList);

    // 7-day trend
    const trend: DailyTrend[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const dayOrders = (ordersMonthRes.data || []).filter((o) => o.created_at?.slice(0, 10) === ds);
      trend.push({
        day: d.toLocaleDateString("bn-BD", { weekday: "short" }),
        confirmed: dayOrders.filter((o) => o.status !== "rejected").length,
        delivered: dayOrders.filter((o) => o.delivery_status === "delivered").length,
      });
    }
    setDailyTrend(trend);

    // Salary
    const { data: salData } = await supabase.rpc("calculate_salary", {
      _user_id: user.id,
      _year: now.getFullYear(),
      _month: now.getMonth() + 1,
    });
    if (salData) setSalaryData(salData);

    // My attendance this month
    const { data: myAtt } = await supabase
      .from("attendance")
      .select("date, clock_in, clock_out, is_late, is_early_out, deduction_amount")
      .eq("user_id", user.id)
      .gte("date", monthStart.slice(0, 10))
      .lte("date", today);
    setMyAttendance(myAtt || []);

    setLoading(false);
  }, [user, monthStart, monthEnd]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("gl-dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadData]);

  // Computed stats
  const totalMembers = agents.length;
  const todayLeadCalls = agents.reduce((s, a) => s + a.calledToday, 0);
  const todayConfirmed = agents.reduce((s, a) => s + a.confirmedToday, 0);
  const totalConfirmedMonth = agents.reduce((s, a) => s + a.confirmedMonth, 0);
  const totalDeliveredMonth = agents.reduce((s, a) => s + a.deliveredMonth, 0);
  const groupAvgRatio = agents.length > 0
    ? Math.round((agents.reduce((s, a) => s + a.ratioMonth, 0) / agents.length) * 10) / 10
    : 0;

  const ratioColor = (r: number) =>
    r >= incentiveThreshold ? "text-emerald-500" :
    r >= incentiveThreshold - 10 ? "text-amber-500" : "text-destructive";

  const sortedByRatio = [...agents].sort((a, b) => b.ratioMonth - a.ratioMonth);
  const rankEmoji = (i: number) => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;

  // Mood pie
  const moodCounts = agents.reduce((acc, a) => {
    const m = a.moodToday || "none";
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const moodPieData = Object.entries(moodCounts)
    .filter(([k]) => k !== "none")
    .map(([mood, count]) => ({ name: MOOD_LABELS[mood] || mood, value: count, color: MOOD_COLORS[mood] || "#999" }));

  // My attendance summary
  const presentDays = myAttendance.filter((a) => a.clock_in).length;
  const lateDays = myAttendance.filter((a) => a.is_late).length;
  const earlyOutDays = myAttendance.filter((a) => a.is_early_out).length;
  const totalDeduction = myAttendance.reduce((s, a) => s + (Number(a.deduction_amount) || 0), 0);

  const getAttendanceStatus = (a: AgentData) => {
    if (a.hasLeaveToday) return { label: "ছুটিতে", color: "text-blue-500", dot: "bg-blue-500" };
    if (!a.clockIn) return { label: "অনুপস্থিত", color: "text-destructive", dot: "bg-destructive" };
    if (a.clockOut) return { label: "Shift শেষ", color: "text-muted-foreground", dot: "bg-muted-foreground" };
    if (a.isLate) return { label: "বিলম্বিত", color: "text-amber-500", dot: "bg-amber-500" };
    return { label: "সময়মতো", color: "text-emerald-500", dot: "bg-emerald-500" };
  };

  if (loading) {
    return (
      <div className="p-6 text-muted-foreground flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" /> লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ SECTION 1: TOP STATS ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-xl flex items-center gap-2">
            <Users className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
            গ্রুপ লিডার ড্যাশবোর্ড
          </h1>
          {campaignName && (
            <p className="text-sm text-muted-foreground mt-1">
              ক্যাম্পেইন: <span className="font-semibold text-foreground">{campaignName}</span>
            </p>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">আমার গ্রুপের সদস্য</p>
            <p className="text-2xl font-heading font-bold text-foreground">{totalMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Phone className="h-4 w-4 mx-auto mb-1 text-blue-500" />
            <p className="text-xs text-muted-foreground">আজকের মোট Lead Call</p>
            <p className="text-2xl font-heading font-bold text-foreground">{todayLeadCalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Package className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--panel-employee))]" />
            <p className="text-xs text-muted-foreground">আজকের Confirm</p>
            <p className="text-2xl font-heading font-bold text-foreground">{todayConfirmed}</p>
          </CardContent>
        </Card>
        <Card className="border-[hsl(var(--panel-employee)/0.3)]">
          <CardContent className="pt-5 pb-4 text-center">
            <BarChart3 className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--panel-employee))]" />
            <p className="text-xs text-muted-foreground">এই মাসের গ্রুপ Receive Ratio</p>
            <p className={cn("text-2xl font-heading font-bold", ratioColor(groupAvgRatio))}>{groupAvgRatio}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <DollarSign className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
            <p className="text-xs text-muted-foreground">আমার এই মাসের Incentive</p>
            <p className="text-2xl font-heading font-bold text-emerald-500">
              BDT {fmt(salaryData?.incentive || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ SECTION 2: MY GROUP TABLE ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Users className="h-4 w-4" /> আমার গ্রুপ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Agent Name</TableHead>
                  <TableHead className="text-center">Role</TableHead>
                  <TableHead className="text-center">Leads Today</TableHead>
                  <TableHead className="text-center">Called Today</TableHead>
                  <TableHead className="text-center">Confirmed Today</TableHead>
                  <TableHead className="text-center">Ratio % (মাস)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Mood</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      কোনো এজেন্ট আপনার গ্রুপে নেই
                    </TableCell>
                  </TableRow>
                ) : agents.map((a) => {
                  const status = getAttendanceStatus(a);
                  const isOpen = expandedAgent === a.id;
                  return (
                    <Collapsible key={a.id} open={isOpen} onOpenChange={() => setExpandedAgent(isOpen ? null : a.id)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-secondary/50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                  {a.name.charAt(0)}
                                </div>
                                <span className="font-medium text-foreground">{a.name}</span>
                                {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {a.bronzeLeads > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-600 text-amber-600">Bronze</Badge>}
                                {a.silverLeads > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-400 text-slate-400">Silver</Badge>}
                                {a.bronzeLeads === 0 && a.silverLeads === 0 && <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono">{a.leadsToday}</TableCell>
                            <TableCell className="text-center font-mono">{a.calledToday}</TableCell>
                            <TableCell className="text-center font-mono">{a.confirmedToday}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={cn("font-mono text-xs", ratioColor(a.ratioMonth))}>
                                {a.ratioMonth}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className={cn("w-2 h-2 rounded-full", status.dot)} />
                                <span className={cn("text-xs", status.color)}>{status.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-lg">
                              {a.moodToday ? MOOD_EMOJIS[a.moodToday] || "—" : "—"}
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={8} className="bg-secondary/30 p-4">
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center text-sm">
                                <div>
                                  <p className="text-xs text-muted-foreground">মাসের মোট Lead</p>
                                  <p className="font-heading font-bold">{a.totalLeadsMonth}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">মাসের Called</p>
                                  <p className="font-heading font-bold">{a.calledMonth}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Confirmed</p>
                                  <p className="font-heading font-bold">{a.confirmedMonth}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Delivered</p>
                                  <p className="font-heading font-bold text-emerald-500">{a.deliveredMonth}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Cancelled</p>
                                  <p className="font-heading font-bold text-destructive">{a.cancelledMonth}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Receive Ratio</p>
                                  <p className={cn("font-heading font-bold", ratioColor(a.ratioMonth))}>{a.ratioMonth}%</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ SECTION 3: GROUP PERFORMANCE ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Group Average Ratio - prominent */}
        <Card className="border-[hsl(var(--panel-employee)/0.3)]">
          <CardContent className="pt-8 pb-8 text-center">
            <BarChart3 className="h-6 w-6 mx-auto mb-2 text-[hsl(var(--panel-employee))]" />
            <p className="text-sm text-muted-foreground mb-1">গ্রুপ গড় Receive Ratio</p>
            <p className={cn("text-5xl font-heading font-bold", ratioColor(groupAvgRatio))}>{groupAvgRatio}%</p>
            <p className="text-xs text-muted-foreground mt-2">
              {totalDeliveredMonth} delivered / {totalConfirmedMonth} confirmed
            </p>
          </CardContent>
        </Card>

        {/* Agent ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> এজেন্ট র‍্যাঙ্কিং (Receive Ratio)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedByRatio.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">কোনো এজেন্ট নেই</p>
            ) : sortedByRatio.map((a, i) => (
              <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg w-8 text-center">{rankEmoji(i)}</span>
                  <span className="text-sm font-medium">{a.name}</span>
                </div>
                <Badge variant="outline" className={cn("font-mono text-xs", ratioColor(a.ratioMonth))}>
                  {a.ratioMonth}%
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Performance trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading">গত ৭ দিনের পারফরম্যান্স</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrend}>
                <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <RechartsTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Bar dataKey="confirmed" name="Confirmed" fill="hsl(var(--panel-employee))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delivered" name="Delivered" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ═══ SECTION 4: ATTENDANCE & MOOD ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Clock className="h-4 w-4" /> আজকের উপস্থিতি
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Name</TableHead>
                      <TableHead className="text-center">Clock In</TableHead>
                      <TableHead className="text-center">Clock Out</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Mood</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((a) => {
                      const status = getAttendanceStatus(a);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-center text-sm">
                            {a.clockIn ? new Date(a.clockIn).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {a.clockOut ? new Date(a.clockOut).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("text-xs", status.color)}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-center text-lg">
                            {a.moodToday ? MOOD_EMOJIS[a.moodToday] || "—" : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                            {a.moodNote || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mood pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading">আজকের মুড সারসংক্ষেপ</CardTitle>
          </CardHeader>
          <CardContent>
            {moodPieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">কেউ এখনো চেক-ইন করেনি</p>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={moodPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.name} (${e.value})`}>
                      {moodPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ SECTION 5: MY SALARY ═══ */}
      {salaryData && (
        <Card className="border-[hsl(var(--panel-employee)/0.3)]">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
              আমার এই মাসের বেতন (Real-time)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">মূল বেতন</span>
                <span className="font-medium">BDT {fmt(salaryData.basic_salary || 0)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">গ্রুপ গড় Receive Ratio</span>
                <span className={cn("font-medium", ratioColor(groupAvgRatio))}>{groupAvgRatio}%</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">গ্রুপের মোট Delivered orders</span>
                <span className="font-medium">{totalDeliveredMonth}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">মোট Incentive</span>
                <span className="font-medium text-emerald-500">+BDT {fmt(salaryData.incentive || 0)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">কর্তন (বিলম্ব/ছুটি)</span>
                <span className="font-medium text-destructive">-BDT {fmt(salaryData.total_deductions || 0)}</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-border font-bold text-lg">
                <span>নেট বেতন</span>
                <span className="text-[hsl(var(--panel-employee))]">BDT {fmt(salaryData.net_salary || 0)}</span>
              </div>
            </div>

            <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-muted-foreground">
              <Info className="h-4 w-4 inline mr-2 text-blue-400" />
              আপনার incentive আপনার গ্রুপের সকল agent-এর গড় Receive Ratio-এর উপর নির্ভর করে।
              গ্রুপের ratio যত বেশি, আপনার incentive তত বেশি।
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ SECTION 6: MY OWN ATTENDANCE SUMMARY ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Clock className="h-4 w-4" /> আমার এই মাসের উপস্থিতি সারসংক্ষেপ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">উপস্থিত</p>
              <p className="text-2xl font-heading font-bold text-emerald-500">{presentDays} দিন</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">বিলম্বিত</p>
              <p className="text-2xl font-heading font-bold text-amber-500">{lateDays} দিন</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">আগে গেছে</p>
              <p className="text-2xl font-heading font-bold text-orange-500">{earlyOutDays} দিন</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">মোট কর্তন</p>
              <p className="text-2xl font-heading font-bold text-destructive">BDT {fmt(totalDeduction)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
