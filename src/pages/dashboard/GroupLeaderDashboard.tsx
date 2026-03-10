import { useState, useEffect } from "react";
import SalaryCard from "@/components/SalaryCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, TrendingUp } from "lucide-react";

interface AgentData {
  id: string;
  name: string;
  leadsToday: number;
  confirmedToday: number;
  delivered: number;
  receiveRatio: number;
  moodToday: string | null;
}

export default function GroupLeaderDashboard() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [basicSalary, setBasicSalary] = useState(0);
  const [deductions, setDeductions] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get GL's own info
      const { data: profileData } = await supabase.from("users").select("basic_salary").eq("id", user.id).single();
      if (profileData) setBasicSalary(profileData.basic_salary || 0);

      // Get group members
      const { data: members } = await supabase
        .from("group_members")
        .select("agent_id")
        .eq("group_leader_id", user.id);

      if (!members || members.length === 0) { setLoading(false); return; }

      const agentIds = members.map((m) => m.agent_id);

      // Get agent names
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name")
        .in("id", agentIds);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Get today's leads
      const { data: leadsData } = await supabase
        .from("leads")
        .select("assigned_to, status")
        .in("assigned_to", agentIds)
        .gte("created_at", todayStart.toISOString());

      // Get orders this month
      const { data: ordersData } = await supabase
        .from("orders")
        .select("agent_id, delivery_status, created_at")
        .in("agent_id", agentIds)
        .gte("created_at", monthStart.toISOString());

      // Get today's moods
      const { data: attData } = await supabase
        .from("attendance")
        .select("user_id, mood_in")
        .in("user_id", agentIds)
        .eq("date", todayStart.toISOString().slice(0, 10));

      // Get deductions
      const { data: dedData } = await supabase
        .from("attendance")
        .select("deduction_amount")
        .eq("user_id", user.id)
        .gte("date", monthStart.toISOString().slice(0, 10));
      if (dedData) setDeductions(dedData.reduce((s, a) => s + (Number(a.deduction_amount) || 0), 0));

      const moodMap: Record<string, string> = {};
      (attData || []).forEach((a) => { if (a.user_id) moodMap[a.user_id] = a.mood_in || ""; });

      const agentList: AgentData[] = (usersData || []).map((u) => {
        const myLeads = (leadsData || []).filter((l) => l.assigned_to === u.id);
        const myOrders = (ordersData || []).filter((o) => o.agent_id === u.id);
        const todayOrders = myOrders.filter((o) => new Date(o.created_at || "").toDateString() === new Date().toDateString());
        const delivered = myOrders.filter((o) => o.delivery_status === "delivered").length;
        const total = myOrders.length;
        return {
          id: u.id,
          name: u.name,
          leadsToday: myLeads.length,
          confirmedToday: todayOrders.length,
          delivered,
          receiveRatio: total > 0 ? Math.round((delivered / total) * 100) : 0,
          moodToday: moodMap[u.id] || null,
        };
      });

      setAgents(agentList);
      setLoading(false);
    })();
  }, [user]);

  const avgRatio = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.receiveRatio, 0) / agents.length)
    : 0;

  const MOOD_EMOJIS: Record<string, string> = {
    happy: "😊", sad: "😢", excited: "🎉", tired: "😴", neutral: "😐", angry: "😠",
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <SalaryCard />
      <h1 className="font-heading text-xl flex items-center gap-2">
        <Users className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
        Group Leader Dashboard
      </h1>

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-[hsl(var(--panel-employee)/0.3)]">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Group Average Receive Ratio</p>
            <p className="text-4xl font-heading text-[hsl(var(--panel-employee))]">{avgRatio}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Supervised Agents</p>
            <p className="text-2xl font-heading">{agents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">আমার Salary এই মাসে</p>
            <p className="text-2xl font-heading text-[hsl(var(--panel-employee))]">৳{(basicSalary - deductions).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Basic: ৳{basicSalary} | Ded: ৳{deductions}</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent table */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">Supervised Agents</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2 text-left">Agent Name</th>
                  <th className="py-2 px-2 text-right">Leads Today</th>
                  <th className="py-2 px-2 text-right">Confirmed Today</th>
                  <th className="py-2 px-2 text-right">Delivered</th>
                  <th className="py-2 px-2 text-right">Receive Ratio</th>
                  <th className="py-2 px-2 text-center">Mood</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-b border-border">
                    <td className="py-2 px-2 font-medium">{a.name}</td>
                    <td className="py-2 px-2 text-right">{a.leadsToday}</td>
                    <td className="py-2 px-2 text-right">{a.confirmedToday}</td>
                    <td className="py-2 px-2 text-right">{a.delivered}</td>
                    <td className="py-2 px-2 text-right">
                      <Badge variant="outline" className={cn(
                        a.receiveRatio >= 60 ? "text-green-400 border-green-600/50" :
                        a.receiveRatio >= 40 ? "text-yellow-400 border-yellow-500/50" :
                        "text-destructive border-destructive/50"
                      )}>{a.receiveRatio}%</Badge>
                    </td>
                    <td className="py-2 px-2 text-center text-xl">{a.moodToday ? (MOOD_EMOJIS[a.moodToday] || "—") : "—"}</td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">কোনো agent assigned নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
