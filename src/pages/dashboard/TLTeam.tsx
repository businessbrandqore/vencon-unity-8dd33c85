import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Users, Target, CheckCircle, TrendingUp, RefreshCw, Filter } from "lucide-react";

interface AgentRow {
  id: string;
  agentId: string;
  agentName: string;
  isBronze: boolean;
  isSilver: boolean;
  todayLeads: number;
  todayConfirmed: number;
  todayReceiveRatio: number;
  monthlyConfirmed: number;
  monthlyDelivered: number;
  monthlyRatio: number;
}

type RoleFilter = "all" | "bronze" | "silver" | "both" | "none";
type SortField = "name" | "todayLeads" | "todayConfirmed" | "todayReceiveRatio" | "monthlyRatio";

const TLTeam = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const isBDO = user?.role === "bdo" || user?.role === "business_development_officer" || user?.role === "Business Development And Marketing Manager";

  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

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

  const loadTeam = useCallback(async () => {
    if (!user || !selectedCampaign) return;
    setLoading(true);

    let rolesQ = supabase
      .from("campaign_agent_roles")
      .select("id, agent_id, is_bronze, is_silver, users!campaign_agent_roles_agent_id_fkey(id, name)")
      .eq("campaign_id", selectedCampaign);
    if (!isBDO) rolesQ = rolesQ.eq("tl_id", user.id);
    const { data: roles } = await rolesQ;

    if (!roles) { setLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const agentRows: AgentRow[] = [];
    for (const r of roles as any[]) {
      const agentId = r.users.id;

      const [
        { count: todayLeads },
        { count: todayConfirmed },
        { count: todayDelivered },
        { count: monthlyConfirmed },
        { count: monthlyDelivered },
      ] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("assigned_to", agentId).gte("created_at", startOfDay),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", agentId).gte("created_at", startOfDay),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", agentId).eq("delivery_status", "delivered").gte("created_at", startOfDay),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", agentId).gte("created_at", startOfMonth.toISOString()),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", agentId).eq("delivery_status", "delivered").gte("created_at", startOfMonth.toISOString()),
      ]);

      const todayRatio = todayConfirmed && todayConfirmed > 0 ? Math.round(((todayDelivered || 0) / todayConfirmed) * 100) : 0;
      const mRatio = monthlyConfirmed && monthlyConfirmed > 0 ? Math.round(((monthlyDelivered || 0) / monthlyConfirmed) * 100) : 0;

      agentRows.push({
        id: r.id,
        agentId,
        agentName: r.users.name,
        isBronze: r.is_bronze,
        isSilver: r.is_silver,
        todayLeads: todayLeads || 0,
        todayConfirmed: todayConfirmed || 0,
        todayReceiveRatio: todayRatio,
        monthlyConfirmed: monthlyConfirmed || 0,
        monthlyDelivered: monthlyDelivered || 0,
        monthlyRatio: mRatio,
      });
    }
    setAgents(agentRows);
    setLoading(false);
  }, [user, selectedCampaign]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const toggleRole = async (roleId: string, field: "is_bronze" | "is_silver", value: boolean) => {
    await supabase.from("campaign_agent_roles").update({ [field]: value }).eq("id", roleId);
    setAgents((prev) => prev.map((a) => a.id === roleId ? { ...a, [field === "is_bronze" ? "isBronze" : "isSilver"]: value } : a));
    toast.success(isBn ? "আপডেট হয়েছে" : "Updated");
  };

  // Filtered & sorted agents
  const filteredAgents = useMemo(() => {
    let result = [...agents];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.agentName.toLowerCase().includes(q));
    }

    // Role filter
    if (roleFilter === "bronze") result = result.filter((a) => a.isBronze);
    else if (roleFilter === "silver") result = result.filter((a) => a.isSilver);
    else if (roleFilter === "both") result = result.filter((a) => a.isBronze && a.isSilver);
    else if (roleFilter === "none") result = result.filter((a) => !a.isBronze && !a.isSilver);

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.agentName.localeCompare(b.agentName);
      else cmp = (a[sortField] as number) - (b[sortField] as number);
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [agents, searchQuery, roleFilter, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(field === "name"); }
  };

  // Summary stats
  const totalAgents = agents.length;
  const bronzeCount = agents.filter((a) => a.isBronze).length;
  const silverCount = agents.filter((a) => a.isSilver).length;
  const avgRatio = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.monthlyRatio, 0) / agents.length) : 0;

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "টিম ম্যানেজমেন্ট" : "Team Management"}
        </h2>
        <div className="flex items-center gap-3">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-56 border-primary/30 bg-secondary">
              <SelectValue placeholder={isBn ? "Campaign নির্বাচন করুন" : "Select Campaign"} />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadTeam} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: isBn ? "মোট মেম্বার" : "Total Members", value: totalAgents, icon: Users, color: "text-primary" },
          { label: isBn ? "Bronze Agent" : "Bronze Agents", value: bronzeCount, icon: Target, color: "text-amber-500" },
          { label: isBn ? "Silver Agent" : "Silver Agents", value: silverCount, icon: CheckCircle, color: "text-slate-400" },
          { label: isBn ? "গড় Receive Ratio" : "Avg Receive Ratio", value: `${avgRatio}%`, icon: TrendingUp, color: "text-emerald-500" },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-[11px] text-muted-foreground font-body">{s.label}</p>
                <p className="text-xl font-bold font-heading text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isBn ? "নাম দিয়ে খুঁজুন..." : "Search by name..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
                <SelectTrigger className="w-40 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isBn ? "সব মেম্বার" : "All Members"}</SelectItem>
                  <SelectItem value="bronze">{isBn ? "শুধু Bronze" : "Bronze Only"}</SelectItem>
                  <SelectItem value="silver">{isBn ? "শুধু Silver" : "Silver Only"}</SelectItem>
                  <SelectItem value="both">{isBn ? "Bronze + Silver" : "Both Roles"}</SelectItem>
                  <SelectItem value="none">{isBn ? "কোনো রোল নেই" : "No Role"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(searchQuery || roleFilter !== "all") && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground font-body">
                {isBn ? `${filteredAgents.length}টি ফলাফল` : `${filteredAgents.length} results`}
              </span>
              {searchQuery && (
                <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setSearchQuery("")}>
                  "{searchQuery}" ✕
                </Badge>
              )}
              {roleFilter !== "all" && (
                <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setRoleFilter("all")}>
                  {roleFilter} ✕
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-heading">
            {isBn ? "টিম মেম্বার" : "Team Members"}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({filteredAgents.length}/{agents.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-3 text-sm text-muted-foreground font-body">{isBn ? "লোড হচ্ছে..." : "Loading..."}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                      {isBn ? "নাম" : "Name"} {sortField === "name" && (sortAsc ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-center">{isBn ? "রোল" : "Role"}</TableHead>
                    <TableHead className="text-center">Bronze</TableHead>
                    <TableHead className="text-center">Silver</TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("todayLeads")}>
                      {isBn ? "আজকের Leads" : "Today Leads"} {sortField === "todayLeads" && (sortAsc ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("todayConfirmed")}>
                      {isBn ? "আজকের Confirmed" : "Today Confirmed"} {sortField === "todayConfirmed" && (sortAsc ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("todayReceiveRatio")}>
                      {isBn ? "আজকের Ratio" : "Today Ratio"} {sortField === "todayReceiveRatio" && (sortAsc ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("monthlyRatio")}>
                      {isBn ? "মাসিক Ratio" : "Monthly Ratio"} {sortField === "monthlyRatio" && (sortAsc ? "↑" : "↓")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {searchQuery
                          ? (isBn ? `"${searchQuery}" এর জন্য কোনো মেম্বার পাওয়া যায়নি` : `No members found for "${searchQuery}"`)
                          : (isBn ? "কোনো agent নেই" : "No agents")}
                      </TableCell>
                    </TableRow>
                  ) : filteredAgents.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.agentName}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {a.isBronze && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500">B</Badge>}
                          {a.isSilver && <Badge variant="outline" className="text-[10px] border-slate-400/40 text-slate-400">S</Badge>}
                          {!a.isBronze && !a.isSilver && <span className="text-muted-foreground text-xs">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={a.isBronze} onCheckedChange={(v) => toggleRole(a.id, "is_bronze", v)} disabled={isBDO} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={a.isSilver} onCheckedChange={(v) => toggleRole(a.id, "is_silver", v)} disabled={isBDO} />
                      </TableCell>
                      <TableCell className="text-center font-mono">{a.todayLeads}</TableCell>
                      <TableCell className="text-center font-mono">{a.todayConfirmed}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={a.todayReceiveRatio >= 60 ? "default" : a.todayReceiveRatio >= 30 ? "secondary" : "destructive"} className="font-mono text-xs">
                          {a.todayReceiveRatio}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={a.monthlyRatio >= 60 ? "default" : a.monthlyRatio >= 30 ? "secondary" : "destructive"} className="font-mono text-xs">
                          {a.monthlyRatio}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TLTeam;
