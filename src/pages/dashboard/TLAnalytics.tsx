import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#7C3AED", "#A78BFA", "#C4B5FD", "#DDD6FE", "#EDE9FE"];

const TLAnalytics = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const isBDO = user?.role === "bdo" || user?.role === "business_development_officer" || user?.role === "Business Development And Marketing Manager";

  const [campaigns, setCampaigns] = useState<{ id: string; name: string; data_mode?: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [dataMode, setDataMode] = useState<string>("all");
  const [ratios, setRatios] = useState({ receive: 0, cancel: 0, return: 0 });
  const [agentPerf, setAgentPerf] = useState<{ name: string; confirmed: number; delivered: number; ratio: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      if (isBDO) {
        const { data } = await supabase.from("campaigns").select("id, name").order("created_at", { ascending: false });
        if (data) {
          const list = data.map((c: any) => ({ id: c.id, name: c.name }));
          setCampaigns(list);
          if (list.length > 0 && !selectedCampaign) setSelectedCampaign(list[0].id);
        }
      } else {
        const { data } = await supabase.from("campaign_tls").select("campaign_id, campaigns(id, name)").eq("tl_id", user.id);
        if (data) {
          const list = data.map((d: any) => d.campaigns).filter(Boolean);
          setCampaigns(list);
          if (list.length > 0 && !selectedCampaign) setSelectedCampaign(list[0].id);
        }
      }
    };
    fetch();
  }, [user]);

  const loadAnalytics = useCallback(async () => {
    if (!user || !selectedCampaign) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    let ordersQ = supabase
      .from("orders")
      .select("id, agent_id, delivery_status, status")
      .gte("created_at", startOfMonth.toISOString());
    if (!isBDO) ordersQ = ordersQ.eq("tl_id", user.id);
    const { data: orders } = await ordersQ;

    const allOrders = orders || [];
    const total = allOrders.length;
    const delivered = allOrders.filter(o => o.delivery_status === "delivered").length;
    const cancelled = allOrders.filter(o => o.delivery_status === "cancelled").length;
    const returned = allOrders.filter(o => o.delivery_status === "returned").length;

    setRatios({
      receive: total > 0 ? Math.round((delivered / total) * 100) : 0,
      cancel: total > 0 ? Math.round((cancelled / total) * 100) : 0,
      return: total > 0 ? Math.round((returned / total) * 100) : 0,
    });

    // Agent performance
    let rolesQ = supabase
      .from("campaign_agent_roles")
      .select("agent_id, users!campaign_agent_roles_agent_id_fkey(name)")
      .eq("campaign_id", selectedCampaign);
    if (!isBDO) rolesQ = rolesQ.eq("tl_id", user.id);
    const { data: roles } = await rolesQ;

    if (roles) {
      const perf = roles.map((r: any) => {
        const agentOrders = allOrders.filter(o => o.agent_id === r.agent_id);
        const agentDelivered = agentOrders.filter(o => o.delivery_status === "delivered").length;
        return {
          name: r.users.name,
          confirmed: agentOrders.length,
          delivered: agentDelivered,
          ratio: agentOrders.length > 0 ? Math.round((agentDelivered / agentOrders.length) * 100) : 0,
        };
      }).sort((a, b) => b.ratio - a.ratio);
      setAgentPerf(perf);
    }
  }, [user, selectedCampaign]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  if (!user) return null;

  const ratioData = [
    { name: isBn ? "Receive" : "Receive", value: ratios.receive },
    { name: isBn ? "Cancel" : "Cancel", value: ratios.cancel },
    { name: isBn ? "Return" : "Return", value: ratios.return },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "অ্যানালিটিক্স" : "Analytics"}
        </h2>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-64 border-[hsl(var(--panel-tl))] bg-secondary">
            <SelectValue placeholder={isBn ? "Campaign নির্বাচন করুন" : "Select Campaign"} />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Campaign Ratios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Receive Ratio", value: `${ratios.receive}%`, color: "text-green-400" },
          { label: "Cancel Ratio", value: `${ratios.cancel}%`, color: "text-yellow-400" },
          { label: "Return Ratio", value: `${ratios.return}%`, color: "text-red-400" },
        ].map((r) => (
          <Card key={r.label} className="bg-card border-border">
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground font-body">{r.label}</p>
              <p className={`text-3xl font-bold font-heading mt-2 ${r.color}`}>{r.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-lg font-heading">{isBn ? "Agent Performance" : "Agent Performance"}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
                <XAxis dataKey="name" tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(0 0% 60%)" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 20%)", color: "hsl(0 0% 96%)" }} />
                <Bar dataKey="confirmed" fill="#7C3AED" name={isBn ? "Confirmed" : "Confirmed"} />
                <Bar dataKey="delivered" fill="#A78BFA" name={isBn ? "Delivered" : "Delivered"} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-lg font-heading">{isBn ? "Ratio Overview" : "Ratio Overview"}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={ratioData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                  {ratioData.map((_, i) => <Cell key={i} fill={["#22C55E", "#EAB308", "#EF4444"][i]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 20%)", color: "hsl(0 0% 96%)" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-lg font-heading">{isBn ? "Agent Performance Table" : "Agent Performance Table"}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                <TableHead className="text-center">Confirmed</TableHead>
                <TableHead className="text-center">Delivered</TableHead>
                <TableHead className="text-center">Receive Ratio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentPerf.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{isBn ? "কোনো ডেটা নেই" : "No data"}</TableCell></TableRow>
              ) : agentPerf.map((a, i) => (
                <TableRow key={a.name}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-center">{a.confirmed}</TableCell>
                  <TableCell className="text-center">{a.delivered}</TableCell>
                  <TableCell className="text-center font-bold">{a.ratio}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TLAnalytics;
