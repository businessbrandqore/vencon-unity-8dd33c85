import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Users, RefreshCw, Shield, UserCheck, ChevronRight, Trophy, Star, ArrowLeft, Phone, Mail, Calendar, DollarSign, Crown, Briefcase, CheckCircle, XCircle, Plus, Trash2 } from "lucide-react";

type TimePeriod = "daily" | "monthly" | "yearly";
type ViewLevel = "tl_list" | "gl_list" | "agent_list" | "profile" | "other_employees" | "rankings" | "group_management";

interface PersonStats {
  id: string;
  name: string;
  role: string;
  panel: string;
  phone: string | null;
  email: string;
  designation: string | null;
  basicSalary: number | null;
  joinDate: string | null;
  isActive: boolean;
  todayLeads: number;
  todayOrders: number;
  todayDelivered: number;
  todayRatio: number;
  monthlyLeads: number;
  monthlyOrders: number;
  monthlyDelivered: number;
  monthlyRatio: number;
  yearlyOrders: number;
  yearlyDelivered: number;
  yearlyRatio: number;
}

const TLTeam = () => {
  const { user } = useAuth();
  const { t, roleName } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const isBDO = user?.role === "bdo" || user?.role === "business_development_officer" || user?.role === "Business Development And Marketing Manager";
  const isATL = user?.role === "Assistant Team Leader";
  const [atlTlMap, setAtlTlMap] = useState<Record<string, string>>({});

  const [viewLevel, setViewLevel] = useState<ViewLevel>("tl_list");
  const [selectedTL, setSelectedTL] = useState<PersonStats | null>(null);
  const [selectedGL, setSelectedGL] = useState<PersonStats | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<PersonStats | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("daily");

  const [tlList, setTlList] = useState<PersonStats[]>([]);
  const [glList, setGlList] = useState<PersonStats[]>([]);
  const [agentList, setAgentList] = useState<PersonStats[]>([]);
  const [otherEmployees, setOtherEmployees] = useState<PersonStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Group management state
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [allTeamMembers, setAllTeamMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Set<string>>(new Set());
  const [selectedGroupLeader, setSelectedGroupLeader] = useState("");
  const [existingGroups, setExistingGroups] = useState<{ leader: { id: string; name: string }; members: { id: string; name: string }[] }[]>([]);
  const [groupApprovals, setGroupApprovals] = useState<any[]>([]);
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  const getDateRange = useCallback((period: TimePeriod) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
    return { todayStart, monthStart, yearStart };
  }, []);

  const fetchPersonStats = useCallback(async (userId: string, userInfo: any, isAgent: boolean): Promise<PersonStats> => {
    const { todayStart, monthStart, yearStart } = getDateRange(timePeriod);
    const field = isAgent ? "agent_id" : "tl_id";
    const leadField = isAgent ? "assigned_to" : "tl_id";

    const [tLeads, tOrders, tDel, mLeads, mOrders, mDel, yOrders, yDel] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }).eq(leadField, userId).gte("created_at", todayStart),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq(field, userId).gte("created_at", todayStart),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq(field, userId).eq("delivery_status", "delivered").gte("created_at", todayStart),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq(leadField, userId).gte("created_at", monthStart),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq(field, userId).gte("created_at", monthStart),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq(field, userId).eq("delivery_status", "delivered").gte("created_at", monthStart),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq(field, userId).gte("created_at", yearStart),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq(field, userId).eq("delivery_status", "delivered").gte("created_at", yearStart),
    ]);

    const tO = tOrders.count || 0, tD = tDel.count || 0;
    const mO = mOrders.count || 0, mD = mDel.count || 0;
    const yO = yOrders.count || 0, yD = yDel.count || 0;

    return {
      id: userId,
      name: userInfo.name,
      role: userInfo.role,
      panel: userInfo.panel,
      phone: userInfo.phone,
      email: userInfo.email,
      designation: userInfo.designation,
      basicSalary: userInfo.basic_salary,
      joinDate: userInfo.created_at,
      isActive: userInfo.is_active !== false,
      todayLeads: tLeads.count || 0,
      todayOrders: tO,
      todayDelivered: tD,
      todayRatio: tO > 0 ? Math.round((tD / tO) * 100) : 0,
      monthlyLeads: mLeads.count || 0,
      monthlyOrders: mO,
      monthlyDelivered: mD,
      monthlyRatio: mO > 0 ? Math.round((mD / mO) * 100) : 0,
      yearlyOrders: yO,
      yearlyDelivered: yD,
      yearlyRatio: yO > 0 ? Math.round((yD / yO) * 100) : 0,
    };
  }, [getDateRange, timePeriod]);

  const initializedRef = { current: false };

  // Load TL list
  const loadTLs = useCallback(async (skipViewChange = false) => {
    if (!user) return;
    setLoading(true);

    if (isBDO) {
      const { data } = await supabase.from("users").select("*").eq("panel", "tl").eq("is_active", true).neq("id", user.id);
      if (data) {
        const stats = await Promise.all(data.map((u: any) => fetchPersonStats(u.id, u, false)));
        setTlList(stats);
      }
    } else {
      // Regular TL sees themselves - go directly to GL list
      const { data: selfData } = await supabase.from("users").select("*").eq("id", user.id).single();
      if (selfData) {
        const stats = await fetchPersonStats(user.id, selfData, false);
        setSelectedTL(stats);
        if (!skipViewChange) setViewLevel("gl_list");
        await loadGLs(user.id);
        setLoading(false);
        return;
      }
    }
    setLoading(false);
  }, [user, isBDO, fetchPersonStats]);

  // Load Group Leaders under a TL
  const loadGLs = useCallback(async (tlId: string) => {
    setLoading(true);
    // Get agents under this TL from campaign_agent_roles
    const { data: agentRoles } = await supabase
      .from("campaign_agent_roles")
      .select("agent_id")
      .eq("tl_id", tlId);

    if (!agentRoles || agentRoles.length === 0) {
      setGlList([]);
      setLoading(false);
      return;
    }

    const agentIds = agentRoles.map((r: any) => r.agent_id);

    // Find group leaders who lead any of these agents
    const { data: groupData } = await supabase
      .from("group_members")
      .select("group_leader_id")
      .in("agent_id", agentIds);

    const glIds = [...new Set((groupData || []).map((g: any) => g.group_leader_id))];

    if (glIds.length === 0) {
      setGlList([]);
      setLoading(false);
      return;
    }

    const { data: glUsers } = await supabase.from("users").select("*").in("id", glIds).eq("is_active", true);
    if (glUsers) {
      const stats = await Promise.all(glUsers.map((u: any) => fetchPersonStats(u.id, u, true)));
      setGlList(stats);
    }
    setLoading(false);
  }, [fetchPersonStats]);

  // Load Agents under a Group Leader
  const loadAgents = useCallback(async (glId: string) => {
    setLoading(true);
    const { data: groupData } = await supabase.from("group_members").select("agent_id").eq("group_leader_id", glId);
    if (!groupData || groupData.length === 0) {
      setAgentList([]);
      setLoading(false);
      return;
    }

    const agentIds = groupData.map((g: any) => g.agent_id);
    const { data: agentUsers } = await supabase.from("users").select("*").in("id", agentIds).eq("is_active", true);
    if (agentUsers) {
      const stats = await Promise.all(agentUsers.map((u: any) => fetchPersonStats(u.id, u, true)));
      setAgentList(stats);
    }
    setLoading(false);
  }, [fetchPersonStats]);

  // Load other employees (non-sales roles)
  const loadOtherEmployees = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("is_active", true)
      .not("role", "in", '("team_leader","telesales_executive","assistant_team_leader","group_leader","Business Development And Marketing Manager","super_admin")')
      .eq("panel", "employee");

    if (data) {
      const employees: PersonStats[] = data.map((u: any) => ({
        id: u.id, name: u.name, role: u.role, panel: u.panel,
        phone: u.phone, email: u.email, designation: u.designation,
        basicSalary: u.basic_salary, joinDate: u.created_at, isActive: true,
        todayLeads: 0, todayOrders: 0, todayDelivered: 0, todayRatio: 0,
        monthlyLeads: 0, monthlyOrders: 0, monthlyDelivered: 0, monthlyRatio: 0,
        yearlyOrders: 0, yearlyDelivered: 0, yearlyRatio: 0,
      }));
      setOtherEmployees(employees);
    }
    setLoading(false);
  }, []);


  // Group management functions
  const loadTeamMembersForGroup = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("campaign_agent_roles")
      .select("agent_id, users!campaign_agent_roles_agent_id_fkey(id, name, role)")
      .eq("tl_id", user.id);
    if (data) {
      const seen = new Set<string>();
      const members: { id: string; name: string; role: string }[] = [];
      data.forEach((r: any) => {
        if (r.users && !seen.has(r.users.id)) {
          members.push({ id: r.users.id, name: r.users.name, role: r.users.role });
          seen.add(r.users.id);
        }
      });
      setAllTeamMembers(members);
    }
  }, [user]);

  const loadExistingGroups = useCallback(async () => {
    if (!user) return;
    // Get agents under this TL
    const { data: agentRoles } = await supabase
      .from("campaign_agent_roles")
      .select("agent_id")
      .eq("tl_id", user.id);
    if (!agentRoles || agentRoles.length === 0) { setExistingGroups([]); return; }
    const agentIds = agentRoles.map((r: any) => r.agent_id);

    const { data: gm } = await supabase
      .from("group_members")
      .select("agent_id, group_leader_id")
      .in("agent_id", agentIds);

    if (!gm || gm.length === 0) { setExistingGroups([]); return; }

    const glIds = [...new Set(gm.map((g: any) => g.group_leader_id))];
    const allIds = [...new Set([...glIds, ...gm.map((g: any) => g.agent_id)])];
    const { data: users } = await supabase.from("users").select("id, name").in("id", allIds);
    const userMap = new Map((users || []).map((u: any) => [u.id, u.name]));

    const groups = glIds.map(glId => ({
      leader: { id: glId, name: userMap.get(glId) || "Unknown" },
      members: gm.filter((g: any) => g.group_leader_id === glId).map((g: any) => ({
        id: g.agent_id, name: userMap.get(g.agent_id) || "Unknown"
      }))
    }));
    setExistingGroups(groups);
  }, [user]);

  const loadGroupApprovals = useCallback(async () => {
    if (!user) return;
    let q = supabase.from("sa_approvals").select("*").eq("type", "group_creation").order("created_at", { ascending: false });
    if (!isBDO) q = q.eq("requested_by", user.id);
    const { data } = await q;
    setGroupApprovals(data || []);
  }, [user, isBDO]);

  const handleSubmitGroup = async () => {
    if (!user || selectedGroupMembers.size === 0 || !selectedGroupLeader) return;
    setGroupSubmitting(true);
    const memberIds = [...selectedGroupMembers].filter(id => id !== selectedGroupLeader);
    const leaderName = allTeamMembers.find(m => m.id === selectedGroupLeader)?.name || "";
    const memberNames = memberIds.map(id => allTeamMembers.find(m => m.id === id)?.name || "").filter(Boolean);

    const { error } = await supabase.from("sa_approvals").insert({
      type: "group_creation",
      requested_by: user.id,
      details: {
        group_leader_id: selectedGroupLeader,
        group_leader_name: leaderName,
        member_ids: memberIds,
        member_names: memberNames,
        tl_id: user.id,
        tl_name: user.name,
      },
    });

    if (error) {
      toast.error("গ্রুপ তৈরির অনুরোধ ব্যর্থ হয়েছে");
    } else {
      toast.success("গ্রুপ তৈরির অনুরোধ BDO-এর কাছে পাঠানো হয়েছে");
      setGroupCreateOpen(false);
      setSelectedGroupMembers(new Set());
      setSelectedGroupLeader("");
      loadGroupApprovals();
    }
    setGroupSubmitting(false);
  };

  const handleApproveGroup = async (approval: any) => {
    const details = approval.details as any;
    if (!details?.group_leader_id || !details?.member_ids) return;

    // Insert into group_members
    const inserts = details.member_ids.map((agentId: string) => ({
      group_leader_id: details.group_leader_id,
      agent_id: agentId,
    }));
    const { error: insertErr } = await supabase.from("group_members").insert(inserts);
    if (insertErr) { toast.error("গ্রুপ তৈরি ব্যর্থ: " + insertErr.message); return; }

    await supabase.from("sa_approvals").update({ status: "approved", decided_by: user?.id }).eq("id", approval.id);
    toast.success("গ্রুপ অনুমোদন হয়েছে");
    loadGroupApprovals();
    loadExistingGroups();
  };

  const handleRejectGroup = async (approvalId: string) => {
    await supabase.from("sa_approvals").update({ status: "rejected", decided_by: user?.id }).eq("id", approvalId);
    toast.success("গ্রুপ প্রত্যাখ্যান করা হয়েছে");
    loadGroupApprovals();
  };

  const handleDeleteGroup = async (leaderId: string) => {
    await supabase.from("group_members").delete().eq("group_leader_id", leaderId);
    toast.success("গ্রুপ মুছে ফেলা হয়েছে");
    loadExistingGroups();
  };


  // Initial load - only once
  useEffect(() => {
    if (!user || initializedRef.current) return;
    initializedRef.current = true;
    loadTLs();
    if (isBDO) loadOtherEmployees();
  }, [user]);

  // Realtime subscriptions - stable, no dependency on view state
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('tl-team-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
        // Only reload groups on group_members change
        loadExistingGroups();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Navigation handlers
  const navigateToTL = async (tl: PersonStats) => {
    setSelectedTL(tl);
    setViewLevel("gl_list");
    await loadGLs(tl.id);
  };

  const navigateToGL = async (gl: PersonStats) => {
    setSelectedGL(gl);
    setViewLevel("agent_list");
    await loadAgents(gl.id);
  };

  const navigateToProfile = (person: PersonStats) => {
    setSelectedProfile(person);
    setViewLevel("profile");
  };

  const goBack = () => {
    if (viewLevel === "profile") {
      if (selectedGL) setViewLevel("agent_list");
      else if (selectedTL) setViewLevel("gl_list");
      else setViewLevel("tl_list");
      setSelectedProfile(null);
    } else if (viewLevel === "agent_list") {
      setViewLevel("gl_list");
      setSelectedGL(null);
    } else if (viewLevel === "gl_list") {
      if (isBDO) {
        setViewLevel("tl_list");
        setSelectedTL(null);
      }
    } else if (viewLevel === "other_employees") {
      setViewLevel("tl_list");
    } else if (viewLevel === "rankings") {
      setViewLevel("tl_list");
    } else if (viewLevel === "group_management") {
      if (isBDO) setViewLevel("tl_list");
      else setViewLevel("gl_list");
    }
  };

  // Get stats based on period
  const getStatsByPeriod = (p: PersonStats) => {
    if (timePeriod === "daily") return { leads: p.todayLeads, orders: p.todayOrders, delivered: p.todayDelivered, ratio: p.todayRatio };
    if (timePeriod === "monthly") return { leads: p.monthlyLeads, orders: p.monthlyOrders, delivered: p.monthlyDelivered, ratio: p.monthlyRatio };
    return { leads: 0, orders: p.yearlyOrders, delivered: p.yearlyDelivered, ratio: p.yearlyRatio };
  };

  // Rankings
  const allSalesPersons = useMemo(() => {
    const all: (PersonStats & { type: string })[] = [];
    tlList.forEach(p => all.push({ ...p, type: "TL" }));
    glList.forEach(p => all.push({ ...p, type: "GL" }));
    agentList.forEach(p => all.push({ ...p, type: "Agent" }));
    return all;
  }, [tlList, glList, agentList]);

  const bestTL = useMemo(() => {
    if (tlList.length === 0) return null;
    return [...tlList].sort((a, b) => {
      const sa = getStatsByPeriod(a), sb = getStatsByPeriod(b);
      return sb.delivered - sa.delivered || sb.ratio - sa.ratio;
    })[0];
  }, [tlList, timePeriod]);

  const bestGL = useMemo(() => {
    if (glList.length === 0) return null;
    return [...glList].sort((a, b) => {
      const sa = getStatsByPeriod(a), sb = getStatsByPeriod(b);
      return sb.delivered - sa.delivered || sb.ratio - sa.ratio;
    })[0];
  }, [glList, timePeriod]);

  const bestAgent = useMemo(() => {
    if (agentList.length === 0) return null;
    return [...agentList].sort((a, b) => {
      const sa = getStatsByPeriod(a), sb = getStatsByPeriod(b);
      return sb.delivered - sa.delivered || sb.ratio - sa.ratio;
    })[0];
  }, [agentList, timePeriod]);

  // Filtered list based on search
  const filterList = (list: PersonStats[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q)) ||
      p.email.toLowerCase().includes(q)
    );
  };

  // Breadcrumb
  const renderBreadcrumb = () => {
    const crumbs: { label: string; onClick?: () => void }[] = [];

    if (isBDO) {
      crumbs.push({
        label: isBn ? "টিম লিডার তালিকা" : "Team Leaders",
        onClick: viewLevel !== "tl_list" ? () => { setViewLevel("tl_list"); setSelectedTL(null); setSelectedGL(null); setSelectedProfile(null); } : undefined,
      });
    }

    if (selectedTL && viewLevel !== "tl_list") {
      crumbs.push({
        label: selectedTL.name,
        onClick: viewLevel !== "gl_list" ? () => { setViewLevel("gl_list"); setSelectedGL(null); setSelectedProfile(null); } : undefined,
      });
    }

    if (selectedGL && (viewLevel === "agent_list" || viewLevel === "profile")) {
      crumbs.push({
        label: selectedGL.name,
        onClick: viewLevel !== "agent_list" ? () => { setViewLevel("agent_list"); setSelectedProfile(null); } : undefined,
      });
    }

    if (selectedProfile && viewLevel === "profile") {
      crumbs.push({ label: selectedProfile.name });
    }

    if (viewLevel === "other_employees") {
      crumbs.push({ label: isBn ? "অন্যান্য কর্মী" : "Other Employees" });
    }

    if (viewLevel === "rankings") {
      crumbs.push({ label: isBn ? "সেরা পারফর্মার" : "Top Performers" });
    }


    if (viewLevel === "group_management") {
      crumbs.push({ label: isBn ? "গ্রুপ ম্যানেজমেন্ট" : "Group Management" });
    }

    return (
      <div className="flex items-center gap-1 text-sm flex-wrap">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            {c.onClick ? (
              <button onClick={c.onClick} className="text-primary hover:underline font-medium">{c.label}</button>
            ) : (
              <span className="text-foreground font-semibold">{c.label}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  const renderPersonRow = (p: PersonStats, onClick: () => void, showType?: string) => {
    const stats = getStatsByPeriod(p);
    return (
      <TableRow key={p.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={onClick}>
        <TableCell>
          <div className="flex items-center gap-2">
            {showType === "TL" && <Shield className="h-4 w-4 text-primary" />}
            {showType === "GL" && <Crown className="h-4 w-4 text-amber-500" />}
            {showType === "Agent" && <UserCheck className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="font-medium text-foreground">{p.name}</p>
              <p className="text-[11px] text-muted-foreground">{roleName(p.role)}</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-center font-mono">{stats.leads}</TableCell>
        <TableCell className="text-center font-mono">{stats.orders}</TableCell>
        <TableCell className="text-center font-mono">{stats.delivered}</TableCell>
        <TableCell className="text-center">
          <Badge variant={stats.ratio >= 60 ? "default" : stats.ratio >= 30 ? "secondary" : "destructive"} className="font-mono text-xs">
            {stats.ratio}%
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <ChevronRight className="h-4 w-4 text-muted-foreground mx-auto" />
        </TableCell>
      </TableRow>
    );
  };

  const renderDataTable = (list: PersonStats[], onRowClick: (p: PersonStats) => void, type: string) => {
    const filtered = filterList(list);
    const periodLabel = timePeriod === "daily" ? (isBn ? "আজকের" : "Today's") :
      timePeriod === "monthly" ? (isBn ? "মাসিক" : "Monthly") : (isBn ? "বাৎসরিক" : "Yearly");

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">{isBn ? "নাম / রোল" : "Name / Role"}</TableHead>
              <TableHead className="text-center">{periodLabel} Leads</TableHead>
              <TableHead className="text-center">{periodLabel} Orders</TableHead>
              <TableHead className="text-center">{periodLabel} Delivered</TableHead>
              <TableHead className="text-center">Ratio</TableHead>
              <TableHead className="text-center w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {isBn ? "কোনো ডাটা নেই" : "No data found"}
                </TableCell>
              </TableRow>
            ) : filtered.map(p => renderPersonRow(p, () => onRowClick(p), type))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // Profile view
  const renderProfile = () => {
    if (!selectedProfile) return null;
    const p = selectedProfile;
    const stats = getStatsByPeriod(p);

    return (
      <div className="space-y-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                {p.name.charAt(0)}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-xl font-heading font-bold text-foreground">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{roleName(p.role)}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {p.phone || "—"}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {p.email}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" /> {p.basicSalary ? `৳${p.basicSalary.toLocaleString()}` : "—"}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> {p.joinDate ? new Date(p.joinDate).toLocaleDateString("bn-BD") : "—"}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: isBn ? "Leads" : "Leads", value: stats.leads, color: "text-primary" },
            { label: isBn ? "Orders" : "Orders", value: stats.orders, color: "text-foreground" },
            { label: isBn ? "Delivered" : "Delivered", value: stats.delivered, color: "text-emerald-500" },
            { label: "Ratio", value: `${stats.ratio}%`, color: stats.ratio >= 60 ? "text-emerald-500" : stats.ratio >= 30 ? "text-amber-500" : "text-destructive" },
          ].map(s => (
            <Card key={s.label} className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold font-heading ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* All 3 periods comparison */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">{isBn ? "সকল সময়কালের তুলনা" : "Period Comparison"}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isBn ? "সময়কাল" : "Period"}</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-center">Delivered</TableHead>
                  <TableHead className="text-center">Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">{isBn ? "আজকের" : "Today"}</TableCell>
                  <TableCell className="text-center font-mono">{p.todayLeads}</TableCell>
                  <TableCell className="text-center font-mono">{p.todayOrders}</TableCell>
                  <TableCell className="text-center font-mono">{p.todayDelivered}</TableCell>
                  <TableCell className="text-center"><Badge variant={p.todayRatio >= 60 ? "default" : "secondary"} className="font-mono text-xs">{p.todayRatio}%</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">{isBn ? "মাসিক" : "Monthly"}</TableCell>
                  <TableCell className="text-center font-mono">{p.monthlyLeads}</TableCell>
                  <TableCell className="text-center font-mono">{p.monthlyOrders}</TableCell>
                  <TableCell className="text-center font-mono">{p.monthlyDelivered}</TableCell>
                  <TableCell className="text-center"><Badge variant={p.monthlyRatio >= 60 ? "default" : "secondary"} className="font-mono text-xs">{p.monthlyRatio}%</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">{isBn ? "বাৎসরিক" : "Yearly"}</TableCell>
                  <TableCell className="text-center font-mono">—</TableCell>
                  <TableCell className="text-center font-mono">{p.yearlyOrders}</TableCell>
                  <TableCell className="text-center font-mono">{p.yearlyDelivered}</TableCell>
                  <TableCell className="text-center"><Badge variant={p.yearlyRatio >= 60 ? "default" : "secondary"} className="font-mono text-xs">{p.yearlyRatio}%</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Rankings view
  const renderRankings = () => {
    const periodLabel = timePeriod === "daily" ? (isBn ? "আজকের" : "Today's") :
      timePeriod === "monthly" ? (isBn ? "মাসিক" : "Monthly") : (isBn ? "বাৎসরিক" : "Yearly");

    const renderTopCard = (title: string, person: PersonStats | null, icon: React.ReactNode, color: string) => (
      <Card className="bg-card border-border">
        <CardContent className="p-4 text-center">
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${color} mb-2`}>{icon}</div>
          <p className="text-xs text-muted-foreground mb-1">{title}</p>
          {person ? (
            <>
              <p className="font-bold text-foreground">{person.name}</p>
              <p className="text-xs text-muted-foreground">{getStatsByPeriod(person).delivered} delivered • {getStatsByPeriod(person).ratio}%</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{isBn ? "ডাটা নেই" : "No data"}</p>
          )}
        </CardContent>
      </Card>
    );

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {renderTopCard(isBn ? `${periodLabel} সেরা TL` : `${periodLabel} Best TL`, bestTL, <Shield className="h-5 w-5 text-primary" />, "bg-primary/10")}
          {renderTopCard(isBn ? `${periodLabel} সেরা GL` : `${periodLabel} Best GL`, bestGL, <Crown className="h-5 w-5 text-amber-500" />, "bg-amber-500/10")}
          {renderTopCard(isBn ? `${periodLabel} সেরা Agent` : `${periodLabel} Best Agent`, bestAgent, <Star className="h-5 w-5 text-emerald-500" />, "bg-emerald-500/10")}
        </div>
      </div>
    );
  };

  // Other employees view
  const renderOtherEmployees = () => {
    const filtered = filterList(otherEmployees);
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
              <TableHead className="text-center">{isBn ? "রোল" : "Role"}</TableHead>
              <TableHead className="text-center">{isBn ? "ফোন" : "Phone"}</TableHead>
              <TableHead className="text-center">{isBn ? "ইমেইল" : "Email"}</TableHead>
              <TableHead className="text-center">{isBn ? "বেতন" : "Salary"}</TableHead>
              <TableHead className="text-center">{isBn ? "যোগদান" : "Joined"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{isBn ? "কোনো কর্মী নেই" : "No employees"}</TableCell></TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigateToProfile(p)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{roleName(p.role)}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center"><Badge variant="secondary" className="text-[10px]">{roleName(p.role)}</Badge></TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">{p.phone || "—"}</TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">{p.email}</TableCell>
                <TableCell className="text-center font-mono text-sm">{p.basicSalary ? `৳${p.basicSalary.toLocaleString()}` : "—"}</TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{p.joinDate ? new Date(p.joinDate).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (!user) return null;

  const showBackButton = viewLevel !== "tl_list" && (isBDO || viewLevel !== "gl_list");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={goBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">
              {isBn ? "টিম ম্যানেজমেন্ট" : "Team Management"}
            </h2>
            {renderBreadcrumb()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <SelectTrigger className="w-36 bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{isBn ? "দৈনিক" : "Daily"}</SelectItem>
              <SelectItem value="monthly">{isBn ? "মাসিক" : "Monthly"}</SelectItem>
              <SelectItem value="yearly">{isBn ? "বাৎসরিক" : "Yearly"}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => {
            if (viewLevel === "tl_list") loadTLs();
            else if (viewLevel === "gl_list" && selectedTL) loadGLs(selectedTL.id);
            else if (viewLevel === "agent_list" && selectedGL) loadAgents(selectedGL.id);
          }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      {(isBDO ? viewLevel === "tl_list" : viewLevel === "gl_list") && (
        <div className="flex gap-2 flex-wrap">
          {isBDO && (
            <>
              <Button variant="outline" size="sm" onClick={() => setViewLevel("rankings")} className="gap-1.5">
                <Trophy className="h-4 w-4" /> {isBn ? "সেরা পারফর্মার" : "Top Performers"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewLevel("other_employees")} className="gap-1.5">
                <Briefcase className="h-4 w-4" /> {isBn ? "অন্যান্য কর্মী" : "Other Employees"}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setViewLevel("group_management"); loadTeamMembersForGroup(); loadExistingGroups(); loadGroupApprovals(); }}
            className="gap-1.5"
          >
            <Users className="h-4 w-4" />
            {isBn ? "গ্রুপ ম্যানেজমেন্ট" : "Group Management"}
          </Button>
        </div>
      )}

      {/* Rankings cards - always visible at TL list level for BDO */}
      {isBDO && viewLevel === "tl_list" && bestTL && renderRankings()}

      {/* Search */}
      {viewLevel !== "profile" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isBn ? "নাম, ফোন বা ইমেইল দিয়ে খুঁজুন..." : "Search by name, phone or email..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
      )}

      {/* Content */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-heading">
            {viewLevel === "tl_list" && (isBn ? "টিম লিডার তালিকা" : "Team Leaders")}
            {viewLevel === "gl_list" && (isBn ? `${selectedTL?.name} এর গ্রুপ লিডারগণ` : `${selectedTL?.name}'s Group Leaders`)}
            {viewLevel === "agent_list" && (isBn ? `${selectedGL?.name} এর এজেন্টগণ` : `${selectedGL?.name}'s Agents`)}
            {viewLevel === "profile" && (isBn ? "প্রোফাইল ও পারফর্ম্যান্স" : "Profile & Performance")}
            {viewLevel === "other_employees" && (isBn ? "অন্যান্য কর্মী" : "Other Employees")}
            {viewLevel === "rankings" && (isBn ? "সেরা পারফর্মার" : "Top Performers")}
            {viewLevel === "group_management" && (isBn ? "গ্রুপ ম্যানেজমেন্ট" : "Group Management")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-3 text-sm text-muted-foreground">{isBn ? "লোড হচ্ছে..." : "Loading..."}</span>
            </div>
          ) : (
            <>
              {viewLevel === "tl_list" && renderDataTable(tlList, navigateToTL, "TL")}
              {viewLevel === "gl_list" && renderDataTable(glList, navigateToGL, "GL")}
              {viewLevel === "agent_list" && renderDataTable(agentList, navigateToProfile, "Agent")}
              {viewLevel === "profile" && renderProfile()}
              {viewLevel === "other_employees" && renderOtherEmployees()}
              {viewLevel === "rankings" && renderRankings()}
              {viewLevel === "group_management" && (
                <div className="space-y-6">
                  {/* Create Group Button - only for TL, not BDO */}
                  {!isBDO && (
                    <Button onClick={() => { setGroupCreateOpen(true); loadTeamMembersForGroup(); }} className="gap-2">
                      <Plus className="h-4 w-4" /> {isBn ? "নতুন গ্রুপ তৈরি করুন" : "Create New Group"}
                    </Button>
                  )}

                  {/* Existing Groups */}
                  <div>
                    <h3 className="font-heading text-base font-semibold mb-3">{isBn ? "বর্তমান গ্রুপসমূহ" : "Existing Groups"}</h3>
                    {existingGroups.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>{isBn ? "কোনো গ্রুপ নেই" : "No groups yet"}</p>
                      </div>
                    ) : existingGroups.map(g => (
                      <div key={g.leader.id} className="p-4 rounded-lg border border-border mb-3 bg-secondary/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-500" />
                            <span className="font-semibold text-foreground">{g.leader.name}</span>
                            <Badge variant="outline" className="text-[10px]">{isBn ? "গ্রুপ লিডার" : "Group Leader"}</Badge>
                          </div>
                          {!isBDO && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGroup(g.leader.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.members.map(m => (
                            <Badge key={m.id} variant="secondary" className="text-xs">{m.name}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Group Approvals */}
                  <div>
                    <h3 className="font-heading text-base font-semibold mb-3">
                      {isBn ? "গ্রুপ অনুমোদন" : "Group Approvals"}
                    </h3>
                    {groupApprovals.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{isBn ? "কোনো অনুমোদন নেই" : "No approvals"}</p>
                    ) : groupApprovals.map(a => {
                      const d = a.details as any;
                      return (
                        <div key={a.id} className={`p-4 rounded-lg border mb-3 ${a.status === 'pending' ? 'border-amber-500/30 bg-amber-500/5' : a.status === 'approved' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-foreground">{d?.tl_name || "TL"}</span>
                                <Badge variant={a.status === 'pending' ? 'outline' : a.status === 'approved' ? 'default' : 'destructive'} className="text-[10px]">
                                  {a.status === 'pending' ? (isBn ? 'পেন্ডিং' : 'Pending') : a.status === 'approved' ? (isBn ? 'অনুমোদিত' : 'Approved') : (isBn ? 'প্রত্যাখ্যাত' : 'Rejected')}
                                </Badge>
                              </div>
                              <p className="text-sm text-foreground">
                                <Crown className="inline h-3 w-3 text-amber-500 mr-1" />
                                {isBn ? "গ্রুপ লিডার:" : "Group Leader:"} <span className="font-medium">{d?.group_leader_name}</span>
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(d?.member_names || []).map((name: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-[10px]">{name}</Badge>
                                ))}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {new Date(a.created_at).toLocaleString("bn-BD")}
                              </p>
                            </div>
                            {a.status === 'pending' && isBDO && (
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="outline" onClick={() => handleApproveGroup(a)} className="gap-1 text-emerald-600 border-emerald-500/50 hover:bg-emerald-500/10">
                                  <CheckCircle className="h-3.5 w-3.5" /> {isBn ? "অনুমোদন" : "Approve"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleRejectGroup(a.id)} className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10">
                                  <XCircle className="h-3.5 w-3.5" /> {isBn ? "বাতিল" : "Reject"}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Group Create Dialog */}
      <Dialog open={groupCreateOpen} onOpenChange={setGroupCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isBn ? "নতুন গ্রুপ তৈরি করুন" : "Create New Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">{isBn ? "মেম্বার নির্বাচন করুন" : "Select Members"}</p>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {allTeamMembers.map(m => (
                  <label key={m.id} className="flex items-center gap-2 p-1.5 hover:bg-accent/50 rounded cursor-pointer">
                    <Checkbox
                      checked={selectedGroupMembers.has(m.id)}
                      onCheckedChange={(c) => {
                        const next = new Set(selectedGroupMembers);
                        if (c) next.add(m.id); else { next.delete(m.id); if (selectedGroupLeader === m.id) setSelectedGroupLeader(""); }
                        setSelectedGroupMembers(next);
                      }}
                    />
                    <span className="text-sm text-foreground">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{roleName(m.role)}</span>
                  </label>
                ))}
                {allTeamMembers.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">{isBn ? "কোনো মেম্বার নেই" : "No members"}</p>}
              </div>
            </div>
            {selectedGroupMembers.size > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">{isBn ? "গ্রুপ লিডার নির্বাচন করুন" : "Select Group Leader"}</p>
                <Select value={selectedGroupLeader} onValueChange={setSelectedGroupLeader}>
                  <SelectTrigger>
                    <SelectValue placeholder={isBn ? "গ্রুপ লিডার বাছুন" : "Choose Group Leader"} />
                  </SelectTrigger>
                  <SelectContent>
                    {[...selectedGroupMembers].map(id => {
                      const m = allTeamMembers.find(t => t.id === id);
                      return m ? <SelectItem key={id} value={id}>{m.name}</SelectItem> : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupCreateOpen(false)}>{isBn ? "বাতিল" : "Cancel"}</Button>
            <Button
              onClick={handleSubmitGroup}
              disabled={selectedGroupMembers.size < 2 || !selectedGroupLeader || groupSubmitting}
            >
              {groupSubmitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {isBn ? "অনুমোদনের জন্য পাঠান" : "Send for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TLTeam;
