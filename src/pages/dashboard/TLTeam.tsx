import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface AgentRow {
  id: string; // campaign_agent_roles id
  agentId: string;
  agentName: string;
  isBronze: boolean;
  isSilver: boolean;
  todayLeads: number;
  todayConfirmed: number;
  todayReceiveRatio: number;
}

const TLTeam = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [agents, setAgents] = useState<AgentRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase.from("campaign_tls").select("campaign_id, campaigns(id, name)").eq("tl_id", user.id);
      if (data) {
        const list = data.map((d: any) => d.campaigns).filter(Boolean);
        setCampaigns(list);
        if (list.length > 0 && !selectedCampaign) setSelectedCampaign(list[0].id);
      }
    };
    fetch();
  }, [user]);

  const loadTeam = useCallback(async () => {
    if (!user || !selectedCampaign) return;

    const { data: roles } = await supabase
      .from("campaign_agent_roles")
      .select("id, agent_id, is_bronze, is_silver, users!campaign_agent_roles_agent_id_fkey(id, name)")
      .eq("campaign_id", selectedCampaign)
      .eq("tl_id", user.id);

    if (!roles) return;

    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;

    const agentRows: AgentRow[] = [];
    for (const r of roles as any[]) {
      const agentId = r.users.id;

      const { count: todayLeads } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", agentId)
        .gte("created_at", startOfDay);

      const { count: todayConfirmed } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .gte("created_at", startOfDay);

      const { count: todayDelivered } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", agentId)
        .eq("delivery_status", "delivered")
        .gte("created_at", startOfDay);

      const ratio = todayConfirmed && todayConfirmed > 0
        ? Math.round(((todayDelivered || 0) / todayConfirmed) * 100)
        : 0;

      agentRows.push({
        id: r.id,
        agentId,
        agentName: r.users.name,
        isBronze: r.is_bronze,
        isSilver: r.is_silver,
        todayLeads: todayLeads || 0,
        todayConfirmed: todayConfirmed || 0,
        todayReceiveRatio: ratio,
      });
    }
    setAgents(agentRows);
  }, [user, selectedCampaign]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const toggleRole = async (roleId: string, field: "is_bronze" | "is_silver", value: boolean) => {
    await supabase.from("campaign_agent_roles").update({ [field]: value }).eq("id", roleId);
    setAgents((prev) => prev.map((a) => a.id === roleId ? { ...a, [field === "is_bronze" ? "isBronze" : "isSilver"]: value } : a));
    toast.success(isBn ? "আপডেট হয়েছে" : "Updated");
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "টিম ম্যানেজমেন্ট" : "Team Management"}
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

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-heading">{isBn ? "Telesales Executives" : "Telesales Executives"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                <TableHead className="text-center">Bronze</TableHead>
                <TableHead className="text-center">Silver</TableHead>
                <TableHead className="text-center">{isBn ? "আজকের Leads" : "Today's Leads"}</TableHead>
                <TableHead className="text-center">{isBn ? "আজকের Confirmed" : "Today's Confirmed"}</TableHead>
                <TableHead className="text-center">{isBn ? "আজকের Receive Ratio" : "Today's Receive Ratio"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{isBn ? "কোনো agent নেই" : "No agents"}</TableCell></TableRow>
              ) : agents.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.agentName}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={a.isBronze} onCheckedChange={(v) => toggleRole(a.id, "is_bronze", v)} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={a.isSilver} onCheckedChange={(v) => toggleRole(a.id, "is_silver", v)} />
                  </TableCell>
                  <TableCell className="text-center">{a.todayLeads}</TableCell>
                  <TableCell className="text-center">{a.todayConfirmed}</TableCell>
                  <TableCell className="text-center">{a.todayReceiveRatio}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TLTeam;
