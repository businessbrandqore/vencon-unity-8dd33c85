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
import { Search, Users, Target, CheckCircle, TrendingUp, RefreshCw, Filter, Shield, UserCheck } from "lucide-react";

interface TeamMember {
  id: string;
  oderId: string;
  userId: string;
  name: string;
  role: string;
  panel: string;
  designation: string | null;
  phone: string | null;
  email: string;
  basicSalary: number | null;
  isActive: boolean;
  memberType: "bdo" | "tl" | "agent" | "employee";
  isBronze: boolean;
  isSilver: boolean;
  todayLeads: number;
  todayConfirmed: number;
  todayReceiveRatio: number;
  monthlyConfirmed: number;
  monthlyDelivered: number;
  monthlyRatio: number;
  joinDate: string | null;
}

type MemberFilter = "all" | "tl" | "employee" | "bronze" | "silver" | "active" | "inactive";
type SortField = "name" | "todayLeads" | "todayConfirmed" | "todayReceiveRatio" | "monthlyRatio";
type ViewMode = "campaign" | "all_members";

const TLTeam = () => {
  const { user } = useAuth();
  const { t, roleName } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const isBDO = user?.role === "bdo" || user?.role === "business_development_officer" || user?.role === "Business Development And Marketing Manager";

  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(isBDO ? "all_members" : "campaign");

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");
  const [panelFilter, setPanelFilter] = useState<string>("all");
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

  // BDO: Load ALL users from the database
  const loadAllMembers = useCallback(async () => {
    if (!user || !isBDO) return;
    setLoading(true);

    const { data: allUsers } = await supabase
      .from("users")
      .select("id, name, role, panel, designation, phone, email, basic_salary, is_active, created_at")
      .eq("is_active", true)
      .order("panel")
      .order("name");

    if (!allUsers) { setLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const allMembers: TeamMember[] = [];

    for (const u of allUsers as any[]) {
      // Skip the BDO's own record
      if (u.id === user.id) continue;

      // Determine member type
      let memberType: TeamMember["memberType"] = "employee";
      if (u.panel === "tl") memberType = "tl";
      else if (u.panel === "sa" || u.panel === "hr") memberType = "employee"; // show as employee type for display

      // Get performance stats for sales-related roles
      const isSalesRole = ["telesales_executive", "assistant_team_leader"].includes(u.role);
      const isTL = u.panel === "tl";

      let todayLeads = 0, todayConfirmed = 0, todayRatio = 0;
      let monthlyConfirmed = 0, monthlyDelivered = 0, mRatio = 0;

      if (isSalesRole) {
        const [r1, r2, r3, r4, r5] = await Promise.all([
          supabase.from("leads").select("*", { count: "exact", head: true }).eq("assigned_to", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).gte("created_at", startOfMonth.toISOString()),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfMonth.toISOString()),
        ]);
        todayLeads = r1.count || 0;
        todayConfirmed = r2.count || 0;
        const todayDel = r3.count || 0;
        todayRatio = todayConfirmed > 0 ? Math.round((todayDel / todayConfirmed) * 100) : 0;
        monthlyConfirmed = r4.count || 0;
        monthlyDelivered = r5.count || 0;
        mRatio = monthlyConfirmed > 0 ? Math.round((monthlyDelivered / monthlyConfirmed) * 100) : 0;
      } else if (isTL) {
        const [r1, r2, r3, r4, r5] = await Promise.all([
          supabase.from("leads").select("*", { count: "exact", head: true }).eq("tl_id", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).gte("created_at", startOfMonth.toISOString()),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfMonth.toISOString()),
        ]);
        todayLeads = r1.count || 0;
        todayConfirmed = r2.count || 0;
        const todayDel = r3.count || 0;
        todayRatio = todayConfirmed > 0 ? Math.round((todayDel / todayConfirmed) * 100) : 0;
        monthlyConfirmed = r4.count || 0;
        monthlyDelivered = r5.count || 0;
        mRatio = monthlyConfirmed > 0 ? Math.round((monthlyDelivered / monthlyConfirmed) * 100) : 0;
      }

      allMembers.push({
        id: u.id,
        oderId: "",
        userId: u.id,
        name: u.name,
        role: u.role,
        panel: u.panel,
        designation: u.designation,
        phone: u.phone,
        email: u.email,
        basicSalary: u.basic_salary,
        isActive: u.is_active !== false,
        memberType,
        isBronze: false,
        isSilver: false,
        todayLeads,
        todayConfirmed,
        todayReceiveRatio: todayRatio,
        monthlyConfirmed,
        monthlyDelivered,
        monthlyRatio: mRatio,
        joinDate: u.created_at,
      });
    }

    setMembers(allMembers);
    setLoading(false);
  }, [user, isBDO]);

  // Campaign-specific load (for TL or BDO campaign view)
  const loadCampaignTeam = useCallback(async () => {
    if (!user || !selectedCampaign) return;
    setLoading(true);

    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const allMembers: TeamMember[] = [];

    // 1. TLs for this campaign
    let tlQuery = supabase
      .from("campaign_tls")
      .select("tl_id, users!campaign_tls_tl_id_fkey(id, name, role, panel, designation, phone, email, basic_salary, is_active, created_at)")
      .eq("campaign_id", selectedCampaign);
    if (!isBDO) tlQuery = tlQuery.eq("tl_id", user.id);
    const { data: tlData } = await tlQuery;

    if (tlData) {
      for (const tl of tlData as any[]) {
        const u = tl.users;
        if (!u) continue;
        const [r1, r2, r3, r4, r5] = await Promise.all([
          supabase.from("leads").select("*", { count: "exact", head: true }).eq("tl_id", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).gte("created_at", startOfMonth.toISOString()),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("tl_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfMonth.toISOString()),
        ]);
        const tRatio = (r2.count || 0) > 0 ? Math.round(((r3.count || 0) / (r2.count || 1)) * 100) : 0;
        const mRatio = (r4.count || 0) > 0 ? Math.round(((r5.count || 0) / (r4.count || 1)) * 100) : 0;
        allMembers.push({
          id: `tl-${u.id}`, oderId: "", userId: u.id, name: u.name, role: u.role, panel: u.panel,
          designation: u.designation, phone: u.phone, email: u.email, basicSalary: u.basic_salary,
          isActive: u.is_active !== false, memberType: "tl", isBronze: false, isSilver: false,
          todayLeads: r1.count || 0, todayConfirmed: r2.count || 0, todayReceiveRatio: tRatio,
          monthlyConfirmed: r4.count || 0, monthlyDelivered: r5.count || 0, monthlyRatio: mRatio,
          joinDate: u.created_at,
        });
      }
    }

    // 2. Agents for this campaign
    let rolesQ = supabase
      .from("campaign_agent_roles")
      .select("id, agent_id, is_bronze, is_silver, tl_id, users!campaign_agent_roles_agent_id_fkey(id, name, role, panel, designation, phone, email, basic_salary, is_active, created_at)")
      .eq("campaign_id", selectedCampaign);
    if (!isBDO) rolesQ = rolesQ.eq("tl_id", user.id);
    const { data: roles } = await rolesQ;

    if (roles) {
      for (const r of roles as any[]) {
        const u = r.users;
        if (!u) continue;
        const [r1, r2, r3, r4, r5] = await Promise.all([
          supabase.from("leads").select("*", { count: "exact", head: true }).eq("assigned_to", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfDay),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).gte("created_at", startOfMonth.toISOString()),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("agent_id", u.id).eq("delivery_status", "delivered").gte("created_at", startOfMonth.toISOString()),
        ]);
        const tRatio = (r2.count || 0) > 0 ? Math.round(((r3.count || 0) / (r2.count || 1)) * 100) : 0;
        const mRatio = (r4.count || 0) > 0 ? Math.round(((r5.count || 0) / (r4.count || 1)) * 100) : 0;
        allMembers.push({
          id: r.id, oderId: r.id, userId: u.id, name: u.name, role: u.role, panel: u.panel,
          designation: u.designation, phone: u.phone, email: u.email, basicSalary: u.basic_salary,
          isActive: u.is_active !== false, memberType: "agent", isBronze: r.is_bronze, isSilver: r.is_silver,
          todayLeads: r1.count || 0, todayConfirmed: r2.count || 0, todayReceiveRatio: tRatio,
          monthlyConfirmed: r4.count || 0, monthlyDelivered: r5.count || 0, monthlyRatio: mRatio,
          joinDate: u.created_at,
        });
      }
    }

    setMembers(allMembers);
    setLoading(false);
  }, [user, selectedCampaign]);

  useEffect(() => {
    if (viewMode === "all_members" && isBDO) loadAllMembers();
    else if (viewMode === "campaign") loadCampaignTeam();
  }, [viewMode, loadAllMembers, loadCampaignTeam]);

  const handleRefresh = () => {
    if (viewMode === "all_members" && isBDO) loadAllMembers();
    else loadCampaignTeam();
  };

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

    if (memberFilter === "tl") result = result.filter((m) => m.memberType === "tl" || m.panel === "tl");
    else if (memberFilter === "employee") result = result.filter((m) => m.panel === "employee");
    else if (memberFilter === "bronze") result = result.filter((m) => m.isBronze);
    else if (memberFilter === "silver") result = result.filter((m) => m.isSilver);
    else if (memberFilter === "active") result = result.filter((m) => m.isActive);
    else if (memberFilter === "inactive") result = result.filter((m) => !m.isActive);

    if (panelFilter !== "all") {
      result = result.filter((m) => m.panel === panelFilter);
    }

    result.sort((a, b) => {
      if (a.memberType !== b.memberType) {
        const order = { bdo: 0, tl: 1, agent: 2, employee: 3 };
        return order[a.memberType] - order[b.memberType];
      }
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else cmp = (a[sortField] as number) - (b[sortField] as number);
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [members, searchQuery, memberFilter, panelFilter, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(field === "name"); }
  };

  // Stats
  const tlCount = members.filter((m) => m.panel === "tl").length;
  const empCount = members.filter((m) => m.panel === "employee").length;
  const activeCount = members.filter((m) => m.isActive).length;
  const avgRatio = (() => {
    const withRatio = members.filter((m) => m.monthlyConfirmed > 0);
    return withRatio.length > 0 ? Math.round(withRatio.reduce((s, m) => s + m.monthlyRatio, 0) / withRatio.length) : 0;
  })();

  if (!user) return null;

  const getPanelBadge = (panel: string) => {
    const colors: Record<string, string> = {
      sa: "bg-emerald-600 text-white",
      hr: "bg-blue-600 text-white",
      tl: "bg-primary text-primary-foreground",
      employee: "bg-orange-600 text-white",
    };
    return colors[panel] || "bg-secondary text-foreground";
  };

  const renderMemberRow = (m: TeamMember) => (
    <TableRow key={m.id} className={m.panel === "tl" ? "bg-primary/5" : ""}>
      <TableCell>
        <div className="flex items-center gap-2">
          {m.panel === "tl" ? (
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
        <Badge className={`text-[10px] ${getPanelBadge(m.panel)}`}>
          {m.panel.toUpperCase()}
        </Badge>
      </TableCell>
      {viewMode === "campaign" && (
        <>
          <TableCell className="text-center">
            {m.memberType === "agent" ? (
              <div className="flex items-center justify-center gap-1">
                {m.isBronze && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500">B</Badge>}
                {m.isSilver && <Badge variant="outline" className="text-[10px] border-muted-foreground/40 text-muted-foreground">S</Badge>}
                {!m.isBronze && !m.isSilver && <span className="text-muted-foreground text-xs">—</span>}
              </div>
            ) : <span className="text-muted-foreground text-xs">—</span>}
          </TableCell>
          <TableCell className="text-center">
            {m.memberType === "agent" ? <Switch checked={m.isBronze} onCheckedChange={(v) => toggleRole(m.oderId, "is_bronze", v)} disabled={isBDO} /> : null}
          </TableCell>
          <TableCell className="text-center">
            {m.memberType === "agent" ? <Switch checked={m.isSilver} onCheckedChange={(v) => toggleRole(m.oderId, "is_silver", v)} disabled={isBDO} /> : null}
          </TableCell>
        </>
      )}
      {viewMode === "all_members" && (
        <>
          <TableCell className="text-center text-sm text-muted-foreground">{m.phone || "—"}</TableCell>
          <TableCell className="text-center font-mono text-sm">
            {m.basicSalary ? `৳${m.basicSalary.toLocaleString()}` : "—"}
          </TableCell>
        </>
      )}
      <TableCell className="text-center font-mono">{m.todayLeads}</TableCell>
      <TableCell className="text-center font-mono">{m.todayConfirmed}</TableCell>
      <TableCell className="text-center">
        {m.monthlyConfirmed > 0 ? (
          <Badge variant={m.monthlyRatio >= 60 ? "default" : m.monthlyRatio >= 30 ? "secondary" : "destructive"} className="font-mono text-xs">
            {m.monthlyRatio}%
          </Badge>
        ) : <span className="text-muted-foreground text-xs">—</span>}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={m.isActive ? "default" : "destructive"} className="text-[10px]">
          {m.isActive ? (isBn ? "সক্রিয়" : "Active") : (isBn ? "নিষ্ক্রিয়" : "Inactive")}
        </Badge>
      </TableCell>
      {viewMode === "all_members" && (
        <TableCell className="text-center text-xs text-muted-foreground">
          {m.joinDate ? new Date(m.joinDate).toLocaleDateString() : "—"}
        </TableCell>
      )}
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
          {/* BDO: Toggle between all members and campaign view */}
          {isBDO && (
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("all_members")}
                className={`px-3 py-1.5 text-xs font-body transition-colors ${viewMode === "all_members" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                {isBn ? "সব মেম্বার" : "All Members"}
              </button>
              <button
                onClick={() => setViewMode("campaign")}
                className={`px-3 py-1.5 text-xs font-body transition-colors ${viewMode === "campaign" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                {isBn ? "ক্যাম্পেইন ভিত্তিক" : "By Campaign"}
              </button>
            </div>
          )}
          {viewMode === "campaign" && (
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-56 border-primary/30 bg-secondary">
                <SelectValue placeholder={isBn ? "Campaign নির্বাচন করুন" : "Select Campaign"} />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: isBn ? "মোট মেম্বার" : "Total Members", value: members.length, icon: Users, color: "text-primary" },
          ...(viewMode === "all_members" ? [
            { label: isBn ? "টিম লিডার" : "Team Leaders", value: tlCount, icon: Shield, color: "text-foreground" },
            { label: isBn ? "কর্মী" : "Employees", value: empCount, icon: UserCheck, color: "text-muted-foreground" },
          ] : [
            { label: isBn ? "টিম লিডার" : "Team Leaders", value: tlCount, icon: Shield, color: "text-foreground" },
            { label: isBn ? "এজেন্ট" : "Agents", value: members.filter(m => m.memberType === "agent").length, icon: Target, color: "text-muted-foreground" },
          ]),
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
              {viewMode === "all_members" && (
                <Select value={panelFilter} onValueChange={setPanelFilter}>
                  <SelectTrigger className="w-32 bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isBn ? "সব প্যানেল" : "All Panels"}</SelectItem>
                    <SelectItem value="tl">TL</SelectItem>
                    <SelectItem value="employee">{isBn ? "কর্মী" : "Employee"}</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="sa">SA</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={memberFilter} onValueChange={(v) => setMemberFilter(v as MemberFilter)}>
                <SelectTrigger className="w-40 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isBn ? "সব মেম্বার" : "All Members"}</SelectItem>
                  <SelectItem value="tl">{isBn ? "শুধু TL" : "TL Only"}</SelectItem>
                  <SelectItem value="employee">{isBn ? "শুধু কর্মী" : "Employees Only"}</SelectItem>
                  {viewMode === "campaign" && (
                    <>
                      <SelectItem value="bronze">{isBn ? "শুধু Bronze" : "Bronze Only"}</SelectItem>
                      <SelectItem value="silver">{isBn ? "শুধু Silver" : "Silver Only"}</SelectItem>
                    </>
                  )}
                  <SelectItem value="active">{isBn ? "সক্রিয়" : "Active"}</SelectItem>
                  <SelectItem value="inactive">{isBn ? "নিষ্ক্রিয়" : "Inactive"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(searchQuery || memberFilter !== "all" || panelFilter !== "all") && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground font-body">
                {isBn ? `${filteredMembers.length}টি ফলাফল` : `${filteredMembers.length} results`}
              </span>
              {searchQuery && (
                <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setSearchQuery("")}>
                  "{searchQuery}" ✕
                </Badge>
              )}
              {panelFilter !== "all" && (
                <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setPanelFilter("all")}>
                  {panelFilter.toUpperCase()} ✕
                </Badge>
              )}
              {memberFilter !== "all" && (
                <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setMemberFilter("all")}>
                  {memberFilter} ✕
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
            {viewMode === "all_members" ? (isBn ? "সকল মেম্বার" : "All Members") : (isBn ? "ক্যাম্পেইন টিম" : "Campaign Team")}
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
                    <TableHead className="text-center">{isBn ? "প্যানেল" : "Panel"}</TableHead>
                    {viewMode === "campaign" && (
                      <>
                        <TableHead className="text-center">{isBn ? "ক্যাম্পেইন রোল" : "Campaign Role"}</TableHead>
                        <TableHead className="text-center">Bronze</TableHead>
                        <TableHead className="text-center">Silver</TableHead>
                      </>
                    )}
                    {viewMode === "all_members" && (
                      <>
                        <TableHead className="text-center">{isBn ? "ফোন" : "Phone"}</TableHead>
                        <TableHead className="text-center">{isBn ? "বেতন" : "Salary"}</TableHead>
                      </>
                    )}
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("todayLeads")}>
                      {isBn ? "আজকের Leads" : "Today Leads"} {sortField === "todayLeads" && (sortAsc ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("todayConfirmed")}>
                      {isBn ? "আজকের Orders" : "Today Orders"} {sortField === "todayConfirmed" && (sortAsc ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("monthlyRatio")}>
                      {isBn ? "মাসিক Ratio" : "Monthly Ratio"} {sortField === "monthlyRatio" && (sortAsc ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-center">{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                    {viewMode === "all_members" && (
                      <TableHead className="text-center">{isBn ? "যোগদান" : "Joined"}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
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
