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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Users, Target, CheckCircle, TrendingUp, RefreshCw, Filter, Shield, UserCheck } from "lucide-react";

interface TeamMember {
  id: string; // user id or campaign_agent_roles id for agents
  oderId: string; // original db row id for toggles
  userId: string;
  name: string;
  role: string;
  designation: string | null;
  phone: string | null;
  email: string;
  isActive: boolean;
  memberType: "tl" | "agent";
  isBronze: boolean;
  isSilver: boolean;
  todayLeads: number;
  todayConfirmed: number;
  todayReceiveRatio: number;
  monthlyConfirmed: number;
  monthlyDelivered: number;
  monthlyRatio: number;
}

type MemberFilter = "all" | "tl" | "bronze" | "silver" | "both" | "no_role";
type SortField = "name" | "todayLeads" | "todayConfirmed" | "todayReceiveRatio" | "monthlyRatio";

const TLTeam = () => {
  const { user } = useAuth();
  const { t, roleName } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const isBDO = user?.role === "bdo" || user?.role === "business_development_officer" || user?.role === "Business Development And Marketing Manager";

  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchCampaigns = async () => {
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
    fetchCampaigns();
  }, [user]);

  const loadTeam = useCallback(async () => {
    if (!user || !selectedCampaign) return;
    setLoading(true);

    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const allMembers: TeamMember[] = [];

    // 1. Fetch Team Leaders for this campaign
    let tlQuery = supabase
      .from("campaign_tls")
      .select("tl_id, users!campaign_tls_tl_id_fkey(id, name, role, designation, phone, email, is_active)")
      .eq("campaign_id", selectedCampaign);
    if (!isBDO) tlQuery = tlQuery.eq("tl_id", user.id);
    const { data: tlData } = await tlQuery;

    if (tlData) {
      for (const tl of tlData as any[]) {
        const u = tl.users;
        if (!u) continue;

        const [
          { count: todayLeads },
          { count: todayConfirmed },
          { count: todayDelivered },
          { count: monthlyConfirmed },
          { count: monthlyDelivered },
        ] = await Promise.all([
          supabase.from("leads").select("*", { count: "exact", head: true }).eq("tl_id", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).gte("created_at", startOfMonth.toISOString()),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfMonth.toISOString()),
        ]);

        const tRatio = todayConfirmed && todayConfirmed > 0 ? Math.round(((todayDelivered || 0) / todayConfirmed) * 100) : 0;
        const mRatio = monthlyConfirmed && monthlyConfirmed > 0 ? Math.round(((monthlyDelivered || 0) / monthlyConfirmed) * 100) : 0;

        allMembers.push({
          id: `tl-${u.id}`,
          oderId: "",
          userId: u.id,
          name: u.name,
          role: u.role,
          designation: u.designation,
          phone: u.phone,
          email: u.email,
          isActive: u.is_active !== false,
          memberType: "tl",
          isBronze: false,
          isSilver: false,
          todayLeads: todayLeads || 0,
          todayConfirmed: todayConfirmed || 0,
          todayReceiveRatio: tRatio,
          monthlyConfirmed: monthlyConfirmed || 0,
          monthlyDelivered: monthlyDelivered || 0,
          monthlyRatio: mRatio,
        });
      }
    }

    // 2. Fetch Agents for this campaign
    let rolesQ = supabase
      .from("campaign_agent_roles")
      .select("id, agent_id, is_bronze, is_silver, tl_id, users!campaign_agent_roles_agent_id_fkey(id, name, role, designation, phone, email, is_active)")
      .eq("campaign_id", selectedCampaign);
    if (!isBDO) rolesQ = rolesQ.eq("tl_id", user.id);
    const { data: roles } = await rolesQ;

    if (roles) {
      for (const r of roles as any[]) {
        const u = r.users;
        if (!u) continue;

        const [
          { count: todayLeads },
          { count: todayConfirmed },
          { count: todayDelivered },
          { count: monthlyConfirmed },
          { count: monthlyDelivered },
        ] = await Promise.all([
          supabase.from("leads").select("*", { count: "exact", head: true }).eq("assigned_to", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).gte("created_at", startOfMonth.toISOString()),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfMonth.toISOString()),
        ]);

        const tRatio = todayConfirmed && todayConfirmed > 0 ? Math.round(((todayDelivered || 0) / todayConfirmed) * 100) : 0;
        const mRatio = monthlyConfirmed && monthlyConfirmed > 0 ? Math.round(((monthlyDelivered || 0) / monthlyConfirmed) * 100) : 0;

        allMembers.push({
          id: r.id,
          oderId: r.id,
          userId: u.id,
          name: u.name,
          role: u.role,
          designation: u.designation,
          phone: u.phone,
          email: u.email,
          isActive: u.is_active !== false,
          memberType: "agent",
          isBronze: r.is_bronze,
          isSilver: r.is_silver,
          todayLeads: todayLeads || 0,
          todayConfirmed: todayConfirmed || 0,
          todayReceiveRatio: tRatio,
          monthlyConfirmed: monthlyConfirmed || 0,
          monthlyDelivered: monthlyDelivered || 0,
          monthlyRatio: mRatio,
        });
      }
    }

    setMembers(allMembers);
    setLoading(false);
  }, [user, selectedCampaign]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const toggleRole = async (roleId: string, field: "is_bronze" | "is_silver", value: boolean) => {
    await supabase.from("campaign_agent_roles").update({ [field]: value }).eq("id", roleId);
    setMembers((prev) => prev.map((a) => a.oderId === roleId ? { ...a, [field === "is_bronze" ? "isBronze" : "isSilver"]: value } : a));
    toast.success(isBn ? "আপডেট হয়েছে" : "Updated");
  };

  // Filtered & sorted
  const filteredMembers = useMemo(() => {
    let result = [...members];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        (m.phone && m.phone.includes(q)) ||
        m.email.toLowerCase().includes(q)
      );
    }

    if (memberFilter === "tl") result = result.filter((m) => m.memberType === "tl");
    else if (memberFilter === "bronze") result = result.filter((m) => m.isBronze);
    else if (memberFilter === "silver") result = result.filter((m) => m.isSilver);
    else if (memberFilter === "both") result = result.filter((m) => m.isBronze && m.isSilver);
    else if (memberFilter === "no_role") result = result.filter((m) => m.memberType === "agent" && !m.isBronze && !m.isSilver);

    result.sort((a, b) => {
      // TLs always on top
      if (a.memberType !== b.memberType) return a.memberType === "tl" ? -1 : 1;
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else cmp = (a[sortField] as number) - (b[sortField] as number);
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [members, searchQuery, memberFilter, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(field === "name"); }
  };

  // Stats
  const tlCount = members.filter((m) => m.memberType === "tl").length;
  const agentCount = members.filter((m) => m.memberType === "agent").length;
  const bronzeCount = members.filter((m) => m.isBronze).length;
  const silverCount = members.filter((m) => m.isSilver).length;
  const avgRatio = members.length > 0 ? Math.round(members.reduce((s, m) => s + m.monthlyRatio, 0) / members.length) : 0;

  if (!user) return null;

  const renderMemberRow = (m: TeamMember) => (
    <TableRow key={m.id} className={m.memberType === "tl" ? "bg-primary/5" : ""}>
      <TableCell>
        <div className="flex items-center gap-2">
          {m.memberType === "tl" ? (
            <Shield className="h-4 w-4 text-primary flex-shrink-0" />
          ) : (
            <UserCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <div>
            <p className="font-medium text-foreground">{m.name}</p>
            <p className="text-[11px] text-muted-foreground">{roleName(m.role)}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={m.memberType === "tl" ? "default" : "secondary"} className="text-[10px]">
          {m.memberType === "tl" ? (isBn ? "টিম লিডার" : "TL") : (isBn ? "এজেন্ট" : "Agent")}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        {m.memberType === "agent" ? (
          <div className="flex items-center justify-center gap-1">
            {m.isBronze && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500">B</Badge>}
            {m.isSilver && <Badge variant="outline" className="text-[10px] border-muted-foreground/40 text-muted-foreground">S</Badge>}
            {!m.isBronze && !m.isSilver && <span className="text-muted-foreground text-xs">—</span>}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        {m.memberType === "agent" ? (
          <Switch checked={m.isBronze} onCheckedChange={(v) => toggleRole(m.oderId, "is_bronze", v)} disabled={isBDO} />
        ) : null}
      </TableCell>
      <TableCell className="text-center">
        {m.memberType === "agent" ? (
          <Switch checked={m.isSilver} onCheckedChange={(v) => toggleRole(m.oderId, "is_silver", v)} disabled={isBDO} />
        ) : null}
      </TableCell>
      <TableCell className="text-center font-mono">{m.todayLeads}</TableCell>
      <TableCell className="text-center font-mono">{m.todayConfirmed}</TableCell>
      <TableCell className="text-center">
        <Badge variant={m.todayReceiveRatio >= 60 ? "default" : m.todayReceiveRatio >= 30 ? "secondary" : "destructive"} className="font-mono text-xs">
          {m.todayReceiveRatio}%
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={m.monthlyRatio >= 60 ? "default" : m.monthlyRatio >= 30 ? "secondary" : "destructive"} className="font-mono text-xs">
          {m.monthlyRatio}%
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={m.isActive ? "default" : "destructive"} className="text-[10px]">
          {m.isActive ? (isBn ? "সক্রিয়" : "Active") : (isBn ? "নিষ্ক্রিয়" : "Inactive")}
        </Badge>
      </TableCell>
    </TableRow>
  );

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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: isBn ? "টিম লিডার" : "Team Leaders", value: tlCount, icon: Shield, color: "text-primary" },
          { label: isBn ? "মোট এজেন্ট" : "Total Agents", value: agentCount, icon: Users, color: "text-foreground" },
          { label: isBn ? "Bronze Agent" : "Bronze Agents", value: bronzeCount, icon: Target, color: "text-amber-500" },
          { label: isBn ? "Silver Agent" : "Silver Agents", value: silverCount, icon: CheckCircle, color: "text-muted-foreground" },
          { label: isBn ? "গড় Ratio" : "Avg Ratio", value: `${avgRatio}%`, icon: TrendingUp, color: "text-emerald-500" },
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

      {/* Search & Filter */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isBn ? "নাম, রোল, ফোন বা ইমেইল দিয়ে খুঁজুন..." : "Search by name, role, phone or email..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={memberFilter} onValueChange={(v) => setMemberFilter(v as MemberFilter)}>
                <SelectTrigger className="w-44 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isBn ? "সব মেম্বার" : "All Members"}</SelectItem>
                  <SelectItem value="tl">{isBn ? "শুধু টিম লিডার" : "Team Leaders Only"}</SelectItem>
                  <SelectItem value="bronze">{isBn ? "শুধু Bronze" : "Bronze Only"}</SelectItem>
                  <SelectItem value="silver">{isBn ? "শুধু Silver" : "Silver Only"}</SelectItem>
                  <SelectItem value="both">{isBn ? "Bronze + Silver" : "Both Roles"}</SelectItem>
                  <SelectItem value="no_role">{isBn ? "কোনো রোল নেই" : "No Role"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(searchQuery || memberFilter !== "all") && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground font-body">
                {isBn ? `${filteredMembers.length}টি ফলাফল` : `${filteredMembers.length} results`}
              </span>
              {searchQuery && (
                <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setSearchQuery("")}>
                  "{searchQuery}" ✕
                </Badge>
              )}
              {memberFilter !== "all" && (
                <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setMemberFilter("all")}>
                  {memberFilter === "tl" ? (isBn ? "টিম লিডার" : "TL") : memberFilter} ✕
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
              ({filteredMembers.length}/{members.length})
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
                    <TableHead className="cursor-pointer select-none min-w-[180px]" onClick={() => handleSort("name")}>
                      {isBn ? "নাম / রোল" : "Name / Role"} {sortField === "name" && (sortAsc ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-center">{isBn ? "টাইপ" : "Type"}</TableHead>
                    <TableHead className="text-center">{isBn ? "ক্যাম্পেইন রোল" : "Campaign Role"}</TableHead>
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
                    <TableHead className="text-center">{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {searchQuery
                          ? (isBn ? `"${searchQuery}" এর জন্য কোনো মেম্বার পাওয়া যায়নি` : `No members found for "${searchQuery}"`)
                          : (isBn ? "কোনো মেম্বার নেই" : "No members")}
                      </TableCell>
                    </TableRow>
                  ) : filteredMembers.map(renderMemberRow)}
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
