import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useATLApproval } from "@/hooks/useATLApproval";
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

interface Agent { id: string; name: string; }
interface Lead { id: string; name: string | null; phone: string | null; address: string | null; created_at: string | null; status: string | null; requeue_count: number | null; updated_at: string | null; special_note?: string | null; assigned_to?: string | null; called_time?: number | null; agent_type?: string | null; }
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
  const { isATL, executeOrRequestApproval } = useATLApproval();

  const [campaigns, setCampaigns] = useState<{ id: string; name: string; data_mode: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [campaignMode, setCampaignMode] = useState<string>("lead");
  const [bronzeAgents, setBronzeAgents] = useState<Agent[]>([]);
  const [silverAgents, setSilverAgents] = useState<Agent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);

  const [freshLeads, setFreshLeads] = useState<Lead[]>([]);
  const [csoOrders, setCsoOrders] = useState<Order[]>([]);
  const [callDoneOrders, setCallDoneOrders] = useState<Order[]>([]);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [deleteSheetLeads, setDeleteSheetLeads] = useState<Lead[]>([]);
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

    if (isBDO) {
      freshQ = freshQ.or("agent_type.is.null,agent_type.eq.bronze");
    } else {
      const tlId = getEffectiveTlId();
      freshQ = freshQ.or(
        `and(agent_type.is.null,tl_id.eq.${tlId}),and(agent_type.eq.bronze,tl_id.eq.${tlId}),and(agent_type.is.null,tl_id.is.null),and(agent_type.eq.bronze,tl_id.is.null)`,
      );
    }

    const { data: fresh } = await freshQ;
    setFreshLeads(fresh || []);

    let csoQ = supabase.from("orders").select("*, agent:users!orders_agent_id_fkey(name)")
      .eq("status", "pending_cso").order("created_at", { ascending: false });
    if (!isBDO) csoQ = csoQ.eq("tl_id", getEffectiveTlId());
    const { data: cso } = await csoQ;
    setCsoOrders(cso || []);

    let callDoneQ = supabase.from("orders").select("*, agent:users!orders_agent_id_fkey(name)")
      .eq("status", "call_done").order("created_at", { ascending: false });
    if (!isBDO) callDoneQ = callDoneQ.eq("tl_id", getEffectiveTlId());
    const { data: callDone } = await callDoneQ;
    setCallDoneOrders(callDone || []);

    let preQ = supabase.from("pre_orders").select("*, lead:leads(name, phone), agent:users!pre_orders_agent_id_fkey(name)")
      .eq("status", "pending").order("created_at", { ascending: false });
    if (!isBDO) preQ = preQ.eq("tl_id", getEffectiveTlId());
    const { data: pre } = await preQ;
    setPreOrders(pre || []);

    let delQ = supabase.from("leads").select("*")
      .eq("campaign_id", selectedCampaign)
      .gte("requeue_count", 5).order("updated_at", { ascending: false });
    if (!isBDO) delQ = delQ.eq("tl_id", getEffectiveTlId());
    const { data: del } = await delQ;
    setDeleteSheetLeads(del || []);

    if (campaignMode === "processing") {
      let procQ = supabase.from("leads").select("*")
        .eq("campaign_id", selectedCampaign)
        .is("assigned_to", null).order("created_at", { ascending: false });
      if (!isBDO) procQ = procQ.eq("tl_id", getEffectiveTlId());
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
    if (!isBDO) silverQ = silverQ.is("tl_id", null); // Silver leads have tl_id cleared by progress_lead_after_cs, but campaign_id remains
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
  }, [user, selectedCampaign, campaignMode, getEffectiveTlId]);

  useEffect(() => { loadAgents(); loadData(); }, [loadAgents, loadData]);

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
    if (deleteTarget) {
      await executeOrRequestApproval(
        "lead_delete",
        { leadId: deleteTarget },
        isBn ? "লিড ডিলিট" : "Delete lead",
        async () => {
          await supabase.from("leads").delete().eq("id", deleteTarget);
          toast.success(isBn ? "Lead delete হয়েছে" : "Lead deleted");
        }
      );
    }
    setDeleteTarget(null); setDeleteConfirmOpen(false); loadData();
  };

  const bulkDeleteLeads = async () => {
    const ids = Array.from(selectedDeleteLeads);
    await executeOrRequestApproval(
      "lead_delete",
      { leadIds: ids },
      isBn ? `${ids.length}টি লিড বাল্ক ডিলিট` : `Bulk delete ${ids.length} leads`,
      async () => {
        for (const id of ids) { await supabase.from("leads").delete().eq("id", id); }
        toast.success(isBn ? `${ids.length}টি lead delete হয়েছে` : `${ids.length} leads deleted`);
      }
    );
    setSelectedDeleteLeads(new Set()); loadData();
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

  // Parse dynamic columns from special_note JSON for fresh leads table
  const specialNoteKeys = useMemo(() => {
    const keys = new Set<string>();
    freshLeads.forEach(l => {
      if (l.special_note) {
        try {
          const parsed = JSON.parse(l.special_note);
          if (parsed && typeof parsed === "object") {
            Object.keys(parsed).forEach(k => keys.add(k));
          }
        } catch {}
      }
    });
    return Array.from(keys);
  }, [freshLeads]);

  const filteredFresh = useMemo(() => {
    if (tierFilter === "lead") return freshLeads.filter(l => !l.agent_type || l.agent_type === "");
    if (tierFilter === "bronze") return freshLeads.filter(l => l.agent_type === "bronze");
    return freshLeads;
  }, [freshLeads, tierFilter]);

  const getSpecialNoteValue = useCallback((lead: Lead, key: string) => {
    if (!lead.special_note) return "—";
    try {
      const parsed = JSON.parse(lead.special_note);
      return parsed?.[key] ?? "—";
    } catch { return "—"; }
  }, []);

  if (!user) return null;

  // Render content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case "assign": {
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">{isBn ? "ফ্রেশ ডাটা — Agent-এ Assign করুন" : "Fresh Data — Assign to Agents"}</CardTitle>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {/* Tier filter */}
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-44 border-primary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isBn ? "সব ডাটা" : "All Data"} ({freshLeads.length})</SelectItem>
                    <SelectItem value="lead">{isBn ? "লিড (নতুন)" : "Lead (New)"} ({freshLeads.filter(l => !l.agent_type || l.agent_type === "").length})</SelectItem>
                    <SelectItem value="bronze">{isBn ? "ব্রোঞ্জ" : "Bronze"} ({freshLeads.filter(l => l.agent_type === "bronze").length})</SelectItem>
                  </SelectContent>
                </Select>

                {selectedLeads.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">{selectedLeads.size} {isBn ? "টি নির্বাচিত" : "selected"}</span>
                    <Select value={bulkAgent} onValueChange={setBulkAgent}>
                      <SelectTrigger className="w-48"><SelectValue placeholder={isBn ? "Agent নির্বাচন" : "Select Agent"} /></SelectTrigger>
                      <SelectContent>{bronzeAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button onClick={bulkAssign} disabled={!bulkAgent} className="bg-primary text-primary-foreground">Apply</Button>
                  </>
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
                      {specialNoteKeys.map(key => (
                        <TableHead key={key} className="text-xs">{key}</TableHead>
                      ))}
                      <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                      <TableHead>Assign To</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFresh.length === 0 ? (
                      <TableRow><TableCell colSpan={9 + specialNoteKeys.length} className="text-center text-muted-foreground py-8">{isBn ? "কোনো নতুন ডাটা নেই" : "No fresh data"}</TableCell></TableRow>
                    ) : filteredFresh.map((lead, i) => (
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
                        {specialNoteKeys.map(key => (
                          <TableCell key={key} className="text-xs max-w-[120px] truncate">{getSpecialNoteValue(lead, key)}</TableCell>
                        ))}
                        <TableCell>{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>
                          <Select value={assignments[lead.id] || ""} onValueChange={(v) => setAssignments(p => ({ ...p, [lead.id]: v }))}>
                            <SelectTrigger className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>{bronzeAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" disabled={!assignments[lead.id]} onClick={() => assignLead(lead.id, assignments[lead.id])} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            {isBn ? "সেন্ড" : "Send"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      }

      case "processing":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">
                {isBn ? "প্রসেসিং ডাটা — যেকোনো Agent-কে assign করুন" : "Processing Data — Assign to any Agent"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                    <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                    <TableHead>{isBn ? "ঠিকানা" : "Address"}</TableHead>
                    <TableHead>Assign To</TableHead>
                    <TableHead></TableHead>
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
                      <TableCell>
                        <Select value={processingAssignments[lead.id] || ""} onValueChange={(v) => setProcessingAssignments(p => ({ ...p, [lead.id]: v }))}>
                          <SelectTrigger className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{allAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" disabled={!processingAssignments[lead.id]} onClick={() => assignProcessing(lead.id, processingAssignments[lead.id])} className="bg-primary text-primary-foreground hover:bg-primary/90">
                          {isBn ? "সেন্ড" : "Send"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case "agent_activity":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">
                {isBn ? "এজেন্ট কার্যক্রম — HR কনফিগ সহ" : "Agent Activity — With HR Config"}
              </CardTitle>
              <div className="flex flex-wrap gap-3 pt-2">
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="w-48"><SelectValue placeholder={isBn ? "এজেন্ট ফিল্টার" : "Filter Agent"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isBn ? "সব এজেন্ট" : "All Agents"}</SelectItem>
                    {allAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48"><SelectValue placeholder={isBn ? "স্ট্যাটাস ফিল্টার" : "Filter Status"} /></SelectTrigger>
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
                  {(() => {
                    let filtered = agentLeads;
                    if (agentFilter !== "all") filtered = filtered.filter((l: any) => l.assigned_to === agentFilter);
                    if (statusFilter !== "all") filtered = filtered.filter(l => l.status === statusFilter);
                    if (filtered.length === 0) return (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {isBn ? "কোনো এজেন্ট লিড নেই" : "No agent leads found"}
                      </TableCell></TableRow>
                    );
                    return filtered.map((lead: any, i: number) => {
                      const color = getStatusColor(lead.status);
                      return (
                        <TableRow key={lead.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{lead.agent_name || "—"}</TableCell>
                          <TableCell>{lead.name || "—"}</TableCell>
                          <TableCell>{lead.phone || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" style={color ? { borderColor: color, color: color } : {}}>
                              {getStatusLabel(lead.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{lead.called_time || 0}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs">{lead.special_note || "—"}</TableCell>
                          <TableCell className="text-xs">{lead.updated_at ? new Date(lead.updated_at).toLocaleString() : "—"}</TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case "cso":
        return (
          <Card>
            <CardHeader><CardTitle className="text-lg font-heading">CSO Pending</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>{isBn ? "গ্রাহক" : "Customer"}</TableHead>
                    <TableHead>{isBn ? "পণ্য" : "Product"}</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>{isBn ? "সময়" : "Time"}</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csoOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{isBn ? "কোনো pending order নেই" : "No pending orders"}</TableCell></TableRow>
                  ) : csoOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                      <TableCell>{o.customer_name || "—"}</TableCell>
                      <TableCell>{o.product || "—"}</TableCell>
                      <TableCell>{(o as any).agent?.name || "—"}</TableCell>
                      <TableCell>{o.created_at ? new Date(o.created_at).toLocaleString() : "—"}</TableCell>
                      <TableCell><Badge className="bg-accent text-accent-foreground">Pending CSO</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case "calldone":
        return (
          <Card>
            <CardHeader><CardTitle className="text-lg font-heading">Call Done Queue</CardTitle></CardHeader>
            <CardContent>
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
              <p className="text-xs text-muted-foreground mt-3">
                {isBn ? "💡 Call Done হওয়ার পর ডাটা স্বয়ংক্রিয়ভাবে Silver/Golden ট্যাবে চলে যায়" : "💡 After Call Done, data auto-progresses to Silver/Golden tabs"}
              </p>
            </CardContent>
          </Card>
        );

      case "preorders":
        return (
          <Card>
            <CardHeader><CardTitle className="text-lg font-heading">Pre-Orders</CardTitle></CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        );

      case "silver":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">
                🥈 {isBn ? "সিলভার ডাটা — সিলভার এজেন্টে অ্যাসাইন করুন" : "Silver Data — Assign to Silver Agents"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isBn ? "ব্রোঞ্জ অর্ডার ডেলিভার ও CS Call Done হওয়ার পর স্বয়ংক্রিয়ভাবে এখানে আসে" : "Auto-arrives after Bronze order delivered & CS Call Done"}
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                    <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                    <TableHead>{isBn ? "ঠিকানা" : "Address"}</TableHead>
                    <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                    <TableHead>Assign To</TableHead>
                    <TableHead></TableHead>
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
                      <TableCell>
                        <Select value={silverAssignments[item.id] || ""} onValueChange={(v) => setSilverAssignments(p => ({ ...p, [item.id]: v }))}>
                          <SelectTrigger className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{silverAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" disabled={!silverAssignments[item.id]} onClick={() => assignSilver(item.id, silverAssignments[item.id])} className="bg-primary text-primary-foreground hover:bg-primary/90">
                          {isBn ? "সেন্ড" : "Send"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case "golden":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">
                🥇 {isBn ? "গোল্ডেন ডাটা" : "Golden Data"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isBn ? "সিলভার অর্ডার ডেলিভার ও CS Call Done হওয়ার পর স্বয়ংক্রিয়ভাবে এখানে আসে" : "Auto-arrives after Silver orders delivered & CS Call Done"}
              </p>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        );

      case "deletesheet":
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">TL Delete Sheet</CardTitle>
              {selectedDeleteLeads.size > 0 && (
                <Button size="sm" variant="destructive" onClick={bulkDeleteLeads} className="mt-2 w-fit">
                  {isBn ? `Delete (${selectedDeleteLeads.size})` : `Delete all (${selectedDeleteLeads.size})`}
                </Button>
              )}
            </CardHeader>
            <CardContent>
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
                    <TableHead>{isBn ? "শেষ Activity" : "Last Activity"}</TableHead>
                    <TableHead>{isBn ? "অ্যাকশন" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deleteSheetLeads.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{isBn ? "কোনো delete sheet lead নেই" : "No delete sheet leads"}</TableCell></TableRow>
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
                      <TableCell>{lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="space-x-2">
                        <Select onValueChange={(agentId) => reassignLead(lead.id, agentId)}>
                          <SelectTrigger className="w-36 inline-flex"><SelectValue placeholder="Reassign" /></SelectTrigger>
                          <SelectContent>{allAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" variant="destructive" onClick={() => { setDeleteTarget(lead.id); setDeleteConfirmOpen(true); }}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {isBn ? "Lead Management" : "Lead Management"}
          </h2>
          {isProcessing && (
            <Badge variant="outline" className="mt-1 border-primary/30 text-primary">
              ⚙️ {isBn ? "প্রসেসিং মোড" : "Processing Mode"}
            </Badge>
          )}
        </div>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-64 border-primary/30">
            <SelectValue placeholder={isBn ? "Campaign নির্বাচন করুন" : "Select Campaign"} />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} {c.data_mode === "processing" ? "⚙️" : "🎯"}
              </SelectItem>
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