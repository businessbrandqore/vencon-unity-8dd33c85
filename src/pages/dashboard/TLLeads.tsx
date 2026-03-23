import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useATLApproval } from "@/hooks/useATLApproval";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, RefreshCw } from "lucide-react";
import FraudChecker from "@/components/FraudChecker";
import CopyButton from "@/components/ui/CopyButton";

interface Agent { id: string; name: string; }
interface Lead { id: string; name: string | null; phone: string | null; address: string | null; created_at: string | null; status: string | null; requeue_count: number | null; updated_at: string | null; special_note?: string | null; assigned_to?: string | null; called_time?: number | null; agent_type?: string | null; campaign_id?: string | null; source?: string | null; import_source?: string | null; }
interface Order { id: string; customer_name: string | null; phone: string | null; product: string | null; agent_id: string | null; created_at: string | null; status: string | null; cs_note: string | null; cs_rating: string | null; agent?: { name: string }; }
interface PreOrder { id: string; lead_id: string | null; scheduled_date: string | null; agent_id: string | null; note: string | null; status: string | null; lead?: { name: string | null; phone: string | null; }; agent?: { name: string; }; }
interface SilverGoldenLead { id: string; name: string | null; phone: string | null; address: string | null; source: string | null; created_at: string | null; product?: string | null; price?: number | null; }

// Dynamic config types (from campaign_data_operations)
type AppPanel = "sa" | "hr" | "tl" | "employee";
interface ColumnOption {
  id: string; value: string; label: string; label_bn: string; color?: string;
  next_panel?: AppPanel | ""; next_location?: string;
}
type ColumnType = "dropdown" | "note";
interface StatusColumn { id: string; name: string; name_bn: string; type: ColumnType; options: ColumnOption[]; }
interface RoleColumnConfig { role: string; columns: StatusColumn[]; }

const TLLeads = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { section: urlSection } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const isBn = t("vencon") === "VENCON";
  const isMobile = useIsMobile();
  const { isATL, executeOrRequestApproval } = useATLApproval();

  const [campaigns, setCampaigns] = useState<{ id: string; name: string; data_mode: string }[]>([]);
  const [activeDataModeTab, setActiveDataModeTab] = useState<"lead" | "processing">("lead");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedWebsite, setSelectedWebsite] = useState("all");
  const [campaignWebsites, setCampaignWebsites] = useState<{ id: string; site_name: string }[]>([]);
  const [campaignMode, setCampaignMode] = useState<string>("lead");
  const [bronzeAgents, setBronzeAgents] = useState<Agent[]>([]);
  const [silverAgents, setSilverAgents] = useState<Agent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);

  const [freshLeads, setFreshLeads] = useState<Lead[]>([]);
  const [csoOrders, setCsoOrders] = useState<Order[]>([]);
  const [callDoneOrders, setCallDoneOrders] = useState<Order[]>([]);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [deleteSheetLeads, setDeleteSheetLeads] = useState<Lead[]>([]);
  const [deleteSheetThreshold, setDeleteSheetThreshold] = useState(5);
  const [processingLeads, setProcessingLeads] = useState<Lead[]>([]);
  const [agentLeads, setAgentLeads] = useState<Lead[]>([]);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all"); // "all" | "lead" | "bronze"
  // Derive active section from URL param, default to "assign"
  const activeSection = urlSection || "assign";
  // Silver & Golden data
  const [silverData, setSilverData] = useState<SilverGoldenLead[]>([]);
  const [goldenData, setGoldenData] = useState<SilverGoldenLead[]>([]);

  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [silverAssignments, setSilverAssignments] = useState<Record<string, string>>({});
  const [processingAssignments, setProcessingAssignments] = useState<Record<string, string>>({});
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkAgent, setBulkAgent] = useState("");
  const [selectedDeleteLeads, setSelectedDeleteLeads] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const normalizedRole = (user?.role || "").toLowerCase().replace(/\s+/g, "_");
  const isBDO =
    normalizedRole === "bdo" ||
    normalizedRole === "business_development_officer" ||
    normalizedRole === "business_development_and_marketing_manager";
  const isGL = normalizedRole === "group_leader";
  
  const [atlTlMap, setAtlTlMap] = useState<Record<string, string>>({});
  const [dynamicColumns, setDynamicColumns] = useState<StatusColumn[]>([]);

  // Data send state
  const [distDataMode, setDistDataMode] = useState<"lead" | "processing">("lead");
  const [distAgent, setDistAgent] = useState("");
  const [distAgents, setDistAgents] = useState<Agent[]>([]);
  const [sendCount, setSendCount] = useState("");
  const [availableCount, setAvailableCount] = useState(0);
  const [sending, setSending] = useState(false);

  // Load dynamic columns for the selected campaign
  const statusLabelMap = useMemo(() => {
    const map: Record<string, { label: string; label_bn: string; color?: string }> = {};
    dynamicColumns.forEach(col => {
      if (col.type === "dropdown") {
        col.options.forEach(opt => {
          map[opt.value] = { label: opt.label, label_bn: opt.label_bn, color: opt.color };
        });
      }
    });
    return map;
  }, [dynamicColumns]);

  // Sync distDataMode with active data mode tab
  useEffect(() => {
    setDistDataMode(activeDataModeTab);
  }, [activeDataModeTab]);

  const getStatusLabel = useCallback((status: string | null) => {
    if (!status) return "—";
    const mapped = statusLabelMap[status];
    if (mapped) return isBn ? (mapped.label_bn || mapped.label) : mapped.label;
    return status.replace(/_/g, " ");
  }, [statusLabelMap, isBn]);

  const getStatusColor = useCallback((status: string | null) => {
    if (!status) return "";
    return statusLabelMap[status]?.color || "";
  }, [statusLabelMap]);

  // Get the effective TL id for data queries (ATL/GL uses their assigned TL's id)
  const getEffectiveTlId = useCallback((campaignId?: string) => {
    if ((!isATL && !isGL) || !user) return user?.id || "";
    if (campaignId && atlTlMap[campaignId]) return atlTlMap[campaignId];
    if (selectedCampaign && atlTlMap[selectedCampaign]) return atlTlMap[selectedCampaign];
    return user?.id || "";
  }, [isATL, isGL, user, atlTlMap, selectedCampaign]);

  // Load delete sheet config (per-role, fallback to flat)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "delete_sheet_config").maybeSingle();
      if (data?.value) {
        const val = data.value as any;
        if (val.rules && Array.isArray(val.rules)) {
          // For TL, use the highest threshold from all rules or a default
          const myRule = val.rules.find((r: any) => r.role === user.role);
          if (myRule?.threshold) setDeleteSheetThreshold(myRule.threshold);
          else if (val.rules.length > 0) setDeleteSheetThreshold(val.rules[0].threshold || 5);
        } else if (val.threshold) {
          setDeleteSheetThreshold(val.threshold);
        }
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const applyCampaignList = (
      list: { id: string; name: string; data_mode: string }[],
      tlMap: Record<string, string> = {}
    ) => {
      setAtlTlMap(tlMap);
      setCampaigns(list);
      const nextSelectedCampaign = list.some((c) => c.id === selectedCampaign)
        ? selectedCampaign
        : (list[0]?.id || "");
      setSelectedCampaign(nextSelectedCampaign);
      const nextCampaign = list.find((c) => c.id === nextSelectedCampaign);
      setCampaignMode(nextCampaign?.data_mode || "lead");
    };

    const fetch = async () => {
      if (isBDO) {
        const { data } = await supabase
          .from("campaigns")
          .select("id, name, data_mode")
          .order("created_at", { ascending: false });

        const list = (data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          data_mode: c.data_mode || "lead",
        }));
        applyCampaignList(list);
      } else if (isATL) {
        // ATL: fetch campaigns from campaign_agent_roles
        const { data } = await supabase
          .from("campaign_agent_roles")
          .select("campaign_id, tl_id, campaigns(id, name, data_mode)")
          .eq("agent_id", user.id);

        const tlMap: Record<string, string> = {};
        const seen = new Set<string>();
        const list = (data || [])
          .filter((d: any) => d.campaigns)
          .filter((d: any) => {
            if (seen.has(d.campaigns.id)) return false;
            seen.add(d.campaigns.id);
            return true;
          })
          .map((d: any) => {
            tlMap[d.campaigns.id] = d.tl_id;
            return {
              id: d.campaigns.id,
              name: d.campaigns.name,
              data_mode: d.campaigns.data_mode || "lead",
            };
          });

        applyCampaignList(list, tlMap);
      } else if (isGL) {
        // GL: fetch campaigns from own group members (same pattern as GL dashboard)
        const { data: members } = await supabase
          .from("group_members")
          .select("agent_id")
          .eq("group_leader_id", user.id);

        const groupAgentIds = (members || []).map((m) => m.agent_id);
        const relatedUserIds = Array.from(new Set([user.id, ...groupAgentIds]));

        if (relatedUserIds.length === 0) {
          applyCampaignList([]);
          return;
        }

        const { data } = await supabase
          .from("campaign_agent_roles")
          .select("agent_id, campaign_id, tl_id, campaigns(id, name, data_mode)")
          .in("agent_id", relatedUserIds);

        const tlMap: Record<string, string> = {};
        const seen = new Set<string>();
        const list = (data || [])
          .filter((d: any) => d.campaigns)
          .filter((d: any) => {
            if (seen.has(d.campaigns.id)) return false;
            seen.add(d.campaigns.id);
            return true;
          })
          .map((d: any) => {
            if (!tlMap[d.campaigns.id]) tlMap[d.campaigns.id] = d.tl_id;
            return {
              id: d.campaigns.id,
              name: d.campaigns.name,
              data_mode: d.campaigns.data_mode || "lead",
            };
          });

        applyCampaignList(list, tlMap);
      } else {
        const { data } = await supabase
          .from("campaign_tls")
          .select("campaign_id, campaigns(id, name, data_mode)")
          .eq("tl_id", user.id);

        const list = (data || [])
          .map((d: any) => d.campaigns)
          .filter(Boolean)
          .map((c: any) => ({ id: c.id, name: c.name, data_mode: c.data_mode || "lead" }));

        applyCampaignList(list);
      }
    };

    fetch();
  }, [user, isBDO, isATL, isGL]);

  useEffect(() => {
    const c = campaigns.find((x) => x.id === selectedCampaign);
    if (c) setCampaignMode(c.data_mode);
    // Load websites for this campaign
    if (selectedCampaign) {
      setSelectedWebsite("all");
      (async () => {
        const { data } = await supabase
          .from("campaign_websites")
          .select("id, site_name")
          .eq("campaign_id", selectedCampaign)
          .eq("is_active", true)
          .order("site_name");
        setCampaignWebsites(data || []);
      })();
    } else {
      setCampaignWebsites([]);
    }
  }, [selectedCampaign, campaigns]);

  // Load dynamic columns from campaign_data_operations (filtered by data_mode)
  useEffect(() => {
    if (!selectedCampaign) return;
    (async () => {
      const { data: configData } = await supabase.from("campaign_data_operations")
        .select("fields_config")
        .eq("campaign_id", selectedCampaign)
        .eq("data_mode", campaignMode)
        .maybeSingle();
      if (!configData?.fields_config) { setDynamicColumns([]); return; }
      const configs = configData.fields_config as unknown as RoleColumnConfig[];
      // Collect all columns from all roles for TL overview
      const allCols: StatusColumn[] = [];
      const seenIds = new Set<string>();
      configs.forEach(rc => {
        rc.columns?.forEach(col => {
          if (!seenIds.has(col.id)) { seenIds.add(col.id); allCols.push(col); }
        });
      });
      setDynamicColumns(allCols);
    })();
  }, [selectedCampaign, campaignMode]);

  const loadAgents = useCallback(async () => {
    if (!user || !selectedCampaign) return;
    let rolesQ = supabase
      .from("campaign_agent_roles")
      .select("agent_id, is_bronze, is_silver, users!campaign_agent_roles_agent_id_fkey(id, name)")
      .eq("campaign_id", selectedCampaign);
    if (!isBDO) rolesQ = rolesQ.eq("tl_id", getEffectiveTlId());
    const { data: roles } = await rolesQ;
    if (roles) {
      const bronze: Agent[] = [], silver: Agent[] = [], all: Agent[] = [];
      roles.forEach((r: any) => {
        const agent = { id: r.users.id, name: r.users.name };
        all.push(agent);
        if (r.is_bronze) bronze.push(agent);
        if (r.is_silver) silver.push(agent);
      });
      setBronzeAgents(bronze); setSilverAgents(silver); setAllAgents(all);
    }
  }, [user, selectedCampaign, getEffectiveTlId]);

  const loadData = useCallback(async () => {
    if (!user || !selectedCampaign) return;

    // Fresh leads: show campaign fresh data from HR + TL-owned fresh leads for assignment
    let freshQ = supabase
      .from("leads")
      .select("*")
      .eq("campaign_id", selectedCampaign)
      .is("assigned_to", null)
      .eq("status", "fresh")
      .order("created_at", { ascending: false })
      .limit(500);

    // Website filter
    if (selectedWebsite !== "all") {
      const site = campaignWebsites.find(w => w.id === selectedWebsite);
      if (site) freshQ = freshQ.eq("source", site.site_name);
    }

    if (isBDO) {
      freshQ = freshQ.or("agent_type.is.null,agent_type.eq.bronze");
    } else {
      // RLS handles campaign-level access; filter by agent_type only
      freshQ = freshQ.or("agent_type.is.null,agent_type.eq.bronze");
    }

    const { data: fresh } = await freshQ;
    setFreshLeads(fresh || []);

    let csoQ = supabase.from("orders").select("*, agent:users!orders_agent_id_fkey(name)")
      .eq("status", "pending_tl").order("created_at", { ascending: false });
    if (!isBDO && selectedCampaign) {
      // Filter by lead's campaign via lead_id join - RLS handles access
      csoQ = csoQ;
    }
    const { data: cso } = await csoQ;
    setCsoOrders(cso || []);

    let callDoneQ = supabase.from("orders").select("*, agent:users!orders_agent_id_fkey(name)")
      .eq("status", "call_done").order("created_at", { ascending: false });
    const { data: callDone } = await callDoneQ;
    setCallDoneOrders(callDone || []);

    let preQ = supabase.from("pre_orders").select("*, lead:leads(name, phone), agent:users!pre_orders_agent_id_fkey(name)")
      .eq("status", "pending").order("created_at", { ascending: false });
    const { data: pre } = await preQ;
    setPreOrders(pre || []);

    let delQ = supabase.from("leads").select("*")
      .eq("campaign_id", selectedCampaign)
      .gte("requeue_count", deleteSheetThreshold).order("updated_at", { ascending: false });
    const { data: del } = await delQ;
    setDeleteSheetLeads(del || []);

    if (campaignMode === "processing") {
      let procQ = supabase.from("leads").select("*")
        .eq("campaign_id", selectedCampaign)
        .is("assigned_to", null).order("created_at", { ascending: false });
      const { data: proc } = await procQ;
      setProcessingLeads(proc || []);
    }

    // Silver data: leads that have been progressed to silver (agent_type='silver')
    // These are fresh silver leads waiting for TL to assign to silver agents
    let silverQ = supabase
      .from("leads")
      .select("id, name, phone, address, source, created_at, agent_type")
      .eq("agent_type", "silver")
      .eq("status", "fresh")
      .is("assigned_to", null)
      .order("created_at", { ascending: false });
    if (selectedCampaign) silverQ = silverQ.eq("campaign_id", selectedCampaign);
    // RLS handles campaign-level access for silver leads
    const { data: silverLeadsData } = await silverQ;
    setSilverData((silverLeadsData || []).map(l => ({
      id: l.id, name: l.name, phone: l.phone, address: l.address, source: l.source, created_at: l.created_at,
    })));

    // Golden data: leads that have been progressed to golden (agent_type='golden')
    let goldenQ = supabase
      .from("leads")
      .select("id, name, phone, address, source, created_at, agent_type")
      .eq("agent_type", "golden")
      .eq("status", "fresh")
      .is("assigned_to", null)
      .order("created_at", { ascending: false });
    if (selectedCampaign) goldenQ = goldenQ.eq("campaign_id", selectedCampaign);
    const { data: goldenLeadsData } = await goldenQ;
    setGoldenData((goldenLeadsData || []).map(l => ({
      id: l.id, name: l.name, phone: l.phone, address: l.address, source: l.source, created_at: l.created_at,
    })));

    // Agent leads: all assigned leads for this campaign (for TL monitoring)
    let agentQ = supabase.from("leads").select("*, users!leads_assigned_to_fkey(name)")
      .eq("campaign_id", selectedCampaign)
      .not("assigned_to", "is", null)
      .not("status", "in", "(fresh)")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (!isBDO) agentQ = agentQ.eq("tl_id", getEffectiveTlId());
    const { data: agentLeadsData } = await agentQ;
    setAgentLeads((agentLeadsData || []).map((l: any) => ({
      ...l,
      agent_name: l.users?.name || "—",
    })));
  }, [user, selectedCampaign, campaignMode, getEffectiveTlId, selectedWebsite, campaignWebsites]);

  useEffect(() => { loadAgents(); loadData(); }, [loadAgents, loadData]);

  // Load dist agents for data send (context-aware by section)
  useEffect(() => {
    if (!user || !selectedCampaign) { setDistAgents([]); return; }
    const load = async () => {
      if (activeSection === "cso") {
        // CSO section: show all active employees (not just CSO role)
        const { data } = await supabase
          .from("users")
          .select("id, name")
          .eq("is_active", true)
          .in("panel", ["employee", "tl", "hr"])
          .order("name");
        if (!data) { setDistAgents([]); return; }
        setDistAgents(data.map((u: any) => ({ id: u.id, name: u.name })));
      } else {
        // Agent sections: show all active employees
        const { data } = await supabase
          .from("users")
          .select("id, name")
          .eq("is_active", true)
          .in("panel", ["employee", "tl", "hr"])
          .order("name");
        if (!data) { setDistAgents([]); return; }
        setDistAgents(data.map((u: any) => ({ id: u.id, name: u.name })));
      }
      setDistAgent("");
    };
    load();
  }, [user?.id, selectedCampaign, distDataMode, getEffectiveTlId, activeSection]);

  // Count available items for data send
  useEffect(() => {
    if (!user) { setAvailableCount(0); return; }

    if (activeSection === "cso") {
      setAvailableCount(csoOrders.length);
      return;
    }

    if (!selectedCampaign) { setAvailableCount(0); return; }

    const load = async () => {
      let q = supabase.from("leads").select("id", { count: "exact", head: true })
        .eq("campaign_id", selectedCampaign).eq("status", "fresh").is("assigned_to", null);
      if (!isBDO) q = q.or(`tl_id.eq.${getEffectiveTlId()},tl_id.is.null`);
      if (distDataMode === "lead") {
        q = q.or("agent_type.is.null,agent_type.eq.bronze");
      } else {
        q = q.eq("agent_type", "silver");
      }
      const { count } = await q;
      setAvailableCount(count || 0);
    };
    load();
  }, [user?.id, selectedCampaign, distDataMode, isBDO, getEffectiveTlId, activeSection, csoOrders]);

  // Handle data send
  const handleSendData = async () => {
    if (!user || !distAgent || !sendCount || (activeSection !== "cso" && !selectedCampaign)) return;
    const count = parseInt(sendCount);
    if (isNaN(count) || count <= 0) { toast.error(isBn ? "সঠিক সংখ্যা দিন" : "Enter valid count"); return; }
    if (count > availableCount) { toast.error(isBn ? `মাত্র ${availableCount} টি ডাটা পাওয়া যাচ্ছে` : `Only ${availableCount} available`); return; }

    setSending(true);
    try {
      if (activeSection === "cso") {
        const orderIds = csoOrders.slice(0, count).map((o) => o.id);
        if (orderIds.length === 0) {
          toast.error(isBn ? "কোনো অর্ডার পাওয়া যায়নি" : "No orders found");
          setSending(false);
          return;
        }

        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({ status: "pending_cso", cso_id: distAgent })
          .in("id", orderIds);

        if (orderUpdateError) throw orderUpdateError;

        const csoName = distAgents.find((a) => a.id === distAgent)?.name || "";
        toast.success(
          isBn
            ? `${orderIds.length} টি অর্ডার ${csoName}-এর CSO কিউতে পাঠানো হয়েছে ✅`
            : `${orderIds.length} orders sent to ${csoName}'s CSO queue ✅`,
        );
        setSendCount("");
        await loadData();
        setSending(false);
        return;
      }

      let q = supabase.from("leads").select("id")
        .eq("campaign_id", selectedCampaign).eq("status", "fresh").is("assigned_to", null)
        .order("created_at", { ascending: true }).limit(count);
      if (!isBDO) q = q.or(`tl_id.eq.${getEffectiveTlId()},tl_id.is.null`);
      if (distDataMode === "lead") {
        q = q.or("agent_type.is.null,agent_type.eq.bronze");
      } else {
        q = q.eq("agent_type", "silver");
      }
      const { data: leadsToAssign, error } = await q;
      if (error) throw error;
      if (!leadsToAssign || leadsToAssign.length === 0) { toast.error(isBn ? "কোনো ডাটা পাওয়া যায়নি" : "No data found"); setSending(false); return; }

      const ids = leadsToAssign.map(l => l.id);
      const agentType = distDataMode === "processing" ? "silver" : "bronze";
      const { error: updateError } = await supabase.from("leads").update({
        assigned_to: distAgent, tl_id: getEffectiveTlId(), agent_type: agentType,
        status: distDataMode === "processing" ? "processing_assigned" : "assigned",
      }).in("id", ids);
      if (updateError) throw updateError;

      const agentName = distAgents.find(a => a.id === distAgent)?.name || "";
      toast.success(isBn ? `${ids.length} টি ${distDataMode === "lead" ? "লিড" : "প্রসেসিং"} ডাটা ${agentName}-কে পাঠানো হয়েছে ✅` : `${ids.length} ${distDataMode} data sent to ${agentName} ✅`);
      setSendCount("");
      setAvailableCount(prev => Math.max(0, prev - ids.length));
      loadData();
    } catch (err: any) {
      toast.error(isBn ? "ডাটা পাঠাতে সমস্যা: " + (err.message || "") : "Failed: " + (err.message || ""));
    }
    setSending(false);
  };

  const assignLead = async (leadId: string, agentId: string) => {
    await executeOrRequestApproval(
      "lead_assign",
      { leadId, agentId },
      isBn ? "লিড অ্যাসাইন" : "Lead assignment",
      async () => {
        const tlId = getEffectiveTlId();
        await supabase.from("leads").update({ assigned_to: agentId, status: "assigned", agent_type: "bronze", tl_id: tlId }).eq("id", leadId);
        toast.success(isBn ? "Lead assign করা হয়েছে" : "Lead assigned");
      }
    );
    loadData();
  };

  const bulkAssign = async () => {
    if (!bulkAgent || selectedLeads.size === 0) return;
    const ids = Array.from(selectedLeads);
    await executeOrRequestApproval(
      "data_distribute",
      { leadIds: ids, agentId: bulkAgent },
      isBn ? `${ids.length}টি লিড বাল্ক অ্যাসাইন` : `Bulk assign ${ids.length} leads`,
      async () => {
        const tlId = getEffectiveTlId();
        for (const id of ids) {
          await supabase.from("leads").update({ assigned_to: bulkAgent, status: "assigned", agent_type: "bronze", tl_id: tlId }).eq("id", id);
        }
        toast.success(isBn ? `${ids.length}টি lead assign হয়েছে` : `${ids.length} leads assigned`);
      }
    );
    setSelectedLeads(new Set()); setBulkAgent(""); loadData();
  };

  const assignSilver = async (leadId: string, agentId: string) => {
    await executeOrRequestApproval(
      "lead_assign",
      { leadId, agentId, type: "silver" },
      isBn ? "সিলভার এজেন্ট অ্যাসাইন" : "Silver agent assignment",
      async () => {
        const tlId = getEffectiveTlId();
        await supabase.from("leads").update({ assigned_to: agentId, status: "assigned", tl_id: tlId }).eq("id", leadId);
        toast.success(isBn ? "Silver agent assign হয়েছে" : "Silver agent assigned");
      }
    );
    loadData();
  };

  const assignProcessing = async (leadId: string, agentId: string) => {
    await executeOrRequestApproval(
      "lead_assign",
      { leadId, agentId, type: "processing" },
      isBn ? "প্রসেসিং ডাটা অ্যাসাইন" : "Processing data assignment",
      async () => {
        await supabase.from("leads").update({ assigned_to: agentId, status: "processing_assigned" }).eq("id", leadId);
        toast.success(isBn ? "Processing data assign হয়েছে" : "Processing data assigned");
      }
    );
    loadData();
  };

  const convertPreOrder = async (po: PreOrder) => {
    if (!po.lead_id) return;
    await executeOrRequestApproval(
      "order_action",
      { preOrderId: po.id },
      isBn ? "প্রি-অর্ডার কনভার্ট" : "Convert pre-order",
      async () => {
        await supabase.from("pre_orders").update({ status: "converted" }).eq("id", po.id);
        toast.success(isBn ? "Regular order-এ convert হয়েছে" : "Converted");
      }
    );
    loadData();
  };

  const deletePreOrder = async (id: string) => {
    await executeOrRequestApproval(
      "lead_delete",
      { preOrderId: id },
      isBn ? "প্রি-অর্ডার ডিলিট" : "Delete pre-order",
      async () => {
        await supabase.from("pre_orders").update({ status: "deleted" }).eq("id", id);
        toast.success(isBn ? "Pre-order delete হয়েছে" : "Pre-order deleted");
      }
    );
    loadData();
  };

  const confirmDeleteLead = async () => {
    if (!deleteTarget || !user) { setDeleteTarget(null); setDeleteConfirmOpen(false); return; }
    const lead = deleteSheetLeads.find(l => l.id === deleteTarget);
    const { error } = await supabase.from("delete_requests").insert({
      lead_id: deleteTarget,
      requested_by: user.id,
      campaign_id: lead?.campaign_id || selectedCampaign || null,
    } as any);
    if (error) {
      toast.error(isBn ? "ডিলিট রিকোয়েস্ট পাঠানো যায়নি" : "Failed to send delete request");
    } else {
      toast.success(isBn ? "ডিলিট রিকোয়েস্ট SA-তে পাঠানো হয়েছে" : "Delete request sent to SA");
    }
    setDeleteTarget(null); setDeleteConfirmOpen(false);
  };

  const bulkDeleteLeads = async () => {
    if (!user) return;
    const ids = Array.from(selectedDeleteLeads);
    let successCount = 0;
    for (const id of ids) {
      const lead = deleteSheetLeads.find(l => l.id === id);
      const { error } = await supabase.from("delete_requests").insert({
        lead_id: id,
        requested_by: user.id,
        campaign_id: lead?.campaign_id || selectedCampaign || null,
      } as any);
      if (!error) successCount++;
    }
    toast.success(isBn ? `${successCount}টি ডিলিট রিকোয়েস্ট SA-তে পাঠানো হয়েছে` : `${successCount} delete requests sent to SA`);
    setSelectedDeleteLeads(new Set());
  };

  const reassignLead = async (leadId: string, agentId: string) => {
    await executeOrRequestApproval(
      "lead_assign",
      { leadId, agentId, type: "reassign" },
      isBn ? "লিড রিঅ্যাসাইন" : "Lead reassignment",
      async () => {
        await supabase.from("leads").update({ assigned_to: agentId, status: "assigned", requeue_count: 0 }).eq("id", leadId);
        toast.success(isBn ? "Lead reassign হয়েছে" : "Lead reassigned");
      }
    );
    loadData();
  };

  const isProcessing = campaignMode === "processing";

  // Filter campaigns by the active data mode tab
  const filteredCampaignsByMode = useMemo(() => {
    return campaigns.filter(c => c.data_mode === activeDataModeTab);
  }, [campaigns, activeDataModeTab]);

  // Auto-select first campaign when mode tab changes
  useEffect(() => {
    const filtered = campaigns.filter(c => c.data_mode === activeDataModeTab);
    if (filtered.length > 0 && !filtered.some(c => c.id === selectedCampaign)) {
      setSelectedCampaign(filtered[0].id);
    } else if (filtered.length === 0) {
      setSelectedCampaign("");
    }
  }, [activeDataModeTab, campaigns]);


  const filteredFresh = useMemo(() => {
    if (tierFilter === "lead") return freshLeads.filter(l => !l.agent_type || l.agent_type === "");
    if (tierFilter === "bronze") return freshLeads.filter(l => l.agent_type === "bronze");
    return freshLeads;
  }, [freshLeads, tierFilter]);

  // Parse product/price from special_note JSON
  const parseProductPrice = useCallback((note: string | null | undefined): { product?: string; price?: string } => {
    if (!note) return {};
    try {
      const parsed = JSON.parse(note);
      const flat: Record<string, unknown> = {};
      if (parsed.extra_fields && typeof parsed.extra_fields === "object") {
        Object.assign(flat, parsed.extra_fields);
      }
      Object.assign(flat, parsed);
      const product = flat.product || flat.product_name || flat.item_name || flat.products || "";
      const price = flat.price || flat.total || flat.amount || flat.order_total || "";
      return {
        product: product ? String(product) : undefined,
        price: price ? String(price) : undefined,
      };
    } catch { return {}; }
  }, []);

  const hasProductInfo = useMemo(() => {
    return freshLeads.some(l => {
      const info = parseProductPrice(l.special_note);
      return info.product || info.price;
    });
  }, [freshLeads, parseProductPrice]);


  if (!user) return null;

  // Reusable Data Send UI
  const renderDataSendSection = () => (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg font-heading flex items-center gap-2">
          <Send className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          {isBn ? "ডাটা পাঠান" : "Send Data"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{isBn ? "ক্যাম্পেইন" : "Campaign"}</label>
            <Select value={selectedCampaign} onValueChange={(v) => { setSelectedCampaign(v); setDistAgent(""); setSendCount(""); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={isBn ? "ক্যাম্পেইন নির্বাচন" : "Select Campaign"} /></SelectTrigger>
              <SelectContent>{filteredCampaignsByMode.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {activeSection === "cso" ? (isBn ? "CSO" : "CSO") : activeSection === "silver" ? (isBn ? "সিলভার এজেন্ট" : "Silver Agent") : activeSection === "golden" ? (isBn ? "গোল্ডেন এজেন্ট" : "Golden Agent") : (isBn ? "এজেন্ট" : "Agent")}
            </label>
            <Select value={distAgent} onValueChange={setDistAgent} disabled={activeSection !== "cso" && !selectedCampaign}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={activeSection === "cso" ? (isBn ? "CSO নির্বাচন" : "Select CSO") : (isBn ? "এজেন্ট নির্বাচন" : "Select Agent")} /></SelectTrigger>
              <SelectContent>{distAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {isBn ? "সংখ্যা" : "Count"}
              {selectedCampaign && <span className="ml-1 text-primary">({isBn ? `${availableCount} টি পাওয়া যাচ্ছে` : `${availableCount} available`})</span>}
            </label>
            <Input type="number" min={1} max={availableCount} value={sendCount} onChange={(e) => setSendCount(e.target.value)} placeholder={isBn ? "কয়টি পাঠাবেন" : "How many"} className="h-9 text-sm" disabled={!distAgent} />
          </div>
          <Button onClick={handleSendData} disabled={!selectedCampaign || !distAgent || !sendCount || sending} className="h-9 gap-2">
            {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isBn ? "পাঠান" : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Mobile card renderer for leads
  const renderLeadCard = (lead: Lead, i: number, options?: { showCheckbox?: boolean; showType?: boolean; showProduct?: boolean }) => {
    const noteInfo = options?.showProduct ? parseProductPrice(lead.special_note) : {};
    return (
      <div key={lead.id} className="border border-border rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {options?.showCheckbox && (
              <Checkbox checked={selectedLeads.has(lead.id)}
                onCheckedChange={(v) => { const next = new Set(selectedLeads); v ? next.add(lead.id) : next.delete(lead.id); setSelectedLeads(next); }} />
            )}
            <span className="text-xs text-muted-foreground">#{i + 1}</span>
            {options?.showType && (
              <Badge variant="outline" className={`text-[10px] ${lead.agent_type === "bronze" ? "border-orange-400 text-orange-500" : "border-blue-400 text-blue-500"}`}>
                {lead.agent_type === "bronze" ? "Bronze" : "Lead"}
              </Badge>
            )}
          </div>
          {noteInfo.price && (
            <span className="text-xs font-semibold text-primary">৳{noteInfo.price}</span>
          )}
        </div>
        <div className="font-medium text-sm">{lead.name || "—"}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{lead.phone || "—"}</span>
          {lead.phone && <CopyButton text={lead.phone} />}
        </div>
        {lead.address && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="truncate">{lead.address}</span>
            <CopyButton text={lead.address} />
          </div>
        )}
        {noteInfo.product && (
          <div className="text-xs">
            <span className="text-muted-foreground">{isBn ? "পণ্য:" : "Product:"}</span>{" "}
            <span className="text-foreground font-medium">{noteInfo.product}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}</div>
      </div>
    );
  };

  // Render content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case "assign": {
        return (
          <div className="space-y-4">
            {/* ====== DATA SEND SECTION ====== */}
            {renderDataSendSection()}

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg font-heading">{isBn ? "ফ্রেশ ডাটা — Agent-এ Assign করুন" : "Fresh Data — Assign to Agents"}</CardTitle>
                <Button variant="outline" size="sm" onClick={() => { loadAgents(); loadData(); }} className="gap-2 w-fit">
                  <RefreshCw className="h-4 w-4" /> {isBn ? "রিফ্রেশ" : "Refresh"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-full sm:w-44 border-primary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isBn ? "সব ডাটা" : "All Data"} ({freshLeads.length})</SelectItem>
                    <SelectItem value="lead">{isBn ? "লিড (নতুন)" : "Lead (New)"} ({freshLeads.filter(l => !l.agent_type || l.agent_type === "").length})</SelectItem>
                    <SelectItem value="bronze">{isBn ? "ব্রোঞ্জ" : "Bronze"} ({freshLeads.filter(l => l.agent_type === "bronze").length})</SelectItem>
                  </SelectContent>
                </Select>

                {selectedLeads.size > 0 && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <span className="text-sm text-muted-foreground">{selectedLeads.size} {isBn ? "টি নির্বাচিত" : "selected"}</span>
                    <Select value={bulkAgent} onValueChange={setBulkAgent}>
                      <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={isBn ? "Agent নির্বাচন" : "Select Agent"} /></SelectTrigger>
                      <SelectContent>{bronzeAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button onClick={bulkAssign} disabled={!bulkAgent} className="bg-primary text-primary-foreground">Apply</Button>
                  </div>
                )}
              </div>
              {/* Show HR configured dynamic columns */}
              {dynamicColumns.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-xs text-muted-foreground">{isBn ? "HR কনফিগ:" : "HR Config:"}</span>
                  {dynamicColumns.map(col => (
                    <Badge key={col.id} variant="outline" className="text-xs">
                      {isBn ? col.name_bn || col.name : col.name}
                      {col.type === "dropdown" ? ` (${col.options.length})` : " 📝"}
                    </Badge>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isMobile ? (
                <div className="space-y-3">
                  {filteredFresh.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{isBn ? "কোনো নতুন ডাটা নেই" : "No fresh data"}</p>
                  ) : filteredFresh.map((lead, i) => renderLeadCard(lead, i, { showCheckbox: true, showType: true, showProduct: true }))}
                </div>
              ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={selectedLeads.size === filteredFresh.length && filteredFresh.length > 0}
                          onCheckedChange={(v) => setSelectedLeads(v ? new Set(filteredFresh.map(l => l.id)) : new Set())} />
                      </TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>{isBn ? "টাইপ" : "Type"}</TableHead>
                      <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead>{isBn ? "শহর" : "City"}</TableHead>
                      {hasProductInfo && (
                        <>
                          <TableHead>{isBn ? "পণ্য" : "Product"}</TableHead>
                          <TableHead>{isBn ? "মূল্য" : "Price"}</TableHead>
                        </>
                      )}
                      <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFresh.length === 0 ? (
                      <TableRow><TableCell colSpan={hasProductInfo ? 9 : 7} className="text-center text-muted-foreground py-8">{isBn ? "কোনো নতুন ডাটা নেই" : "No fresh data"}</TableCell></TableRow>
                    ) : filteredFresh.map((lead, i) => {
                      const noteInfo = parseProductPrice(lead.special_note);
                      return (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Checkbox checked={selectedLeads.has(lead.id)}
                            onCheckedChange={(v) => { const next = new Set(selectedLeads); v ? next.add(lead.id) : next.delete(lead.id); setSelectedLeads(next); }} />
                        </TableCell>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${lead.agent_type === "bronze" ? "border-orange-400 text-orange-500" : "border-blue-400 text-blue-500"}`}>
                            {lead.agent_type === "bronze" ? "Bronze" : "Lead"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                        <TableCell>{lead.phone || "—"}</TableCell>
                        <TableCell>{lead.address || "—"}</TableCell>
                        {hasProductInfo && (
                          <>
                            <TableCell className="text-xs font-medium">{noteInfo.product || "—"}</TableCell>
                            <TableCell className="text-xs font-medium">{noteInfo.price ? `৳${noteInfo.price}` : "—"}</TableCell>
                          </>
                        )}
                        <TableCell>{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              )}
            </CardContent>
           </Card>
          </div>
        );
      }

      case "processing":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg font-heading">
                {isBn ? "প্রসেসিং ডাটা — যেকোনো Agent-কে assign করুন" : "Processing Data — Assign to any Agent"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isMobile ? (
                <div className="space-y-3">
                  {processingLeads.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{isBn ? "কোনো প্রসেসিং ডাটা নেই" : "No processing data"}</p>
                  ) : processingLeads.map((lead, i) => renderLeadCard(lead, i))}
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                    <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                    <TableHead>{isBn ? "ঠিকানা" : "Address"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processingLeads.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{isBn ? "কোনো প্রসেসিং ডাটা নেই" : "No processing data"}</TableCell></TableRow>
                  ) : processingLeads.map((lead, i) => (
                    <TableRow key={lead.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                      <TableCell>{lead.phone || "—"}</TableCell>
                      <TableCell>{lead.address || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
        );

      case "agent_activity":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg font-heading">
                {isBn ? "এজেন্ট কার্যক্রম — HR কনফিগ সহ" : "Agent Activity — With HR Config"}
              </CardTitle>
              <div className="flex flex-wrap gap-2 pt-2">
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={isBn ? "এজেন্ট ফিল্টার" : "Filter Agent"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isBn ? "সব এজেন্ট" : "All Agents"}</SelectItem>
                    {allAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={isBn ? "স্ট্যাটাস ফিল্টার" : "Filter Status"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isBn ? "সব স্ট্যাটাস" : "All Statuses"}</SelectItem>
                    {Object.entries(statusLabelMap).map(([val, info]) => (
                      <SelectItem key={val} value={val}>{isBn ? (info.label_bn || info.label) : info.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {dynamicColumns.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground">{isBn ? "HR কনফিগ কলাম:" : "HR Config:"}</span>
                  {dynamicColumns.map(col => (
                    <Badge key={col.id} variant="outline" className="text-xs">
                      {isBn ? col.name_bn || col.name : col.name}
                      {col.type === "dropdown" ? ` (${col.options.length})` : " 📝"}
                    </Badge>
                  ))}
                </div>
              )}
              {(() => {
                let filtered = agentLeads;
                if (agentFilter !== "all") filtered = filtered.filter((l: any) => l.assigned_to === agentFilter);
                if (statusFilter !== "all") filtered = filtered.filter(l => l.status === statusFilter);
                if (filtered.length === 0) return <p className="text-center text-muted-foreground py-8">{isBn ? "কোনো এজেন্ট লিড নেই" : "No agent leads found"}</p>;

                if (isMobile) {
                  return (
                    <div className="space-y-3">
                      {filtered.map((lead: any, i: number) => {
                        const color = getStatusColor(lead.status);
                        return (
                          <div key={lead.id} className="border border-border rounded-lg p-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">#{i + 1}</span>
                              <Badge variant="outline" style={color ? { borderColor: color, color } : {}}>
                                {getStatusLabel(lead.status)}
                              </Badge>
                            </div>
                            <div className="text-sm font-medium">{lead.agent_name || "—"}</div>
                            <div className="text-sm">{lead.name || "—"}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{lead.phone || "—"}</span>
                              {lead.phone && <CopyButton text={lead.phone} />}
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{isBn ? "কল" : "Calls"}: {lead.called_time || 0}</span>
                              <span>{lead.updated_at ? new Date(lead.updated_at).toLocaleString() : "—"}</span>
                            </div>
                            {lead.special_note && <div className="text-xs text-muted-foreground truncate">{lead.special_note}</div>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{isBn ? "এজেন্ট" : "Agent"}</TableHead>
                        <TableHead>{isBn ? "কাস্টমার" : "Customer"}</TableHead>
                        <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                        <TableHead>{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                        <TableHead>{isBn ? "কল" : "Calls"}</TableHead>
                        <TableHead>{isBn ? "নোট" : "Note"}</TableHead>
                        <TableHead>{isBn ? "আপডেট" : "Updated"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((lead: any, i: number) => {
                        const color = getStatusColor(lead.status);
                        return (
                          <TableRow key={lead.id}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell className="font-medium">{lead.agent_name || "—"}</TableCell>
                            <TableCell>{lead.name || "—"}</TableCell>
                            <TableCell>{lead.phone || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" style={color ? { borderColor: color, color } : {}}>
                                {getStatusLabel(lead.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{lead.called_time || 0}</TableCell>
                            <TableCell className="max-w-[150px] truncate text-xs">{lead.special_note || "—"}</TableCell>
                            <TableCell className="text-xs">{lead.updated_at ? new Date(lead.updated_at).toLocaleString() : "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        );

      case "cso":
        const handleSendToCso = async (orderId: string) => {
          const { error } = await supabase.from("orders").update({ status: "pending_cso" }).eq("id", orderId);
          if (error) { toast.error("CSO তে পাঠাতে সমস্যা"); return; }
          toast.success("CSO তে পাঠানো হয়েছে ✓");
          loadData();
        };
        const handleSendAllToCso = async () => {
          if (csoOrders.length === 0) return;
          const ids = csoOrders.map(o => o.id);
          const { error } = await supabase.from("orders").update({ status: "pending_cso" }).in("id", ids);
          if (error) { toast.error("সমস্যা হয়েছে"); return; }
          toast.success(`${ids.length}টি অর্ডার CSO তে পাঠানো হয়েছে ✓`);
          loadData();
        };
        return (
          <div className="space-y-4">
            {renderDataSendSection()}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base sm:text-lg font-heading">{isBn ? "পেন্ডিং অর্ডার (TL রিভিউ)" : "Pending Orders (TL Review)"}</CardTitle>
              </CardHeader>
            <CardContent>
              {isMobile ? (
                <div className="space-y-3">
                  {csoOrders.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{isBn ? "কোনো pending order নেই" : "No pending orders"}</p>
                  ) : csoOrders.map((o) => (
                    <div key={o.id} className="border border-border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</span>
                        <span className="text-xs font-medium">৳{(o as any).price || 0}</span>
                      </div>
                      <div className="font-medium text-sm">{o.customer_name || "—"}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{o.phone || "—"}</span>
                        {o.phone && <CopyButton text={o.phone} />}
                      </div>
                      <div className="text-xs">{o.product || "—"} × {(o as any).quantity || 1}</div>
                      <div className="text-xs text-muted-foreground truncate">{(o as any).address || "—"}</div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{(o as any).district || "—"}</span>
                        <span>{(o as any).agent?.name || "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>{isBn ? "গ্রাহক" : "Customer"}</TableHead>
                    <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                    <TableHead>{isBn ? "পণ্য" : "Product"}</TableHead>
                    <TableHead>{isBn ? "পরিমাণ" : "Qty"}</TableHead>
                    <TableHead>{isBn ? "মূল্য" : "Price"}</TableHead>
                    <TableHead>{isBn ? "ঠিকানা" : "Address"}</TableHead>
                    <TableHead>{isBn ? "জেলা" : "District"}</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>{isBn ? "সময়" : "Time"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csoOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">{isBn ? "কোনো pending order নেই" : "No pending orders"}</TableCell></TableRow>
                  ) : csoOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                      <TableCell>{o.customer_name || "—"}</TableCell>
                      <TableCell>{o.phone || "—"}</TableCell>
                      <TableCell>{o.product || "—"}</TableCell>
                      <TableCell>{(o as any).quantity || 1}</TableCell>
                      <TableCell>৳{(o as any).price || 0}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs">{(o as any).address || "—"}</TableCell>
                      <TableCell>{(o as any).district || "—"}</TableCell>
                      <TableCell>{(o as any).agent?.name || "—"}</TableCell>
                      <TableCell className="text-xs">{o.created_at ? new Date(o.created_at).toLocaleString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
           </Card>
          </div>
        );

      case "calldone":
        return (
          <Card>
            <CardHeader><CardTitle className="text-base sm:text-lg font-heading">Call Done Queue</CardTitle></CardHeader>
            <CardContent>
              {isMobile ? (
                <div className="space-y-3">
                  {callDoneOrders.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{isBn ? "কোনো call done order নেই" : "No call done orders"}</p>
                  ) : callDoneOrders.map((o) => (
                    <div key={o.id} className="border border-border rounded-lg p-3 space-y-1.5">
                      <div className="font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</div>
                      <div className="font-medium text-sm">{o.customer_name || "—"}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{o.phone || "—"}</span>
                        {o.phone && <CopyButton text={o.phone} />}
                      </div>
                      <div className="text-xs">{o.product || "—"}</div>
                      {o.cs_note && <div className="text-xs"><span className="text-muted-foreground">CS:</span> {o.cs_note}</div>}
                      {o.cs_rating && <Badge variant="outline" className="text-xs">{o.cs_rating}</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>{isBn ? "গ্রাহক" : "Customer"}</TableHead>
                    <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                    <TableHead>{isBn ? "পণ্য" : "Product"}</TableHead>
                    <TableHead>CS Note</TableHead>
                    <TableHead>CS Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callDoneOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{isBn ? "কোনো call done order নেই" : "No call done orders"}</TableCell></TableRow>
                  ) : callDoneOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                      <TableCell>{o.customer_name || "—"}</TableCell>
                      <TableCell>{o.phone || "—"}</TableCell>
                      <TableCell>{o.product || "—"}</TableCell>
                      <TableCell>{o.cs_note || "—"}</TableCell>
                      <TableCell>{o.cs_rating || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                {isBn ? "💡 Call Done হওয়ার পর ডাটা স্বয়ংক্রিয়ভাবে Silver/Golden ট্যাবে চলে যায়" : "💡 After Call Done, data auto-progresses to Silver/Golden tabs"}
              </p>
            </CardContent>
          </Card>
        );

      case "preorders":
        return (
          <Card>
            <CardHeader><CardTitle className="text-base sm:text-lg font-heading">Pre-Orders</CardTitle></CardHeader>
            <CardContent>
              {isMobile ? (
                <div className="space-y-3">
                  {preOrders.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{isBn ? "কোনো pre-order নেই" : "No pre-orders"}</p>
                  ) : preOrders.map((po) => (
                    <div key={po.id} className="border border-border rounded-lg p-3 space-y-1.5">
                      <div className="font-medium text-sm">{(po as any).lead?.name || "—"}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{(po as any).lead?.phone || "—"}</span>
                        {(po as any).lead?.phone && <CopyButton text={(po as any).lead.phone} />}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{po.scheduled_date || "—"}</span>
                        <span>{(po as any).agent?.name || "—"}</span>
                      </div>
                      {po.note && <div className="text-xs text-muted-foreground truncate">{po.note}</div>}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => convertPreOrder(po)} className="flex-1 border-primary text-primary hover:bg-primary/10 text-xs">Convert</Button>
                        <Button size="sm" variant="outline" onClick={() => deletePreOrder(po.id)} className="flex-1 border-destructive text-destructive hover:bg-destructive/10 text-xs">Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isBn ? "গ্রাহক" : "Customer"}</TableHead>
                    <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                    <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>{isBn ? "নোট" : "Note"}</TableHead>
                    <TableHead>{isBn ? "অ্যাকশন" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{isBn ? "কোনো pre-order নেই" : "No pre-orders"}</TableCell></TableRow>
                  ) : preOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell>{(po as any).lead?.name || "—"}</TableCell>
                      <TableCell>{(po as any).lead?.phone || "—"}</TableCell>
                      <TableCell>{po.scheduled_date || "—"}</TableCell>
                      <TableCell>{(po as any).agent?.name || "—"}</TableCell>
                      <TableCell className="max-w-48 truncate">{po.note || "—"}</TableCell>
                      <TableCell className="space-x-2">
                        <Button size="sm" variant="outline" onClick={() => convertPreOrder(po)} className="border-primary text-primary hover:bg-primary/10">Convert</Button>
                        <Button size="sm" variant="outline" onClick={() => deletePreOrder(po.id)} className="border-destructive text-destructive hover:bg-destructive/10">Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
        );

      case "silver":
        return (
          <div className="space-y-4">
            {renderDataSendSection()}
            <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg font-heading">
                🥈 {isBn ? "সিলভার ডাটা — সিলভার এজেন্টে অ্যাসাইন করুন" : "Silver Data — Assign to Silver Agents"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isBn ? "ব্রোঞ্জ অর্ডার ডেলিভার ও CS Call Done হওয়ার পর স্বয়ংক্রিয়ভাবে এখানে আসে" : "Auto-arrives after Bronze order delivered & CS Call Done"}
              </p>
            </CardHeader>
            <CardContent>
              {isMobile ? (
                <div className="space-y-3">
                  {silverData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{isBn ? "কোনো সিলভার ডাটা নেই" : "No silver data"}</p>
                  ) : silverData.map((item, i) => (
                    <div key={item.id} className="border border-border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{i + 1}</span>
                      </div>
                      <div className="font-medium text-sm">{item.name || "—"}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.phone || "—"}</span>
                        {item.phone && <CopyButton text={item.phone} />}
                      </div>
                      {item.address && <div className="text-xs text-muted-foreground truncate">{item.address}</div>}
                      <div className="text-xs text-muted-foreground">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</div>
                    </div>
                  ))}
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                    <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                    <TableHead>{isBn ? "ঠিকানা" : "Address"}</TableHead>
                    <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {silverData.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {isBn ? "কোনো সিলভার ডাটা নেই" : "No silver data"}
                    </TableCell></TableRow>
                  ) : silverData.map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{item.name || "—"}</TableCell>
                      <TableCell>{item.phone || "—"}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{item.address || "—"}</TableCell>
                      <TableCell>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
          </div>
        );

      case "golden":
        return (
          <div className="space-y-4">
            {renderDataSendSection()}
            <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg font-heading">
                🥇 {isBn ? "গোল্ডেন ডাটা" : "Golden Data"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isBn ? "সিলভার অর্ডার ডেলিভার ও CS Call Done হওয়ার পর স্বয়ংক্রিয়ভাবে এখানে আসে" : "Auto-arrives after Silver orders delivered & CS Call Done"}
              </p>
            </CardHeader>
            <CardContent>
              {isMobile ? (
                <div className="space-y-3">
                  {goldenData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{isBn ? "কোনো গোল্ডেন ডাটা নেই" : "No golden data yet"}</p>
                  ) : goldenData.map((item, i) => (
                    <div key={item.id} className="border border-border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{i + 1}</span>
                        {item.source && <Badge variant="outline" className="text-[10px]">{item.source}</Badge>}
                      </div>
                      <div className="font-medium text-sm">{item.name || "—"}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.phone || "—"}</span>
                        {item.phone && <CopyButton text={item.phone} />}
                      </div>
                      {item.address && <div className="text-xs text-muted-foreground truncate">{item.address}</div>}
                      <div className="text-xs text-muted-foreground">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</div>
                    </div>
                  ))}
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                    <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                    <TableHead>{isBn ? "ঠিকানা" : "Address"}</TableHead>
                    <TableHead>{isBn ? "সোর্স" : "Source"}</TableHead>
                    <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goldenData.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {isBn ? "কোনো গোল্ডেন ডাটা নেই" : "No golden data yet"}
                    </TableCell></TableRow>
                  ) : goldenData.map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{item.name || "—"}</TableCell>
                      <TableCell>{item.phone || "—"}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{item.address || "—"}</TableCell>
                      <TableCell>{item.source || "—"}</TableCell>
                      <TableCell>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
          </div>
        );

      case "deletesheet":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg font-heading">
                {isBn ? "ডিলিট শিট" : "Delete Sheet"}
                <span className="text-xs text-muted-foreground ml-2">
                  ({isBn ? `${deleteSheetThreshold}+ বার requeue হলে এখানে আসে` : `${deleteSheetThreshold}+ requeues`})
                </span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isBn ? "ডিলিট রিকোয়েস্ট SA এপ্রুভ করলে মুছে যাবে" : "Delete requests need SA approval"}
              </p>
              {selectedDeleteLeads.size > 0 && (
                <Button size="sm" variant="destructive" onClick={bulkDeleteLeads} className="mt-2 w-fit">
                  {isBn ? `ডিলিট রিকোয়েস্ট (${selectedDeleteLeads.size})` : `Request Delete (${selectedDeleteLeads.size})`}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isMobile ? (
                <div className="space-y-3">
                  {deleteSheetLeads.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{isBn ? "কোনো delete sheet lead নেই" : "No delete sheet leads"}</p>
                  ) : deleteSheetLeads.map((lead) => (
                    <div key={lead.id} className="border border-border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={selectedDeleteLeads.has(lead.id)}
                          onCheckedChange={(v) => { const next = new Set(selectedDeleteLeads); v ? next.add(lead.id) : next.delete(lead.id); setSelectedDeleteLeads(next); }} />
                        <span className="font-medium text-sm">{lead.name || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{lead.phone || "—"}</span>
                        {lead.phone && <CopyButton text={lead.phone} />}
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant="outline">{getStatusLabel(lead.status)}</Badge>
                        <span className="text-xs text-muted-foreground">Requeue: {lead.requeue_count}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{lead.source || "—"} • {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "—"}</div>
                      <div className="flex gap-2 pt-1">
                        <Select onValueChange={(agentId) => reassignLead(lead.id, agentId)}>
                          <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Reassign" /></SelectTrigger>
                          <SelectContent>{allAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" variant="destructive" onClick={() => { setDeleteTarget(lead.id); setDeleteConfirmOpen(true); }} className="text-xs h-8">
                          {isBn ? "ডিলিট" : "Delete"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={selectedDeleteLeads.size === deleteSheetLeads.length && deleteSheetLeads.length > 0}
                        onCheckedChange={(v) => setSelectedDeleteLeads(v ? new Set(deleteSheetLeads.map(l => l.id)) : new Set())} />
                    </TableHead>
                    <TableHead>{isBn ? "গ্রাহক" : "Customer"}</TableHead>
                    <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requeue</TableHead>
                    <TableHead>{isBn ? "ওয়েবসাইট" : "Website"}</TableHead>
                    <TableHead>{isBn ? "শেষ Activity" : "Last Activity"}</TableHead>
                    <TableHead>{isBn ? "অ্যাকশন" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deleteSheetLeads.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{isBn ? "কোনো delete sheet lead নেই" : "No delete sheet leads"}</TableCell></TableRow>
                  ) : deleteSheetLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox checked={selectedDeleteLeads.has(lead.id)}
                          onCheckedChange={(v) => { const next = new Set(selectedDeleteLeads); v ? next.add(lead.id) : next.delete(lead.id); setSelectedDeleteLeads(next); }} />
                      </TableCell>
                      <TableCell>{lead.name || "—"}</TableCell>
                      <TableCell>{lead.phone || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{getStatusLabel(lead.status)}</Badge></TableCell>
                      <TableCell className="text-center">{lead.requeue_count}</TableCell>
                      <TableCell className="text-xs">{lead.source || "—"}</TableCell>
                      <TableCell>{lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="space-x-2">
                        <Select onValueChange={(agentId) => reassignLead(lead.id, agentId)}>
                          <SelectTrigger className="w-36 inline-flex"><SelectValue placeholder="Reassign" /></SelectTrigger>
                          <SelectContent>{allAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" variant="destructive" onClick={() => { setDeleteTarget(lead.id); setDeleteConfirmOpen(true); }}>
                          {isBn ? "ডিলিট রিকোয়েস্ট" : "Request Delete"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <FraudChecker />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
          {isBn ? "Lead Management" : "Lead Management"}
        </h2>
      </div>

      {/* Lead/Processing + Campaign selectors side by side */}
      <div className="flex flex-row items-center gap-2 flex-wrap">
        <Select value={activeDataModeTab} onValueChange={(v) => setActiveDataModeTab(v as "lead" | "processing")}>
          <SelectTrigger className="w-40 sm:w-48 border-primary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">🎯 {isBn ? "লিড" : "Lead"} ({campaigns.filter(c => c.data_mode === "lead").length})</SelectItem>
            <SelectItem value="processing">⚙️ {isBn ? "প্রসেসিং" : "Processing"} ({campaigns.filter(c => c.data_mode === "processing").length})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-40 sm:w-52 border-primary/30">
            <SelectValue placeholder={isBn ? "Campaign নির্বাচন" : "Select Campaign"} />
          </SelectTrigger>
          <SelectContent>
            {filteredCampaignsByMode.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {renderContent()}

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{isBn ? "নিশ্চিত করুন" : "Confirm Delete"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{isBn ? "এই lead স্থায়ীভাবে delete হবে। আপনি কি নিশ্চিত?" : "This lead will be permanently deleted. Are you sure?"}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>{isBn ? "বাতিল" : "Cancel"}</Button>
            <Button variant="destructive" onClick={confirmDeleteLead}>{isBn ? "Delete" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TLLeads;