import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";


import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, Target, ShoppingCart, Search, Phone, User, Package, Truck,
  MapPin, Clock, ArrowRight, CircleDot, Database, Send,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import CopyButton from "@/components/ui/CopyButton";
import AddressTooltip from "@/components/ui/AddressTooltip";
import LeadRatioBar from "@/components/LeadRatioBar";

const PAGE_SIZE = 50;

// Pipeline position mapping
const getLeadPosition = (lead: any, isBn: boolean): { label: string; color: string; step: number } => {
  const s = lead.status || "fresh";
  if (s === "fresh" && !lead.assigned_to) return { label: isBn ? "TL — অ্যাসাইন হয়নি" : "TL — Unassigned", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", step: 1 };
  if (s === "fresh" || s === "assigned") return { label: isBn ? "এজেন্ট — কল হয়নি" : "Agent — Not Called", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", step: 2 };
  if (["called", "callback", "busy_now", "number_busy", "no_response", "do_not_pick", "customer_reschedule", "call_back_later", "follow_up", "positive"].includes(s))
    return { label: isBn ? "এজেন্ট — ফলো আপ" : "Agent — Follow Up", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", step: 2 };
  if (s === "order_confirmed" || s === "order_confirm") return { label: isBn ? "CSO — রিভিউ পেন্ডিং" : "CSO — Review Pending", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", step: 3 };
  if (s === "pre_order") return { label: isBn ? "প্রি-অর্ডার" : "Pre-Order", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400", step: 2 };
  if (s === "pre_order_confirm") return { label: isBn ? "প্রি-অর্ডার কনফার্ম — CSO পেন্ডিং" : "Pre-Order Confirm — CSO Pending", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400", step: 3 };
  if (["not_interested", "negative", "wrong_number", "duplicate", "cancelled", "already_ordered", "out_of_coverage", "switch_off", "not_reachable", "phone_off"].includes(s))
    return { label: isBn ? "বাদ দেওয়া হয়েছে" : "Dropped", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", step: 0 };
  if (s === "processing_assigned") return { label: isBn ? "এজেন্ট — প্রসেসিং" : "Agent — Processing", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400", step: 2 };
  return { label: s, color: "bg-muted text-muted-foreground", step: 0 };
};

const getOrderPosition = (order: any, isBn: boolean): { label: string; color: string; step: number } => {
  const s = order.status || "pending_cso";
  const ds = order.delivery_status || "pending";
  if (s === "pending_cso") return { label: isBn ? "CSO — অনুমোদন পেন্ডিং" : "CSO — Approval Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", step: 3 };
  if (s === "send_today") return { label: isBn ? "ওয়্যারহাউস — প্যাকিং" : "Warehouse — Packing", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", step: 4 };
  if (s === "dispatched" && ds === "pending") return { label: isBn ? "স্টিডফাস্ট — পিকআপ পেন্ডিং" : "Steadfast — Pickup Pending", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", step: 5 };
  if (ds === "in_transit") return { label: isBn ? "রাইডার — ডেলিভারি চলছে" : "Rider — In Transit", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400", step: 6 };
  if (ds === "delivered") return { label: isBn ? "✅ ডেলিভার্ড" : "✅ Delivered", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", step: 7 };
  if (ds === "returned") return { label: isBn ? "↩ রিটার্নড" : "↩ Returned", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", step: 7 };
  if (s === "call_done") return { label: isBn ? "CS কল সম্পন্ন — Silver পেন্ডিং" : "CS Call Done — Silver Pending", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", step: 8 };
  if (s === "rejected") return { label: isBn ? "❌ প্রত্যাখ্যাত" : "❌ Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", step: 0 };
  return { label: s, color: "bg-muted text-muted-foreground", step: 0 };
};

const statusColorMap: Record<string, string> = {
  fresh: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  assigned: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  called: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  interested: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  not_interested: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  callback: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  order_confirmed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  order_confirm: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  pre_order_confirm: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  processing_assigned: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
};

// Pagination component
const Pagination = ({ page, totalPages, totalCount, onPageChange, isBn }: {
  page: number; totalPages: number; totalCount: number; onPageChange: (p: number) => void; isBn: boolean;
}) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-xs text-muted-foreground">
        {isBn ? `মোট ${totalCount.toLocaleString()}টি — পৃষ্ঠা ${page}/${totalPages}` : `Total ${totalCount.toLocaleString()} — Page ${page}/${totalPages}`}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(1)} disabled={page === 1}>
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-medium px-2">{page}</span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

const DataTracker = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isBn = t("vencon") === "VENCON";
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [dataMode, setDataMode] = useState<string>("all");
  const [selectedWebsite, setSelectedWebsite] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("raw_data");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [rawSubTab, setRawSubTab] = useState<"lead" | "processing">("lead");

  // Pagination state per tab
  const [rawPage, setRawPage] = useState(1);
  const [silverPage, setSilverPage] = useState(1);
  const [goldenPage, setGoldenPage] = useState(1);
  const [allPage, setAllPage] = useState(1);
  const [changedPage, setChangedPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);

  const panel = user?.panel;
  const isBDO = user?.role === "bdo" || user?.role === "business_development_officer" || user?.role === "Business Development And Marketing Manager";
  const isATL = user?.role === "Assistant Team Leader";
  const isTL = panel === "tl" && !isBDO;
  const canAssign = panel === "tl" && !isBDO;

  const [atlTlMap, setAtlTlMap] = useState<Record<string, string>>({});

  // Debounce search with proper cleanup
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setRawPage(1); setSilverPage(1); setGoldenPage(1); setAllPage(1); setChangedPage(1); setOrdersPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 400);
  }, []);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // ===== REALTIME: auto-refresh when leads/orders change =====
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("data-tracker-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tracker-"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tracker-"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pre_orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tracker-"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // ===== Fetch websites for filter =====
  const { data: websiteOptions } = useQuery({
    queryKey: ["tracker-websites", selectedCampaign, dataMode],
    queryFn: async () => {
      let q = supabase.from("campaign_websites").select("id, site_name, campaign_id, data_mode").eq("is_active", true);
      if (selectedCampaign !== "all") q = q.eq("campaign_id", selectedCampaign);
      if (dataMode === "lead") q = q.eq("data_mode", "lead");
      if (dataMode === "processing") q = q.eq("data_mode", "processing");
      const { data } = await q.order("site_name");
      return data || [];
    },
    enabled: !!user,
  });

  const getEffectiveTlId = () => {
    if (!isATL || !user) return user?.id || "";
    if (selectedCampaign !== "all" && atlTlMap[selectedCampaign]) return atlTlMap[selectedCampaign];
    const vals = Object.values(atlTlMap);
    return vals.length > 0 ? vals[0] : user?.id || "";
  };

  // Helper to build base query with filters
  const applyLeadFilters = (q: any) => {
    if (selectedCampaign !== "all") q = q.eq("campaign_id", selectedCampaign);
    if (selectedWebsite !== "all") q = q.eq("source", selectedWebsite);
    if (isTL && user) q = q.eq("tl_id", getEffectiveTlId());
    return q;
  };

  // Fetch campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["tracker-campaigns", user?.id, isTL, isATL],
    queryFn: async () => {
      if (isTL && !isATL && user) {
        const { data } = await supabase
          .from("campaign_tls")
          .select("campaign_id, campaigns(id, name, data_mode)")
          .eq("tl_id", user.id);
        return (data || []).map((d: any) => d.campaigns).filter(Boolean);
      }
      if (isATL && user) {
        const { data } = await supabase
          .from("campaign_agent_roles")
          .select("campaign_id, tl_id, campaigns(id, name, data_mode)")
          .eq("agent_id", user.id);
        if (data) {
          const tlMap: Record<string, string> = {};
          const seen = new Set<string>();
          const list = data
            .filter((d: any) => d.campaigns)
            .filter((d: any) => { if (seen.has(d.campaigns.id)) return false; seen.add(d.campaigns.id); return true; })
            .map((d: any) => { tlMap[d.campaigns.id] = d.tl_id; return d.campaigns; });
          setAtlTlMap(tlMap);
          return list;
        }
        return [];
      }
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, data_mode")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ===== PIPELINE COUNTS (lightweight, no data fetch) =====
  const { data: pipelineCounts } = useQuery({
    queryKey: ["tracker-pipeline-counts", selectedCampaign, selectedWebsite, dataMode, user?.id, isTL, isATL, atlTlMap],
    queryFn: async () => {
      // Count raw (fresh + unassigned)
      let rawQ = supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "fresh").is("assigned_to", null);
      rawQ = applyLeadFilters(rawQ);

      // Count agent pending (fresh/assigned + has agent)
      let agentQ = supabase.from("leads").select("id", { count: "exact", head: true }).in("status", ["fresh", "assigned"]).not("assigned_to", "is", null);
      agentQ = applyLeadFilters(agentQ);

      // Count follow up
      let fuQ = supabase.from("leads").select("id", { count: "exact", head: true }).in("status", ["called", "callback", "busy_now", "follow_up", "positive", "customer_reschedule"]);
      fuQ = applyLeadFilters(fuQ);

      // Order counts
      const csoQ = supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_cso");
      const whQ = supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "send_today");
      const sfQ = supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "dispatched").eq("delivery_status", "pending");
      const transitQ = supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_status", "in_transit");
      const deliveredQ = supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_status", "delivered");
      const returnedQ = supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_status", "returned");

      const [raw, agent, fu, cso, wh, sf, transit, delivered, returned] = await Promise.all([
        rawQ, agentQ, fuQ, csoQ, whQ, sfQ, transitQ, deliveredQ, returnedQ
      ]);

      return {
        rawData: raw.count || 0,
        agentPending: agent.count || 0,
        agentFollowUp: fu.count || 0,
        csoPending: cso.count || 0,
        warehousePending: wh.count || 0,
        steadfastPending: sf.count || 0,
        inTransit: transit.count || 0,
        delivered: delivered.count || 0,
        returned: returned.count || 0,
      };
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const pipelineSummary = pipelineCounts || {
    rawData: 0, agentPending: 0, agentFollowUp: 0, csoPending: 0,
    warehousePending: 0, steadfastPending: 0, inTransit: 0, delivered: 0, returned: 0,
  };

  // ===== PAGINATED RAW DATA =====
  const { data: rawData, isLoading: rawLoading } = useQuery({
    queryKey: ["tracker-raw", selectedCampaign, selectedWebsite, rawSubTab, rawPage, debouncedSearch, user?.id, isTL, atlTlMap],
    queryFn: async () => {
      const from = (rawPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Count query
      let countQ = supabase.from("leads").select("id", { count: "exact", head: true })
        .eq("status", "fresh").is("assigned_to", null);
      countQ = applyLeadFilters(countQ);
      if (rawSubTab === "processing") {
        countQ = countQ.or("source.eq.processing,import_source.eq.processing");
      } else {
        countQ = countQ.neq("source", "processing").neq("import_source", "processing");
      }
      if (debouncedSearch) {
        countQ = countQ.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
      }

      // Data query
      let dataQ = supabase.from("leads")
        .select("id, name, phone, address, status, source, import_source, campaign_id, created_at, assigned_to, tl_id, special_note, fraud_total, fraud_success, fraud_cancel, fraud_check_error, fraud_checked_at")
        .eq("status", "fresh").is("assigned_to", null)
        .order("created_at", { ascending: false })
        .range(from, to);
      dataQ = applyLeadFilters(dataQ);
      if (rawSubTab === "processing") {
        dataQ = dataQ.or("source.eq.processing,import_source.eq.processing");
      } else {
        dataQ = dataQ.neq("source", "processing").neq("import_source", "processing");
      }
      if (debouncedSearch) {
        dataQ = dataQ.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
      }

      const [countRes, dataRes] = await Promise.all([countQ, dataQ]);
      return { data: dataRes.data || [], count: countRes.count || 0 };
    },
    enabled: !!user && activeTab === "raw_data",
    placeholderData: keepPreviousData,
  });

  // ===== PAGINATED SILVER DATA =====
  const { data: silverData, isLoading: silverLoading } = useQuery({
    queryKey: ["tracker-silver", selectedCampaign, selectedWebsite, silverPage, debouncedSearch, user?.id, isTL, atlTlMap],
    queryFn: async () => {
      const from = (silverPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let countQ = supabase.from("leads").select("id", { count: "exact", head: true }).eq("agent_type", "silver");
      countQ = applyLeadFilters(countQ);
      if (debouncedSearch) countQ = countQ.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);

      let dataQ = supabase.from("leads")
        .select("id, name, phone, address, source, created_at, campaign_id, agent_type, assigned_to, status, fraud_total, fraud_success, fraud_cancel, fraud_check_error, fraud_checked_at")
        .eq("agent_type", "silver").order("created_at", { ascending: false }).range(from, to);
      dataQ = applyLeadFilters(dataQ);
      if (debouncedSearch) dataQ = dataQ.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);

      const [countRes, dataRes] = await Promise.all([countQ, dataQ]);
      return { data: dataRes.data || [], count: countRes.count || 0 };
    },
    enabled: !!user && activeTab === "silver_data",
    placeholderData: keepPreviousData,
  });

  // ===== PAGINATED GOLDEN DATA =====
  const { data: goldenData, isLoading: goldenLoading } = useQuery({
    queryKey: ["tracker-golden", selectedCampaign, selectedWebsite, goldenPage, debouncedSearch, user?.id, isTL, atlTlMap],
    queryFn: async () => {
      const from = (goldenPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let countQ = supabase.from("leads").select("id", { count: "exact", head: true }).eq("agent_type", "golden");
      countQ = applyLeadFilters(countQ);
      if (debouncedSearch) countQ = countQ.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);

      let dataQ = supabase.from("leads")
        .select("id, name, phone, address, source, created_at, campaign_id, agent_type, assigned_to, status, fraud_total, fraud_success, fraud_cancel, fraud_check_error, fraud_checked_at")
        .eq("agent_type", "golden").order("created_at", { ascending: false }).range(from, to);
      dataQ = applyLeadFilters(dataQ);
      if (debouncedSearch) dataQ = dataQ.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);

      const [countRes, dataRes] = await Promise.all([countQ, dataQ]);
      return { data: dataRes.data || [], count: countRes.count || 0 };
    },
    enabled: !!user && activeTab === "golden_data",
    placeholderData: keepPreviousData,
  });

  // ===== PAGINATED ALL DATA =====
  const { data: allLeadsData, isLoading: allLeadsLoading } = useQuery({
    queryKey: ["tracker-all-leads", selectedCampaign, selectedWebsite, dataMode, allPage, debouncedSearch, user?.id, isTL, atlTlMap],
    queryFn: async () => {
      const from = (allPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let countQ = supabase.from("leads").select("id", { count: "exact", head: true });
      countQ = applyLeadFilters(countQ);
      if (dataMode === "lead") countQ = countQ.neq("source", "processing").neq("import_source", "processing");
      if (dataMode === "processing") countQ = countQ.or("source.eq.processing,import_source.eq.processing");
      if (debouncedSearch) countQ = countQ.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);

      let dataQ = supabase.from("leads")
        .select("id, name, phone, address, status, agent_type, source, import_source, campaign_id, created_at, assigned_to, tl_id, updated_at, called_time, special_note, fraud_total, fraud_success, fraud_cancel, fraud_check_error, fraud_checked_at")
        .order("created_at", { ascending: false }).range(from, to);
      dataQ = applyLeadFilters(dataQ);
      if (dataMode === "lead") dataQ = dataQ.neq("source", "processing").neq("import_source", "processing");
      if (dataMode === "processing") dataQ = dataQ.or("source.eq.processing,import_source.eq.processing");
      if (debouncedSearch) dataQ = dataQ.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);

      const [countRes, dataRes] = await Promise.all([countQ, dataQ]);
      return { data: dataRes.data || [], count: countRes.count || 0 };
    },
    enabled: !!user && activeTab === "all_leads",
    placeholderData: keepPreviousData,
  });

  // ===== PAGINATED STATUS CHANGED =====
  const { data: changedData, isLoading: changedLoading } = useQuery({
    queryKey: ["tracker-changed", selectedCampaign, selectedWebsite, changedPage, debouncedSearch, user?.id, isTL, atlTlMap],
    queryFn: async () => {
      const from = (changedPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let countQ = supabase.from("leads").select("id", { count: "exact", head: true })
        .neq("status", "fresh").not("assigned_to", "is", null);
      countQ = applyLeadFilters(countQ);
      if (debouncedSearch) countQ = countQ.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);

      let dataQ = supabase.from("leads")
        .select("id, name, phone, address, status, called_time, assigned_to, updated_at, campaign_id, tl_id, agent_type, source, import_source, fraud_total, fraud_success, fraud_cancel, fraud_check_error, fraud_checked_at")
        .neq("status", "fresh").not("assigned_to", "is", null)
        .order("updated_at", { ascending: false }).range(from, to);
      dataQ = applyLeadFilters(dataQ);
      if (debouncedSearch) dataQ = dataQ.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);

      const [countRes, dataRes] = await Promise.all([countQ, dataQ]);
      return { data: dataRes.data || [], count: countRes.count || 0 };
    },
    enabled: !!user && activeTab === "agent_changed",
    placeholderData: keepPreviousData,
  });

  // ===== PAGINATED ORDERS =====
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["tracker-orders", selectedCampaign, selectedWebsite, ordersPage, debouncedSearch, user?.id, isTL, atlTlMap],
    queryFn: async () => {
      const from = (ordersPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let countQ = supabase.from("orders").select("id", { count: "exact", head: true });
      if (isTL && user) countQ = countQ.eq("tl_id", getEffectiveTlId());
      if (debouncedSearch) countQ = countQ.or(`customer_name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);

      let dataQ = supabase.from("orders")
        .select("id, customer_name, phone, address, product, price, quantity, status, delivery_status, steadfast_consignment_id, created_at, agent_id, tl_id, lead_id, rider_name, rider_phone")
        .order("created_at", { ascending: false }).range(from, to);
      if (isTL && user) dataQ = dataQ.eq("tl_id", getEffectiveTlId());
      if (debouncedSearch) dataQ = dataQ.or(`customer_name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);

      const [countRes, dataRes] = await Promise.all([countQ, dataQ]);
      return { data: dataRes.data || [], count: countRes.count || 0 };
    },
    enabled: !!user && activeTab === "orders",
    placeholderData: keepPreviousData,
  });

  // Fetch agents for TL assignment
  const { data: agents } = useQuery({
    queryKey: ["tracker-agents", user?.id, selectedCampaign, isATL, atlTlMap],
    queryFn: async () => {
      const effectiveTlId = getEffectiveTlId();
      if (!user || !selectedCampaign || selectedCampaign === "all") {
        const { data } = await supabase
          .from("campaign_agent_roles")
          .select("agent_id, is_bronze, is_silver, users!campaign_agent_roles_agent_id_fkey(id, name)")
          .eq("tl_id", effectiveTlId);
        if (!data) return { bronze: [], silver: [], all: [] };
        const seen = new Set<string>();
        const bronze: { id: string; name: string }[] = [];
        const silver: { id: string; name: string }[] = [];
        const all: { id: string; name: string }[] = [];
        data.forEach((r: any) => {
          const agent = { id: r.users.id, name: r.users.name };
          if (!seen.has(agent.id)) { all.push(agent); seen.add(agent.id); }
          if (r.is_bronze && !bronze.find(b => b.id === agent.id)) bronze.push(agent);
          if (r.is_silver && !silver.find(s => s.id === agent.id)) silver.push(agent);
        });
        return { bronze, silver, all };
      }
      const { data } = await supabase
        .from("campaign_agent_roles")
        .select("agent_id, is_bronze, is_silver, users!campaign_agent_roles_agent_id_fkey(id, name)")
        .eq("campaign_id", selectedCampaign)
        .eq("tl_id", effectiveTlId);
      if (!data) return { bronze: [], silver: [], all: [] };
      const bronze: { id: string; name: string }[] = [];
      const silver: { id: string; name: string }[] = [];
      const all: { id: string; name: string }[] = [];
      data.forEach((r: any) => {
        const agent = { id: r.users.id, name: r.users.name };
        all.push(agent);
        if (r.is_bronze) bronze.push(agent);
        if (r.is_silver) silver.push(agent);
      });
      return { bronze, silver, all };
    },
    enabled: !!user && isTL,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["tracker-"] });
  };

  // TL assignment functions
  const assignLead = async (leadId: string, agentId: string, isProcessing: boolean) => {
    if (isATL) {
      // ATL needs TL approval
      const effectiveTlId = getEffectiveTlId();
      const { error } = await supabase.from("atl_approvals").insert({
        atl_id: user!.id,
        tl_id: effectiveTlId,
        action_type: "assign_lead",
        payload: { lead_id: leadId, agent_id: agentId, is_processing: isProcessing },
        status: "pending",
      });
      if (error) {
        toast.error(isBn ? "অনুরোধ পাঠাতে ব্যর্থ" : "Failed to send request");
        return;
      }
      toast.success(isBn ? "TL-এর কাছে অনুমোদনের অনুরোধ পাঠানো হয়েছে" : "Approval request sent to TL");
    } else {
      if (isProcessing) {
        await supabase.from("leads").update({ assigned_to: agentId, status: "processing_assigned" }).eq("id", leadId);
      } else {
        await supabase.from("leads").update({ assigned_to: agentId, status: "assigned", agent_type: "bronze" }).eq("id", leadId);
      }
      toast.success(isBn ? "Lead assign করা হয়েছে" : "Lead assigned");
    }
    setAssignments(prev => { const n = { ...prev }; delete n[leadId]; return n; });
    invalidateAll();
  };

  const agentList = rawSubTab === "processing" ? (agents?.all || []) : (agents?.bronze || []);

  // Compute page totals
  const rawTotalPages = Math.max(1, Math.ceil((rawData?.count || 0) / PAGE_SIZE));
  const silverTotalPages = Math.max(1, Math.ceil((silverData?.count || 0) / PAGE_SIZE));
  const goldenTotalPages = Math.max(1, Math.ceil((goldenData?.count || 0) / PAGE_SIZE));
  const allTotalPages = Math.max(1, Math.ceil((allLeadsData?.count || 0) / PAGE_SIZE));
  const changedTotalPages = Math.max(1, Math.ceil((changedData?.count || 0) / PAGE_SIZE));
  const ordersTotalPages = Math.max(1, Math.ceil((ordersData?.count || 0) / PAGE_SIZE));

  const pipelineSteps = [
    { label: isBn ? "র ডাটা" : "Raw Data", value: pipelineSummary.rawData, color: "text-rose-500", icon: Database },
    { label: isBn ? "এজেন্ট পেন্ডিং" : "Agent Pending", value: pipelineSummary.agentPending, color: "text-amber-500", icon: Phone },
    { label: isBn ? "ফলো আপ" : "Follow Up", value: pipelineSummary.agentFollowUp, color: "text-purple-500", icon: Clock },
    { label: isBn ? "CSO পেন্ডিং" : "CSO Pending", value: pipelineSummary.csoPending, color: "text-orange-500", icon: Target },
    { label: isBn ? "ওয়্যারহাউস" : "Warehouse", value: pipelineSummary.warehousePending, color: "text-cyan-500", icon: Package },
    { label: isBn ? "স্টিডফাস্ট" : "Steadfast", value: pipelineSummary.steadfastPending, color: "text-indigo-500", icon: Truck },
    { label: isBn ? "ট্রানজিট" : "In Transit", value: pipelineSummary.inTransit, color: "text-violet-500", icon: Truck },
    { label: isBn ? "ডেলিভার্ড" : "Delivered", value: pipelineSummary.delivered, color: "text-green-500", icon: CircleDot },
    { label: isBn ? "রিটার্নড" : "Returned", value: pipelineSummary.returned, color: "text-red-500", icon: CircleDot },
  ];

  // Loading spinner row helper
  const LoadingRow = ({ cols }: { cols: number }) => (
    <TableRow><TableCell colSpan={cols} className="text-center py-12"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></TableCell></TableRow>
  );
  const EmptyRow = ({ cols, msg }: { cols: number; msg: string }) => (
    <TableRow><TableCell colSpan={cols} className="text-center py-12 text-muted-foreground">{msg}</TableCell></TableRow>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {isBn ? "ডাটা ট্র্যাকার" : "Data Tracker"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isBn ? "সব ডাটার বর্তমান অবস্থান ও স্ট্যাটাস দেখুন — রিয়েল-টাইম লাইভ আপডেট" : "Track current position & status — real-time live updates"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedCampaign} onValueChange={(v) => { setSelectedCampaign(v); setSelectedWebsite("all"); setRawPage(1); setAllPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={isBn ? "সব ক্যাম্পেইন" : "All Campaigns"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isBn ? "সব ক্যাম্পেইন" : "All Campaigns"}</SelectItem>
              {campaigns?.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.data_mode === "processing" ? "⚙️" : "🎯"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dataMode} onValueChange={(v) => { setDataMode(v); setSelectedWebsite("all"); setAllPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isBn ? "সব মোড" : "All Modes"}</SelectItem>
              <SelectItem value="lead">🎯 {isBn ? "লিড" : "Lead"}</SelectItem>
              <SelectItem value="processing">⚙️ {isBn ? "প্রসেসিং" : "Processing"}</SelectItem>
            </SelectContent>
          </Select>
          {websiteOptions && websiteOptions.length > 0 && (
            <Select value={selectedWebsite} onValueChange={(v) => { setSelectedWebsite(v); setRawPage(1); setAllPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isBn ? "সব ওয়েবসাইট" : "All Websites"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isBn ? "সব ওয়েবসাইট" : "All Websites"}</SelectItem>
                {websiteOptions.map((w: any) => (
                  <SelectItem key={w.id} value={w.site_name}>{w.site_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Pipeline Position Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <p className="text-xs font-heading text-muted-foreground mb-3">{isBn ? "📍 পাইপলাইন অবস্থান সারাংশ — সব সংখ্যা রিয়েলটাইম" : "📍 Pipeline Position Summary — All counts are realtime"}</p>
          <div className="flex flex-wrap items-center gap-2">
            {pipelineSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex flex-col items-center bg-card border border-border rounded-lg px-3 py-2 min-w-[80px]">
                  <step.icon className={`h-3.5 w-3.5 ${step.color} mb-0.5`} />
                  <span className="text-lg font-heading font-bold text-foreground">{step.value.toLocaleString()}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight text-center">{step.label}</span>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="raw_data" className="text-xs">
              📦 {isBn ? "র ডাটা" : "Raw Data"} ({(rawData?.count || 0).toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="silver_data" className="text-xs">
              🥈 {isBn ? "সিলভার" : "Silver"} ({(silverData?.count || 0).toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="golden_data" className="text-xs">
              🥇 {isBn ? "গোল্ডেন" : "Golden"} ({(goldenData?.count || 0).toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="all_leads" className="text-xs">
              🎯 {isBn ? "সব ডাটা" : "All Data"} ({(allLeadsData?.count || 0).toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="agent_changed" className="text-xs">
              📝 {isBn ? "স্ট্যাটাস পরিবর্তিত" : "Status Changed"} ({(changedData?.count || 0).toLocaleString()})
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs">
              🛒 {isBn ? "অর্ডার ট্র্যাকিং" : "Order Tracking"} ({(ordersData?.count || 0).toLocaleString()})
            </TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={isBn ? "নাম বা ফোন দিয়ে খুঁজুন..." : "Search by name or phone..."}
              className="pl-9 text-sm"
            />
          </div>
        </div>

        {/* ========== RAW DATA TAB ========== */}
        <TabsContent value="raw_data">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  {isBn ? "র ডাটা — ইন হয়েছে কিন্তু অপারেশন হয়নি" : "Raw Data — Imported but not operated"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={rawSubTab === "lead" ? "default" : "outline"} onClick={() => { setRawSubTab("lead"); setRawPage(1); }} className="text-xs">
                    🎯 {isBn ? "লিড" : "Lead"}
                  </Button>
                  <Button size="sm" variant={rawSubTab === "processing" ? "default" : "outline"} onClick={() => { setRawSubTab("processing"); setRawPage(1); }} className="text-xs">
                    ⚙️ {isBn ? "প্রসেসিং" : "Processing"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {canAssign
                  ? (isBn ? "📤 এজেন্টদের কাছে ডাটা ডিস্ট্রিবিউট করুন" : "📤 Distribute data to agents")
                  : (isBn ? "📖 শুধুমাত্র পড়ার জন্য — ইউজার থেকে আসা মূল ডাটা" : "📖 Read-only — original data from users")}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const rows = rawData?.data || [];
                const parsedRows = rows.map((lead: any) => {
                  let parsed: Record<string, unknown> = {};
                  try { if (lead.special_note) parsed = JSON.parse(lead.special_note); } catch { /* ignore */ }
                  return { lead, parsed };
                });

                const skipKeys = new Set(["webhook_secret", "secret", "x-webhook-secret"]);
                const allKeys: string[] = [];
                const keySet = new Set<string>();
                parsedRows.forEach(({ parsed }) => {
                  const flatten = (obj: any, prefix = "") => {
                    if (!obj || typeof obj !== "object") return;
                    for (const [k, v] of Object.entries(obj)) {
                      const fullKey = prefix ? `${prefix}.${k}` : k;
                      if (skipKeys.has(k.toLowerCase())) continue;
                      if (v && typeof v === "object" && !Array.isArray(v)) { flatten(v, fullKey); }
                      else if (!keySet.has(fullKey)) { keySet.add(fullKey); allKeys.push(fullKey); }
                    }
                  };
                  flatten(parsed);
                });

                const getNestedValue = (obj: any, key: string): string => {
                  const parts = key.split(".");
                  let current = obj;
                  for (const part of parts) {
                    if (current == null || typeof current !== "object") return "";
                    current = current[part];
                  }
                  if (current == null) return "";
                  if (Array.isArray(current)) {
                    return current.map((item: any) => {
                      if (typeof item === "object") {
                        const name = item.name || item.product_name || item.title || "";
                        const qty = item.quantity || item.qty || "";
                        const price = item.total || item.price || item.subtotal || "";
                        if (name) return `${name}${qty ? ` ×${qty}` : ""}${price ? ` ৳${price}` : ""}`;
                        return JSON.stringify(item);
                      }
                      return String(item);
                    }).join(", ");
                  }
                  return String(current);
                };

                const prettyLabel = (key: string): string => {
                  const last = key.split(".").pop() || key;
                  return last.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                };

                const dynamicCols = allKeys.length > 0;
                const colCount = (dynamicCols ? allKeys.length + 3 : 6) + (canAssign ? 1 : 0);
                const startIdx = (rawPage - 1) * PAGE_SIZE;

                return (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">#</TableHead>
                            {dynamicCols ? (
                              allKeys.map(key => <TableHead key={key} className="text-xs whitespace-nowrap">{prettyLabel(key)}</TableHead>)
                            ) : (
                              <>
                                <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                                <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                                <TableHead className="text-xs">{isBn ? "ঠিকানা" : "Address"}</TableHead>
                              </>
                            )}
                            <TableHead className="text-xs">{isBn ? "সোর্স" : "Source"}</TableHead>
                            <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
                            {canAssign && <TableHead className="text-xs">{isBn ? "অ্যাসাইন" : "Assign"}</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rawLoading ? <LoadingRow cols={colCount} /> : rows.length === 0 ? (
                            <EmptyRow cols={colCount} msg={isBn ? "কোনো র ডাটা নেই — সব ডাটা অপারেশনে আছে ✅" : "No raw data — all data is in operation ✅"} />
                          ) : parsedRows.map(({ lead, parsed }, i) => (
                            <TableRow key={lead.id}>
                              <TableCell className="text-xs text-muted-foreground">{startIdx + i + 1}</TableCell>
                              {dynamicCols ? (
                                allKeys.map(key => (
                                  <TableCell key={key} className="text-xs max-w-[200px] truncate" title={getNestedValue(parsed, key)}>
                                    {getNestedValue(parsed, key) || "—"}
                                  </TableCell>
                                ))
                              ) : (
                                <>
                                  <TableCell className="text-sm font-medium">
                                    <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />{lead.name || "—"}</div>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    <div className="flex items-center gap-1">
                                      <span>{lead.phone || "—"}</span>
                                      {lead.phone && <CopyButton text={lead.phone} />}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-[150px]">
                                    <AddressTooltip address={lead.address} />
                                  </TableCell>
                                </>
                              )}
                              <TableCell><Badge variant="outline" className="text-[10px]">{lead.source || lead.import_source || "—"}</Badge></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{lead.created_at ? format(new Date(lead.created_at), "dd MMM HH:mm") : "—"}</TableCell>
                              {canAssign && (
                                <TableCell>
                                  <div className="flex items-center gap-1.5 min-w-[180px]">
                                    <Select value={assignments[lead.id] || ""} onValueChange={(v) => setAssignments(prev => ({ ...prev, [lead.id]: v }))}>
                                      <SelectTrigger className="h-7 w-[130px] text-xs">
                                        <SelectValue placeholder={isBn ? "এজেন্ট" : "Agent"} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {agentList.map((a: any) => (
                                          <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      disabled={!assignments[lead.id]}
                                      onClick={() => assignLead(lead.id, assignments[lead.id], rawSubTab === "processing")}
                                    >
                                      <Send className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Pagination page={rawPage} totalPages={rawTotalPages} totalCount={rawData?.count || 0} onPageChange={setRawPage} isBn={isBn} />
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== SILVER DATA TAB ========== */}
        <TabsContent value="silver_data">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                🥈 {isBn ? "সিলভার ডাটা" : "Silver Data"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ঠিকানা" : "Address"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {silverLoading ? <LoadingRow cols={6} /> : (silverData?.data || []).length === 0 ? (
                      <EmptyRow cols={6} msg={isBn ? "কোনো সিলভার ডাটা নেই" : "No silver data"} />
                    ) : (silverData?.data || []).map((lead: any, i: number) => (
                      <TableRow key={lead.id}>
                        <TableCell className="text-xs text-muted-foreground">{(silverPage - 1) * PAGE_SIZE + i + 1}</TableCell>
                        <TableCell className="text-sm font-medium"><div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />{lead.name || "—"}</div></TableCell>
                        <TableCell className="text-sm"><div className="flex items-center gap-1"><span>{lead.phone || "—"}</span>{lead.phone && <CopyButton text={lead.phone} />}</div></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px]"><AddressTooltip address={lead.address} /></TableCell>
                        <TableCell><Badge className={`text-[10px] ${statusColorMap[lead.status || ""] || "bg-muted text-muted-foreground"}`}>{lead.status || "—"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{lead.created_at ? format(new Date(lead.created_at), "dd MMM yyyy") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={silverPage} totalPages={silverTotalPages} totalCount={silverData?.count || 0} onPageChange={setSilverPage} isBn={isBn} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== GOLDEN DATA TAB ========== */}
        <TabsContent value="golden_data">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                🥇 {isBn ? "গোল্ডেন ডাটা" : "Golden Data"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ঠিকানা" : "Address"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "সোর্স" : "Source"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goldenLoading ? <LoadingRow cols={6} /> : (goldenData?.data || []).length === 0 ? (
                      <EmptyRow cols={6} msg={isBn ? "কোনো গোল্ডেন ডাটা নেই" : "No golden data"} />
                    ) : (goldenData?.data || []).map((lead: any, i: number) => (
                      <TableRow key={lead.id}>
                        <TableCell className="text-xs text-muted-foreground">{(goldenPage - 1) * PAGE_SIZE + i + 1}</TableCell>
                        <TableCell className="text-sm font-medium"><div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />{lead.name || "—"}</div></TableCell>
                        <TableCell className="text-sm"><div className="flex items-center gap-1"><span>{lead.phone || "—"}</span>{lead.phone && <CopyButton text={lead.phone} />}</div></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px]"><AddressTooltip address={lead.address} /></TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{lead.source || "—"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{lead.created_at ? format(new Date(lead.created_at), "dd MMM yyyy") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={goldenPage} totalPages={goldenTotalPages} totalCount={goldenData?.count || 0} onPageChange={setGoldenPage} isBn={isBn} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ALL DATA TAB ========== */}
        <TabsContent value="all_leads">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "টাইপ" : "Type"}</TableHead>
                      <TableHead className="text-xs">📍 {isBn ? "বর্তমান অবস্থান" : "Current Position"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLeadsLoading ? <LoadingRow cols={7} /> : (allLeadsData?.data || []).length === 0 ? (
                      <EmptyRow cols={7} msg={isBn ? "কোনো ডাটা নেই" : "No data found"} />
                    ) : (allLeadsData?.data || []).map((lead: any, i: number) => {
                      const pos = getLeadPosition(lead, isBn);
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="text-xs text-muted-foreground">{(allPage - 1) * PAGE_SIZE + i + 1}</TableCell>
                          <TableCell className="text-sm font-medium"><div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />{lead.name || "—"}</div></TableCell>
                          <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                          <TableCell><Badge className={`text-[10px] ${statusColorMap[lead.status || ""] || "bg-muted text-muted-foreground"}`}>{lead.status || "—"}</Badge></TableCell>
                          <TableCell>
                            {lead.agent_type ? (
                              <Badge variant="outline" className="text-[10px]">{lead.agent_type === "bronze" ? "🥉" : "🥈"} {lead.agent_type}</Badge>
                            ) : lead.source === "processing" || lead.import_source === "processing" ? (
                              <Badge variant="outline" className="text-[10px]">⚙️ Processing</Badge>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell><Badge className={`text-[10px] ${pos.color}`}>📍 {pos.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lead.created_at ? format(new Date(lead.created_at), "dd MMM yyyy") : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={allPage} totalPages={allTotalPages} totalCount={allLeadsData?.count || 0} onPageChange={setAllPage} isBn={isBn} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== AGENT STATUS CHANGED TAB ========== */}
        <TabsContent value="agent_changed">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "কল সংখ্যা" : "Calls"}</TableHead>
                      <TableHead className="text-xs">📍 {isBn ? "বর্তমান অবস্থান" : "Current Position"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "আপডেট" : "Updated"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changedLoading ? <LoadingRow cols={7} /> : (changedData?.data || []).length === 0 ? (
                      <EmptyRow cols={7} msg={isBn ? "কোনো স্ট্যাটাস পরিবর্তিত ডাটা নেই" : "No status-changed data"} />
                    ) : (changedData?.data || []).map((lead: any, i: number) => {
                      const pos = getLeadPosition(lead, isBn);
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="text-xs text-muted-foreground">{(changedPage - 1) * PAGE_SIZE + i + 1}</TableCell>
                          <TableCell className="text-sm font-medium">{lead.name || "—"}</TableCell>
                          <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                          <TableCell><Badge className={`text-[10px] ${statusColorMap[lead.status || ""] || "bg-muted text-muted-foreground"}`}>{lead.status || "—"}</Badge></TableCell>
                          <TableCell className="text-sm text-center">{lead.called_time || 0}</TableCell>
                          <TableCell><Badge className={`text-[10px] ${pos.color}`}>📍 {pos.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lead.updated_at ? format(new Date(lead.updated_at), "dd MMM HH:mm") : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={changedPage} totalPages={changedTotalPages} totalCount={changedData?.count || 0} onPageChange={setChangedPage} isBn={isBn} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ORDERS TRACKING TAB ========== */}
        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">{isBn ? "কাস্টমার" : "Customer"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "পণ্য" : "Product"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "মূল্য" : "Price"}</TableHead>
                      <TableHead className="text-xs">📍 {isBn ? "বর্তমান অবস্থান" : "Current Position"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "রাইডার" : "Rider"}</TableHead>
                      <TableHead className="text-xs">{isBn ? "তারিখ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersLoading ? <LoadingRow cols={8} /> : (ordersData?.data || []).length === 0 ? (
                      <EmptyRow cols={8} msg={isBn ? "কোনো অর্ডার নেই" : "No orders found"} />
                    ) : (ordersData?.data || []).map((order: any, i: number) => {
                      const pos = getOrderPosition(order, isBn);
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="text-xs text-muted-foreground">{(ordersPage - 1) * PAGE_SIZE + i + 1}</TableCell>
                          <TableCell className="text-sm font-medium">{order.customer_name || "—"}</TableCell>
                          <TableCell className="text-sm">{order.phone || "—"}</TableCell>
                          <TableCell className="text-sm">{order.product || "—"}</TableCell>
                          <TableCell className="text-sm font-medium">৳{(order.price || 0).toLocaleString()}</TableCell>
                          <TableCell><Badge className={`text-[10px] ${pos.color}`}>📍 {pos.label}</Badge></TableCell>
                          <TableCell className="text-xs">
                            {order.rider_name ? (
                              <div>
                                <span className="font-medium text-foreground">{order.rider_name}</span>
                                {order.rider_phone && <span className="text-muted-foreground ml-1">({order.rider_phone})</span>}
                              </div>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{order.created_at ? format(new Date(order.created_at), "dd MMM yyyy") : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={ordersPage} totalPages={ordersTotalPages} totalCount={ordersData?.count || 0} onPageChange={setOrdersPage} isBn={isBn} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataTracker;
