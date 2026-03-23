import { useState, useEffect, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, differenceInMinutes, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, Target, AlertTriangle, Database, Send, Search, MessageCircle, Filter } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { BD_DISTRICTS, detectLocation } from "@/lib/bdLocations";
import FraudChecker from "@/components/FraudChecker";
import CopyButton from "@/components/ui/CopyButton";
import AddressTooltip from "@/components/ui/AddressTooltip";

interface LeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  status: string | null;
  called_time: number | null;
  special_note: string | null;
  agent_type: string | null;
  requeue_count: number | null;
  requeue_at: string | null;
  campaign_id: string | null;
  tl_id: string | null;
  created_at: string | null;
  import_source: string | null;
}

interface InventoryItem {
  id: string;
  product_name: string;
  unit_price: number | null;
}

// Dynamic config types (from campaign_data_operations)
type AppPanel = "sa" | "hr" | "tl" | "employee";
interface ColumnOption {
  id: string;
  value: string;
  label: string;
  label_bn: string;
  color?: string;
  next_panel?: AppPanel | "";
  next_location?: string;
  routes?: Array<{ next_role: string; next_panel: AppPanel | ""; next_location: string }>;
  note?: string;
  is_spam?: boolean;
}
type ColumnType = "dropdown" | "note";
interface StatusColumn {
  id: string;
  name: string;
  name_bn: string;
  type: ColumnType;
  options: ColumnOption[];
}
interface RoleColumnConfig {
  role: string;
  columns: StatusColumn[];
}

// Fallback hardcoded statuses (used when no dynamic config exists)
const FALLBACK_STATUSES = [
  { value: "order_confirm", label: "Order Confirm", label_bn: "অর্ডার কনফার্ম" },
  { value: "pre_order", label: "Pre Order", label_bn: "প্রি অর্ডার" },
  { value: "pre_order_confirm", label: "Pre Order Confirm", label_bn: "প্রি অর্ডার কনফার্ম" },
  { value: "phone_off", label: "Phone Off", label_bn: "ফোন অফ" },
  { value: "positive", label: "Positive", label_bn: "পজিটিভ" },
  { value: "customer_reschedule", label: "Customer Reschedule", label_bn: "রিশিডিউল" },
  { value: "do_not_pick", label: "Do Not Pick", label_bn: "ফোন ধরে না" },
  { value: "no_response", label: "No Response", label_bn: "নো রেসপন্স" },
  { value: "busy_now", label: "Busy Now", label_bn: "ব্যস্ত" },
  { value: "number_busy", label: "Number Busy", label_bn: "নম্বর ব্যস্ত" },
  { value: "negative", label: "Negative", label_bn: "নেগেটিভ" },
  { value: "not_interested", label: "Not Interested", label_bn: "আগ্রহী না" },
  { value: "cancelled", label: "Cancelled", label_bn: "বাতিল" },
  { value: "wrong_number", label: "Wrong Number", label_bn: "ভুল নম্বর" },
  { value: "duplicate", label: "Duplicate", label_bn: "ডুপ্লিকেট" },
  { value: "already_ordered", label: "Already Ordered", label_bn: "আগেই অর্ডার করেছে" },
];

// Statuses that trigger requeue (fallback defaults)
const DEFAULT_REQUEUE_STATUS_VALUES = ["phone_off", "positive", "customer_reschedule", "do_not_pick", "no_response", "busy_now", "number_busy"];
const REQUEUE_MINUTES = 40;
const DEFAULT_DELETE_SHEET_THRESHOLD = 5;

const STATUS_COLOR_CLASSES: Record<string, string> = {
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  gray: "bg-muted text-muted-foreground",
};

const getStatusColorClasses = (color?: string) => STATUS_COLOR_CLASSES[color || "gray"] || STATUS_COLOR_CLASSES.gray;

// Statuses that trigger special modals
const MODAL_STATUSES = ["order_confirm", "pre_order", "pre_order_confirm"];

const normalizeWorkflowStatus = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/g, "_").replace(/^_+/, "");

export default function EmployeeLeads() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const isMobile = useIsMobile();
  const isBn = lang === "bn";
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [dynamicColumns, setDynamicColumns] = useState<StatusColumn[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [deleteSheetConfig, setDeleteSheetConfig] = useState<{ statuses: string[]; threshold: number } | null>(null);

  const [leadStatuses, setLeadStatuses] = useState<Record<string, string>>({});
  const [leadCalledTimes, setLeadCalledTimes] = useState<Record<string, number>>({});
  const [leadNotes, setLeadNotes] = useState<Record<string, string>>({});

  const [products, setProducts] = useState<InventoryItem[]>([]);
   const [giftNames, setGiftNames] = useState<string[]>([]);
   const [cardNames, setCardNames] = useState<string[]>([]);
  const [currentOrderLead, setCurrentOrderLead] = useState<LeadRow | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderAddress, setOrderAddress] = useState("");
  const [orderProduct, setOrderProduct] = useState("");
  const [orderQty, setOrderQty] = useState(1);
  const [orderPrice, setOrderPrice] = useState(0);
  const [orderNote, setOrderNote] = useState("");
  const [orderDistrict, setOrderDistrict] = useState("");
  const [orderThana, setOrderThana] = useState("");
  const [orderGiftName, setOrderGiftName] = useState("");
  const [orderAdvancePayment, setOrderAdvancePayment] = useState(0);
  const [orderPaymentMethod, setOrderPaymentMethod] = useState("");
  const [orderCardName, setOrderCardName] = useState("");
  const [orderMedia, setOrderMedia] = useState("");
  const [orderUpsell, setOrderUpsell] = useState("");
  const [orderSuccessRatio, setOrderSuccessRatio] = useState<number | "">(""); 
  const [districtSearch, setDistrictSearch] = useState("");
  const [thanaSearch, setThanaSearch] = useState("");
  const [locationAutoDetected, setLocationAutoDetected] = useState(false);

  const [currentPreOrderLead, setCurrentPreOrderLead] = useState<LeadRow | null>(null);
  const [showPreOrderModal, setShowPreOrderModal] = useState(false);
  const [preOrderDate, setPreOrderDate] = useState<Date>();
  const [preOrderNote, setPreOrderNote] = useState("");

  // Pre Order Confirm states
  const [currentPreOrderConfirmLead, setCurrentPreOrderConfirmLead] = useState<LeadRow | null>(null);
  const [showPreOrderConfirmModal, setShowPreOrderConfirmModal] = useState(false);
  const [pocDistrict, setPocDistrict] = useState("");
  const [pocThana, setPocThana] = useState("");
  const [pocAddress, setPocAddress] = useState("");
  const [pocProduct, setPocProduct] = useState("");
  const [pocDeliveryDate, setPocDeliveryDate] = useState<Date>();

  const [metrics, setMetrics] = useState({ orders: 0, delivered: 0, cancelled: 0, returned: 0 });
  const [tick, setTick] = useState(0);
  const [showDataRequestModal, setShowDataRequestModal] = useState(false);
  const [dataRequestMsg, setDataRequestMsg] = useState("");
  const [dataRequestLoading, setDataRequestLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Filter states
  const [filterCampaignId, setFilterCampaignId] = useState<string>("all");
  
  const [filterWebsite, setFilterWebsite] = useState<string>("all");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; data_mode: string }[]>([]);
  const [websites, setWebsites] = useState<{ id: string; site_name: string; campaign_id: string }[]>([]);

  // WhatsApp states
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [waSenderNumber, setWaSenderNumber] = useState("");
  const [showWaModal, setShowWaModal] = useState(false);
  const [waSelectedTemplate, setWaSelectedTemplate] = useState("");
  const [waRecipientPhone, setWaRecipientPhone] = useState("");
  const [waCurrentLead, setWaCurrentLead] = useState<LeadRow | null>(null);
  const [waSending, setWaSending] = useState(false);

  // Load dynamic config from campaign_data_operations
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Try agent's campaign first
      const { data: carData } = await supabase.from("campaign_agent_roles")
        .select("campaign_id, is_bronze, is_silver").eq("agent_id", user.id).limit(1).maybeSingle();

      let campaignId = carData?.campaign_id;
      let isSilver = carData?.is_silver;

      // If no campaign_agent_roles, try from agent's leads
      if (!campaignId) {
        const { data: leadCamp } = await supabase.from("leads")
          .select("campaign_id").eq("assigned_to", user.id).not("campaign_id", "is", null).limit(1).maybeSingle();
        if (leadCamp?.campaign_id) campaignId = leadCamp.campaign_id;
      }

      // If still no campaign, try loading any available config
      if (!campaignId) {
        const { data: anyConfig } = await supabase.from("campaign_data_operations")
          .select("fields_config").limit(1).maybeSingle();
        if (anyConfig?.fields_config) {
          const configs = anyConfig.fields_config as unknown as RoleColumnConfig[];
          const roleConfig = configs.find(c => c.role === user.role) || configs.find(c => c.role === "telesales_executive") || configs[0];
          if (roleConfig?.columns?.length) setDynamicColumns(roleConfig.columns);
        }
        setConfigLoaded(true);
        return;
      }

      // Load config for the found campaign
      const { data: configData } = await supabase.from("campaign_data_operations")
        .select("fields_config").eq("campaign_id", campaignId).maybeSingle();
      if (!configData?.fields_config) { setConfigLoaded(true); return; }

      const roleKey = isSilver ? "silver_agent" : (user.role || "telesales_executive");
      const configs = configData.fields_config as unknown as RoleColumnConfig[];
      const roleConfig = configs.find(c => c.role === roleKey) || configs[0];
      if (roleConfig?.columns?.length) {
        setDynamicColumns(roleConfig.columns);
      }
      setConfigLoaded(true);
    })();
  }, [user]);

  // Load delete sheet config from app_settings (per-role)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "delete_sheet_config").maybeSingle();
      if (data?.value) {
        const val = data.value as any;
        if (val.rules && Array.isArray(val.rules)) {
          const myRule = val.rules.find((r: any) => r.role === user.role);
          if (myRule?.statuses?.length && myRule.threshold) {
            setDeleteSheetConfig({ statuses: myRule.statuses, threshold: myRule.threshold });
          }
        } else if (val.statuses?.length && val.threshold) {
          setDeleteSheetConfig({ statuses: val.statuses, threshold: val.threshold });
        }
      }
    })();
  }, [user]);

  // Load campaigns & websites for filters
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get campaign IDs from agent roles AND from leads themselves
      const [{ data: carData }, { data: leadCampData }] = await Promise.all([
        supabase.from("campaign_agent_roles").select("campaign_id").eq("agent_id", user.id),
        supabase.from("leads").select("campaign_id").eq("assigned_to", user.id).not("campaign_id", "is", null),
      ]);
      const campaignIds = [...new Set([
        ...(carData || []).map(c => c.campaign_id),
        ...(leadCampData || []).map(l => l.campaign_id).filter(Boolean) as string[],
      ])];
      if (campaignIds.length === 0) return;

      const [{ data: campData }, { data: siteData }] = await Promise.all([
        supabase.from("campaigns").select("id, name, data_mode").in("id", campaignIds),
        supabase.from("campaign_websites").select("id, site_name, campaign_id").in("campaign_id", campaignIds).eq("is_active", true),
      ]);
      if (campData) setCampaigns(campData);
      if (siteData) setWebsites(siteData);
    })();
  }, [user]);

  // Compute available statuses from dynamic config or fallback
  const availableStatuses = useMemo(() => {
    if (dynamicColumns.length > 0) {
      const dropdownCol = dynamicColumns.find(c => c.type === "dropdown");
      if (dropdownCol?.options?.length) {
        return dropdownCol.options.map(o => ({ value: o.value, label: o.label || o.value, label_bn: o.label_bn, color: o.color, next_panel: o.next_panel, next_location: o.next_location, routes: o.routes, is_spam: o.is_spam }));
      }
    }
    return FALLBACK_STATUSES.map(s => ({ ...s, color: "gray", next_panel: undefined, next_location: undefined, routes: undefined, is_spam: undefined }));
  }, [dynamicColumns]);

  // Note columns from dynamic config
  const noteColumns = useMemo(() => dynamicColumns.filter(c => c.type === "note"), [dynamicColumns]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  // Check if clocked in
  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("attendance").select("clock_in").eq("user_id", user.id).eq("date", today).maybeSingle();
      setCheckedIn(!!data?.clock_in);
      setLoading(false);
    })();
  }, [user]);

  const loadLeads = useCallback(async () => {
    if (!user) return;
    // Load all leads assigned to this agent, excluding terminal/routed statuses
    const excludeStatuses = ["negative","not_interested","cancelled","wrong_number","duplicate","already_ordered","order_confirm","pre_order_confirm","pre_order","pending_tl","pending_cso"];
    const { data } = await supabase.from("leads").select("*").eq("assigned_to", user.id)
      .eq("is_spam", false)
      .not("status", "in", `(${excludeStatuses.join(",")})`);
    if (data) setLeads(data as LeadRow[]);
  }, [user]);

  // Load leads on mount and when checkedIn changes
  useEffect(() => {
    if (checkedIn && user) {
      loadLeads();
      loadMyRequests();
    }
  }, [checkedIn, user, loadLeads]);


  // Load WhatsApp templates and config
  useEffect(() => {
    (async () => {
      const [{ data: tplData }, { data: cfgData }] = await Promise.all([
        supabase.from("whatsapp_templates").select("*").eq("is_active", true).order("created_at"),
        supabase.from("app_settings").select("value").eq("key", "api_config").maybeSingle(),
      ]);
      if (tplData) setWaTemplates(tplData);
      const cfg = cfgData?.value as Record<string, string> | null;
      if (cfg?.whatsapp_sender) setWaSenderNumber(cfg.whatsapp_sender);
    })();
  }, []);

  const handleWhatsAppSend = async () => {
    if (!waSelectedTemplate || !waRecipientPhone || !waCurrentLead) return;
    setWaSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          template_id: waSelectedTemplate,
          recipient_phone: waRecipientPhone,
          lead_name: waCurrentLead.name || "",
          lead_address: waCurrentLead.address || "",
        },
      });
      if (error) throw error;
      if (data?.method === "wa_link") {
        window.open(data.wa_link, "_blank");
        toast.success(isBn ? "WhatsApp ওপেন হচ্ছে..." : "Opening WhatsApp...");
      } else {
        toast.success(isBn ? "মেসেজ পাঠানো হয়েছে ✓" : "Message sent ✓");
      }
      setShowWaModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    }
    setWaSending(false);
  };


  const loadMyRequests = async () => {
    if (!user) return;
    const { data } = await supabase.from("data_requests").select("*").eq("requested_by", user.id).order("created_at", { ascending: false }).limit(5);
    if (data) setPendingRequests(data);
  };

  const handleDataRequest = async () => {
    if (!user) return;
    setDataRequestLoading(true);
    // Find the TL who assigned leads to this agent
    const { data: leadData } = await supabase.from("leads").select("tl_id").eq("assigned_to", user.id).not("tl_id", "is", null).limit(1);
    const tlId = leadData?.[0]?.tl_id;
    if (!tlId) {
      // Try campaign_agent_roles
      const { data: carData } = await supabase.from("campaign_agent_roles").select("tl_id, campaign_id").eq("agent_id", user.id).limit(1);
      toast.error(isBn ? "টিম লিডার পাওয়া যায়নি" : "Team leader not found"); setDataRequestLoading(false); return;
      await supabase.from("data_requests").insert({ requested_by: user.id, tl_id: carData[0].tl_id, campaign_id: carData[0].campaign_id, message: dataRequestMsg || null });
    } else {
      await supabase.from("data_requests").insert({ requested_by: user.id, tl_id: tlId, message: dataRequestMsg || null });
    }
    toast.success(t("data_request_success"));
    setShowDataRequestModal(false);
    setDataRequestMsg("");
    setDataRequestLoading(false);
    loadMyRequests();
  };

  useEffect(() => {
    const toStringList = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value.map((v) => String(v).trim()).filter(Boolean);
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed)
            ? parsed.map((v) => String(v).trim()).filter(Boolean)
            : [];
        } catch {
          return value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        }
      }
      return [];
    };

    (async () => {
      const [{ data: inventoryData, error: inventoryError }, { data: settingsData, error: settingsError }] = await Promise.all([
        supabase.from("inventory").select("id, product_name, unit_price"),
        supabase.from("app_settings").select("key, value").in("key", ["product_names", "gift_names", "card_names"]),
      ]);

      if (inventoryError) console.error("Inventory load error:", inventoryError);
      if (settingsError) console.error("Settings load error:", settingsError);

      const inventoryProducts = (inventoryData || []) as InventoryItem[];

      let productNames: string[] = [];
      let gifts: string[] = [];
      let cards: string[] = [];

      (settingsData || []).forEach((row: any) => {
        if (row.key === "product_names") productNames = toStringList(row.value);
        if (row.key === "gift_names") gifts = toStringList(row.value);
        if (row.key === "card_names") cards = toStringList(row.value);
      });

      const mergedByName = new Map<string, InventoryItem>();

      inventoryProducts.forEach((p) => {
        const name = p.product_name?.trim();
        if (!name) return;
        mergedByName.set(name, { ...p, product_name: name });
      });

      productNames.forEach((name, i) => {
        if (!mergedByName.has(name)) {
          mergedByName.set(name, {
            id: `setting-${i}-${name}`,
            product_name: name,
            unit_price: 0,
          });
        }
      });

      setProducts(Array.from(mergedByName.values()));
      setGiftNames(gifts);
      setCardNames(cards);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("orders").select("status, delivery_status").eq("agent_id", user.id).gte("created_at", monthStart.toISOString());
      if (data) {
        setMetrics({
          orders: data.length,
          delivered: data.filter(o => o.delivery_status === "delivered").length,
          cancelled: data.filter(o => o.status === "cancelled").length,
          returned: data.filter(o => o.delivery_status === "returned").length,
        });
      }
    })();
  }, [user, tick]);

  // Active data mode tab
  const [activeDataTab, setActiveDataTab] = useState<"lead" | "processing">("lead");

  // Apply filters
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (filterCampaignId !== "all") {
      result = result.filter(l => l.campaign_id === filterCampaignId);
    }
    if (filterWebsite !== "all") {
      result = result.filter(l => l.import_source === filterWebsite);
    }
    return result;
  }, [leads, filterCampaignId, filterWebsite]);

  // Split by data mode using campaign's data_mode
  const leadModeLeads = useMemo(() => {
    const leadCampaignIds = campaigns.filter(c => c.data_mode === "lead").map(c => c.id);
    return filteredLeads.filter(l => !l.campaign_id || leadCampaignIds.includes(l.campaign_id));
  }, [filteredLeads, campaigns]);

  const processingModeLeads = useMemo(() => {
    const procCampaignIds = campaigns.filter(c => c.data_mode === "processing").map(c => c.id);
    return filteredLeads.filter(l => l.campaign_id && procCampaignIds.includes(l.campaign_id));
  }, [filteredLeads, campaigns]);

  const getRequeueRemaining = (lead: LeadRow) => {
    if (!lead.requeue_at) return null;
    const remaining = differenceInMinutes(new Date(lead.requeue_at), new Date());
    return remaining > 0 ? remaining : null;
  };

  const salesRatio = metrics.orders > 0 ? ((metrics.orders / Math.max(leads.length + metrics.orders, 1)) * 100).toFixed(1) : "0";
  const receiveRatio = metrics.orders > 0 ? ((metrics.delivered / metrics.orders) * 100).toFixed(1) : "0";

  const handleLeadSave = async (lead: LeadRow & { __overrideStatus?: string }) => {
    const newStatus = (lead as any).__overrideStatus || leadStatuses[lead.id];
    if (!newStatus || !user) return;
    const calledTime = leadCalledTimes[lead.id] || lead.called_time || 1;
    const note = leadNotes[lead.id] ?? lead.special_note;

    // The value comes directly from dynamic config (e.g. "_order_confirm", "pre_order_confirm")
    const normalizedStatus = normalizeWorkflowStatus(newStatus);

    if (normalizedStatus.endsWith("order_confirm") && !normalizedStatus.includes("pre_order")) {
      setCurrentOrderLead(lead);
      setOrderAddress(lead.address || ""); setOrderProduct(""); setOrderQty(1); setOrderPrice(0); setOrderNote("");
      setOrderGiftName(""); setOrderAdvancePayment(0);
      setOrderPaymentMethod(""); setOrderCardName(""); setOrderMedia("");
      setOrderUpsell(""); setOrderSuccessRatio("");
      // Auto-detect district/thana from lead address
      const detected = detectLocation(lead.address || "");
      setOrderDistrict(detected.district); setOrderThana(detected.thana);
      setLocationAutoDetected(!!(detected.district));
      setDistrictSearch(""); setThanaSearch("");
      setShowOrderModal(true); return;
    }
    if (normalizedStatus === "pre_order") {
      setCurrentPreOrderLead(lead);
      setPreOrderDate(undefined); setPreOrderNote("");
      setShowPreOrderModal(true); return;
    }
    if (normalizedStatus.includes("pre_order_confirm") || (normalizedStatus.includes("pre_order") && normalizedStatus.includes("confirm"))) {
      setCurrentPreOrderConfirmLead(lead);
      const detected = detectLocation(lead.address || "");
      setPocDistrict(detected.district); setPocThana(detected.thana);
      setPocAddress(lead.address || ""); setPocProduct(""); setPocDeliveryDate(undefined);
      setShowPreOrderConfirmModal(true); return;
    }

    const updatePayload: Record<string, unknown> = {
      status: normalizedStatus, called_time: calledTime, special_note: note, called_date: new Date().toISOString(),
    };
    const selectedOpt = availableStatuses.find(s => s.value === newStatus);
    if (selectedOpt?.is_spam) {
      updatePayload.is_spam = true;
    }
    const hasNonEmployeeRoute = (selectedOpt?.next_panel && selectedOpt.next_panel !== "employee") ||
      (selectedOpt?.routes?.some(r => r.next_panel && r.next_panel !== "employee"));
    if (hasNonEmployeeRoute) {
      updatePayload.assigned_to = null;
    }
    const requeueStatuses = deleteSheetConfig?.statuses || DEFAULT_REQUEUE_STATUS_VALUES;
    const deleteThreshold = deleteSheetConfig?.threshold || DEFAULT_DELETE_SHEET_THRESHOLD;
    if (requeueStatuses.includes(normalizedStatus)) {
      const cnt = (lead.requeue_count || 0) + 1;
      updatePayload.requeue_count = cnt;
      updatePayload.requeue_at = addMinutes(new Date(), REQUEUE_MINUTES).toISOString();
      if (cnt >= deleteThreshold) updatePayload.status = "tl_delete_sheet";
    }
    const { error } = await supabase.from("leads").update(updatePayload).eq("id", lead.id);
    if (error) {
      toast.error("Lead আপডেট করা যায়নি");
      console.error(error);
      return;
    }
    toast.success("Lead আপডেট হয়েছে");
    setLeads((prev) => prev.filter((item) => item.id !== lead.id));
    loadLeads();
  };

  const handleOrderConfirm = async () => {
    if (!currentOrderLead || !user || !orderProduct) { toast.error(t("select_product_error")); return; }
    if (!orderPrice || orderPrice <= 0) { toast.error(t("enter_price")); return; }
    const { error } = await supabase.from("orders").insert({
      customer_name: currentOrderLead.name, phone: currentOrderLead.phone, address: orderAddress,
      product: orderProduct, quantity: orderQty, price: orderPrice, agent_id: user.id,
      tl_id: currentOrderLead.tl_id, lead_id: currentOrderLead.id, status: "pending_tl",
      district: orderDistrict || null, thana: orderThana || null, gift_name: orderGiftName || null,
      advance_payment: orderAdvancePayment || 0, payment_method: orderPaymentMethod || null,
      card_name: orderCardName || null, order_media: orderMedia || null,
      upsell: orderUpsell || null, success_ratio: orderSuccessRatio || null,
    } as any);
    if (error) { toast.error(t("order_create_error")); console.error(error); return; }
    const selectedStatusRaw = leadStatuses[currentOrderLead.id] || "order_confirm";
    const selectedStatus = normalizeWorkflowStatus(selectedStatusRaw);
    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({ status: selectedStatus, assigned_to: null, called_date: new Date().toISOString() })
      .eq("id", currentOrderLead.id);
    if (leadUpdateError) {
      toast.error("অর্ডার হয়েছে, কিন্তু লিড আপডেট হয়নি");
      console.error(leadUpdateError);
      loadLeads();
      return;
    }
    setShowOrderModal(false);
    toast.success(t("order_confirmed_success"));
    setLeads((prev) => prev.filter((item) => item.id !== currentOrderLead.id));
    loadLeads();
  };

  const handlePreOrderSubmit = async () => {
    if (!currentPreOrderLead || !user || !preOrderDate) { toast.error(t("select_date_error")); return; }
    const { error: preOrderError } = await supabase.from("pre_orders").insert({
      lead_id: currentPreOrderLead.id, agent_id: user.id, tl_id: currentPreOrderLead.tl_id,
      scheduled_date: format(preOrderDate, "yyyy-MM-dd"), note: preOrderNote || null,
    });
    if (preOrderError) {
      toast.error(t("pre_order_error"));
      console.error(preOrderError);
      return;
    }
    const selectedStatusRaw = leadStatuses[currentPreOrderLead.id] || "pre_order";
    const selectedStatus = normalizeWorkflowStatus(selectedStatusRaw);
    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({ status: selectedStatus, called_date: new Date().toISOString() })
      .eq("id", currentPreOrderLead.id);
    if (leadUpdateError) {
      toast.error("Pre-order হয়েছে, কিন্তু লিড আপডেট হয়নি");
      console.error(leadUpdateError);
      loadLeads();
      return;
    }
    setShowPreOrderModal(false);
    toast.success(t("pre_order_success"));
    setLeads((prev) => prev.filter((item) => item.id !== currentPreOrderLead.id));
    loadLeads();
  };

  const handlePreOrderConfirmSubmit = async () => {
    if (!currentPreOrderConfirmLead || !user) return;
    if (!pocProduct) { toast.error(t("select_product_error")); return; }
    if (!pocDeliveryDate) { toast.error(t("select_delivery_date")); return; }
    // Create order from pre-order confirm
    const { error } = await supabase.from("orders").insert({
      customer_name: currentPreOrderConfirmLead.name, phone: currentPreOrderConfirmLead.phone,
      address: [pocDistrict, pocThana, pocAddress].filter(Boolean).join(", ") || currentPreOrderConfirmLead.address,
      product: pocProduct, quantity: 1, price: products.find(p => p.product_name === pocProduct)?.unit_price || 0,
      agent_id: user.id, tl_id: currentPreOrderConfirmLead.tl_id, lead_id: currentPreOrderConfirmLead.id,
      status: "pending_tl", district: pocDistrict || null, thana: pocThana || null,
    } as any);
    if (error) { toast.error(t("order_create_error")); console.error(error); return; }
    const selectedStatusRaw = leadStatuses[currentPreOrderConfirmLead.id] || "pre_order_confirm";
    const selectedStatus = normalizeWorkflowStatus(selectedStatusRaw);
    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({ status: selectedStatus, assigned_to: null, called_date: new Date().toISOString() })
      .eq("id", currentPreOrderConfirmLead.id);
    if (leadUpdateError) {
      toast.error("Pre-Order হয়েছে, কিন্তু লিড আপডেট হয়নি");
      console.error(leadUpdateError);
      loadLeads();
      return;
    }
    setShowPreOrderConfirmModal(false);
    toast.success(t("pre_order_confirm_success"));
    setLeads((prev) => prev.filter((item) => item.id !== currentPreOrderConfirmLead.id));
    loadLeads();
  };

  // Only these keys from special_note JSON are visible to agents
  const ALLOWED_RAW_KEYS = new Set(["order_id", "product"]);

  const extractLeadRawData = (note: string | null): Record<string, string> => {
    if (!note) return {};
    try {
      const parsed = JSON.parse(note);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const result: Record<string, string> = {};

        Object.entries(parsed).forEach(([k, v]) => {
          if (k === "extra_fields" && v && typeof v === "object" && !Array.isArray(v)) {
            // Flatten ALL extra_fields keys into the result dynamically
            const extraFields = v as Record<string, unknown>;
            Object.entries(extraFields).forEach(([ek, ev]) => {
              if (ev != null && String(ev).trim() !== "") {
                result[ek] = String(ev);
              }
            });
            return;
          }
          result[k] = v != null ? String(v) : "";
        });

        return result;
      }
    } catch {
      /* not JSON */
    }
    return {};
  };

  const rawDataKeys = useMemo(() => {
    const keySet = new Set<string>();
    leads.forEach((lead) => {
      const parsed = extractLeadRawData(lead.special_note);
      Object.keys(parsed).forEach((k) => {
        if (ALLOWED_RAW_KEYS.has(k)) keySet.add(k);
      });
    });
    return Array.from(keySet);
  }, [leads]);

  const parseSpecialNote = (note: string | null): Record<string, string> => extractLeadRawData(note);

  if (loading) return <div className="p-6 text-muted-foreground">{t("loading")}</div>;

  if (!checkedIn) {
    return (
      <div className="space-y-6">
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-orange-400" />
            <h2 className="font-heading text-lg mb-2">{t("check_in_first")}</h2>
            <p className="text-sm text-muted-foreground">{t("check_in_to_see_leads")}</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/employee/dashboard"}>
              {t("go_to_dashboard")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderLeadTable = (leadList: LeadRow[]) => {
    const dropdownCols = dynamicColumns.filter(c => c.type === "dropdown");
    const noteCols = dynamicColumns.filter(c => c.type === "note");
    const totalCols = 4 + rawDataKeys.length + dropdownCols.length + noteCols.length + (waTemplates.length > 0 ? 1 : 0);

    // ── Mobile Card View ──
    if (isMobile) {
      if (leadList.length === 0) {
        return <div className="py-8 text-center text-muted-foreground text-sm">{t("no_leads_empty")}</div>;
      }
      return (
        <div className="space-y-3">
          {leadList.map((lead, idx) => {
            const requeueRemaining = getRequeueRemaining(lead);
            const isRequeued = requeueRemaining !== null && requeueRemaining > 0;
            const rawData = parseSpecialNote(lead.special_note);

            return (
              <div
                key={lead.id}
                className={cn(
                  "border border-border rounded-lg p-3 space-y-2.5 bg-card",
                  isRequeued && "opacity-50 pointer-events-none bg-muted/30"
                )}
              >
                {/* Header row: # + name */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                  {isRequeued && (
                    <Badge variant="outline" className="text-orange-400 border-orange-400/50 text-[10px]">
                      ⏳ {requeueRemaining} {t("minutes_wait")}
                    </Badge>
                  )}
                  {waTemplates.length > 0 && !isRequeued && (
                    <button
                      onClick={() => {
                        setWaCurrentLead(lead);
                        setWaRecipientPhone(lead.phone || "");
                        setWaSelectedTemplate("");
                        setShowWaModal(true);
                      }}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Name + Phone */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{lead.name || "—"}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">{lead.phone || "—"}</span>
                    {lead.phone && <CopyButton text={lead.phone} />}
                  </div>
                </div>

                {/* Address */}
                <div className="text-xs text-muted-foreground">
                  <AddressTooltip address={lead.address} />
                </div>

                {/* Raw data fields */}
                {rawDataKeys.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {rawDataKeys.map(key => (
                      <span key={key}>
                        <span className="text-muted-foreground">{key}:</span>{" "}
                        <span className="text-foreground">{rawData[key] || "—"}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Status dropdowns */}
                {!isRequeued && dropdownCols.map(col => {
                  const selectedValue = leadStatuses[lead.id] || (col.options.some(o => o.value === (lead.status || "")) ? (lead.status || "") : "");
                  const selectedOption = col.options.find(o => o.value === selectedValue);

                  return (
                    <div key={col.id}>
                      <label className="text-[10px] text-muted-foreground font-medium">{isBn ? (col.name_bn || col.name) : col.name}</label>
                      <Select value={selectedValue} onValueChange={v => {
                        setLeadStatuses(p => ({ ...p, [lead.id]: v }));
                        const ns = v.toLowerCase().replace(/\s+/g, "_");
                        if (ns.endsWith("order_confirm") && !ns.includes("pre_order")) {
                          setCurrentOrderLead(lead);
                          setOrderAddress(lead.address || ""); setOrderProduct(""); setOrderQty(1); setOrderPrice(0); setOrderNote("");
                          setOrderGiftName(""); setOrderAdvancePayment(0);
                          setOrderPaymentMethod(""); setOrderCardName(""); setOrderMedia("");
                          setOrderUpsell(""); setOrderSuccessRatio("");
                          const detected = detectLocation(lead.address || "");
                          setOrderDistrict(detected.district); setOrderThana(detected.thana);
                          setLocationAutoDetected(!!(detected.district));
                          setDistrictSearch(""); setThanaSearch("");
                          setTimeout(() => setShowOrderModal(true), 100);
                        } else if (ns === "pre_order") {
                          setCurrentPreOrderLead(lead);
                          setPreOrderDate(undefined); setPreOrderNote("");
                          setTimeout(() => setShowPreOrderModal(true), 100);
                        } else if (ns.includes("pre_order_confirm") || (ns.includes("pre_order") && ns.includes("confirm"))) {
                          setCurrentPreOrderConfirmLead(lead);
                          const detected = detectLocation(lead.address || "");
                          setPocDistrict(detected.district); setPocThana(detected.thana);
                          setPocAddress(lead.address || ""); setPocProduct(""); setPocDeliveryDate(undefined);
                          setTimeout(() => setShowPreOrderConfirmModal(true), 100);
                        } else {
                          setTimeout(() => { handleLeadSave({ ...lead, __overrideStatus: v } as any); }, 50);
                        }
                      }}>
                        <SelectTrigger className={cn("h-9 text-xs mt-1", selectedOption && getStatusColorClasses(selectedOption.color))}>
                          {selectedOption ? (
                            <span className="truncate">{isBn ? (selectedOption.label_bn || selectedOption.label) : selectedOption.label}</span>
                          ) : (
                            <SelectValue placeholder={isBn ? (col.name_bn || "স্ট্যাটাস") : col.name} />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {col.options.map(o => (
                            <SelectItem key={o.value} value={o.value} className={cn("font-medium", getStatusColorClasses(o.color))}>
                              {isBn ? (o.label_bn || o.label) : o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}

                {/* Fallback statuses if no dynamic columns */}
                {!isRequeued && dropdownCols.length === 0 && (() => {
                  const selectedValue = leadStatuses[lead.id] || (availableStatuses.some(s => s.value === (lead.status || "")) ? (lead.status || "") : "");
                  const selectedOption = availableStatuses.find(s => s.value === selectedValue);

                  return (
                    <Select value={selectedValue} onValueChange={v => {
                      setLeadStatuses(p => ({ ...p, [lead.id]: v }));
                      const ns = v.toLowerCase().replace(/\s+/g, "_");
                      if (ns.endsWith("order_confirm") && !ns.includes("pre_order")) {
                        setCurrentOrderLead(lead);
                        setOrderAddress(lead.address || ""); setOrderProduct(""); setOrderQty(1); setOrderPrice(0); setOrderNote("");
                        setOrderGiftName(""); setOrderAdvancePayment(0);
                        setOrderPaymentMethod(""); setOrderCardName(""); setOrderMedia("");
                        setOrderUpsell(""); setOrderSuccessRatio("");
                        const detected = detectLocation(lead.address || "");
                        setOrderDistrict(detected.district); setOrderThana(detected.thana);
                        setLocationAutoDetected(!!(detected.district));
                        setDistrictSearch(""); setThanaSearch("");
                        setTimeout(() => setShowOrderModal(true), 100);
                      } else if (ns === "pre_order") {
                        setCurrentPreOrderLead(lead);
                        setPreOrderDate(undefined); setPreOrderNote("");
                        setTimeout(() => setShowPreOrderModal(true), 100);
                      } else if (ns.includes("pre_order_confirm") || (ns.includes("pre_order") && ns.includes("confirm"))) {
                        setCurrentPreOrderConfirmLead(lead);
                        const detected = detectLocation(lead.address || "");
                        setPocDistrict(detected.district); setPocThana(detected.thana);
                        setPocAddress(lead.address || ""); setPocProduct(""); setPocDeliveryDate(undefined);
                        setTimeout(() => setShowPreOrderConfirmModal(true), 100);
                      } else {
                        setTimeout(() => { handleLeadSave({ ...lead, __overrideStatus: v } as any); }, 50);
                      }
                    }}>
                      <SelectTrigger className={cn("h-9 text-xs", selectedOption && getStatusColorClasses(selectedOption.color))}>
                        {selectedOption ? (
                          <span className="truncate">{isBn ? (selectedOption.label_bn || selectedOption.label) : selectedOption.label}</span>
                        ) : (
                          <SelectValue placeholder={t("status")} />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map(s => (
                          <SelectItem key={s.value} value={s.value} className={cn("font-medium", getStatusColorClasses(s.color))}>
                            {isBn ? (s.label_bn || s.label) : s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}

                {/* Note columns */}
                {noteCols.map(col => (
                  <div key={col.id}>
                    <label className="text-[10px] text-muted-foreground font-medium">{isBn ? (col.name_bn || col.name) : col.name}</label>
                    <Input
                      className="h-9 text-xs mt-1"
                      placeholder={isBn ? (col.name_bn || col.name) : col.name}
                      value={leadNotes[`${lead.id}_${col.id}`] || ""}
                      onChange={e => setLeadNotes(p => ({ ...p, [`${lead.id}_${col.id}`]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      );
    }

    // ── Desktop Table View ──
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 px-2 text-left">#</th>
              <th className="py-2 px-2 text-left">{t("customer")}</th>
              <th className="py-2 px-2 text-left">{t("phone")}</th>
              <th className="py-2 px-2 text-left">{t("address")}</th>
              {rawDataKeys.map(key => (
                <th key={key} className="py-2 px-2 text-left whitespace-nowrap">{key}</th>
              ))}
              {dropdownCols.map(col => (
                <th key={col.id} className="py-2 px-2 text-left whitespace-nowrap">{isBn ? (col.name_bn || col.name) : col.name}</th>
              ))}
              {noteCols.map(col => (
                <th key={col.id} className="py-2 px-2 text-left whitespace-nowrap">{isBn ? (col.name_bn || col.name) : col.name}</th>
              ))}
              {waTemplates.length > 0 && (
                <th className="py-2 px-2 text-center whitespace-nowrap">
                  <MessageCircle className="h-3.5 w-3.5 inline" />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {leadList.map((lead, idx) => {
              const requeueRemaining = getRequeueRemaining(lead);
              const isRequeued = requeueRemaining !== null && requeueRemaining > 0;
              const rawData = parseSpecialNote(lead.special_note);
              return (
                <tr key={lead.id} className={cn("border-b border-border", isRequeued && "opacity-50 pointer-events-none bg-muted/30")}>
                  <td className="py-2 px-2">{idx + 1}</td>
                  <td className="py-2 px-2 whitespace-nowrap">{lead.name || "—"}</td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>{lead.phone || "—"}</span>
                      {lead.phone && <CopyButton text={lead.phone} />}
                    </div>
                  </td>
                  <td className="py-2 px-2 max-w-[150px]">
                    <AddressTooltip address={lead.address} />
                  </td>
                  {rawDataKeys.map(key => (
                    <td key={key} className="py-2 px-2 max-w-[150px] truncate">{rawData[key] || "—"}</td>
                  ))}
                  {dropdownCols.map(col => {
                    const selectedValue = leadStatuses[lead.id] || (col.options.some(o => o.value === (lead.status || "")) ? (lead.status || "") : "");
                    const selectedOption = col.options.find(o => o.value === selectedValue);

                    return (
                      <td key={col.id} className="py-2 px-2 min-w-[180px]">
                        {isRequeued ? (
                          <Badge variant="outline" className="text-orange-400 border-orange-400/50">⏳ {requeueRemaining} {t("minutes_wait")}</Badge>
                        ) : (
                          <Select value={selectedValue} onValueChange={v => {
                            setLeadStatuses(p => ({ ...p, [lead.id]: v }));
                            const ns = v.toLowerCase().replace(/\s+/g, "_");
                            if (ns.endsWith("order_confirm") && !ns.includes("pre_order")) {
                              setCurrentOrderLead(lead);
                              setOrderAddress(lead.address || ""); setOrderProduct(""); setOrderQty(1); setOrderPrice(0); setOrderNote("");
                              setOrderGiftName(""); setOrderAdvancePayment(0);
                              setOrderPaymentMethod(""); setOrderCardName(""); setOrderMedia("");
                              setOrderUpsell(""); setOrderSuccessRatio("");
                              const detected = detectLocation(lead.address || "");
                              setOrderDistrict(detected.district); setOrderThana(detected.thana);
                              setLocationAutoDetected(!!(detected.district));
                              setDistrictSearch(""); setThanaSearch("");
                              setTimeout(() => setShowOrderModal(true), 100);
                            } else if (ns === "pre_order") {
                              setCurrentPreOrderLead(lead);
                              setPreOrderDate(undefined); setPreOrderNote("");
                              setTimeout(() => setShowPreOrderModal(true), 100);
                            } else if (ns.includes("pre_order_confirm") || (ns.includes("pre_order") && ns.includes("confirm"))) {
                              setCurrentPreOrderConfirmLead(lead);
                              const detected = detectLocation(lead.address || "");
                              setPocDistrict(detected.district); setPocThana(detected.thana);
                              setPocAddress(lead.address || ""); setPocProduct(""); setPocDeliveryDate(undefined);
                              setTimeout(() => setShowPreOrderConfirmModal(true), 100);
                            } else {
                              setTimeout(() => {
                                handleLeadSave({ ...lead, __overrideStatus: v } as any);
                              }, 50);
                            }
                          }}>
                            <SelectTrigger className={cn("h-8 text-xs", selectedOption && getStatusColorClasses(selectedOption.color))}>
                              {selectedOption ? (
                                <span className="truncate">{isBn ? (selectedOption.label_bn || selectedOption.label) : selectedOption.label}</span>
                              ) : (
                                <SelectValue placeholder={isBn ? (col.name_bn || "স্ট্যাটাস") : col.name} />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {col.options.map(o => (
                                <SelectItem key={o.value} value={o.value} className={cn("font-medium", getStatusColorClasses(o.color))}>
                                  {isBn ? (o.label_bn || o.label) : o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    );
                  })}
                  {dropdownCols.length === 0 && (() => {
                    const selectedValue = leadStatuses[lead.id] || (availableStatuses.some(s => s.value === (lead.status || "")) ? (lead.status || "") : "");
                    const selectedOption = availableStatuses.find(s => s.value === selectedValue);

                    return (
                      <td className="py-2 px-2 min-w-[180px]">
                        {isRequeued ? (
                          <Badge variant="outline" className="text-orange-400 border-orange-400/50">⏳ {requeueRemaining} {t("minutes_wait")}</Badge>
                        ) : (
                          <Select value={selectedValue} onValueChange={v => {
                            setLeadStatuses(p => ({ ...p, [lead.id]: v }));
                            const ns = v.toLowerCase().replace(/\s+/g, "_");
                            if (ns.endsWith("order_confirm") && !ns.includes("pre_order")) {
                              setCurrentOrderLead(lead);
                              setOrderAddress(lead.address || ""); setOrderProduct(""); setOrderQty(1); setOrderPrice(0); setOrderNote("");
                              setOrderGiftName(""); setOrderAdvancePayment(0);
                              setOrderPaymentMethod(""); setOrderCardName(""); setOrderMedia("");
                              setOrderUpsell(""); setOrderSuccessRatio("");
                              const detected = detectLocation(lead.address || "");
                              setOrderDistrict(detected.district); setOrderThana(detected.thana);
                              setLocationAutoDetected(!!(detected.district));
                              setDistrictSearch(""); setThanaSearch("");
                              setTimeout(() => setShowOrderModal(true), 100);
                            } else if (ns === "pre_order") {
                              setCurrentPreOrderLead(lead);
                              setPreOrderDate(undefined); setPreOrderNote("");
                              setTimeout(() => setShowPreOrderModal(true), 100);
                            } else if (ns.includes("pre_order_confirm") || (ns.includes("pre_order") && ns.includes("confirm"))) {
                              setCurrentPreOrderConfirmLead(lead);
                              const detected = detectLocation(lead.address || "");
                              setPocDistrict(detected.district); setPocThana(detected.thana);
                              setPocAddress(lead.address || ""); setPocProduct(""); setPocDeliveryDate(undefined);
                              setTimeout(() => setShowPreOrderConfirmModal(true), 100);
                            } else {
                              setTimeout(() => {
                                handleLeadSave({ ...lead, __overrideStatus: v } as any);
                              }, 50);
                            }
                          }}>
                            <SelectTrigger className={cn("h-8 text-xs", selectedOption && getStatusColorClasses(selectedOption.color))}>
                              {selectedOption ? (
                                <span className="truncate">{isBn ? (selectedOption.label_bn || selectedOption.label) : selectedOption.label}</span>
                              ) : (
                                <SelectValue placeholder={t("status")} />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {availableStatuses.map(s => (
                                <SelectItem key={s.value} value={s.value} className={cn("font-medium", getStatusColorClasses(s.color))}>
                                  {isBn ? (s.label_bn || s.label) : s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    );
                  })()}
                  {noteCols.map(col => (
                    <td key={col.id} className="py-2 px-2 min-w-[120px]">
                      <Input
                        className="h-8 text-xs"
                        placeholder={isBn ? (col.name_bn || col.name) : col.name}
                        value={leadNotes[`${lead.id}_${col.id}`] || ""}
                        onChange={e => setLeadNotes(p => ({ ...p, [`${lead.id}_${col.id}`]: e.target.value }))}
                      />
                    </td>
                  ))}
                  {waTemplates.length > 0 && (
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => {
                          setWaCurrentLead(lead);
                          setWaRecipientPhone(lead.phone || "");
                          setWaSelectedTemplate("");
                          setShowWaModal(true);
                        }}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                        title={isBn ? "WhatsApp মেসেজ পাঠান" : "Send WhatsApp"}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {leadList.length === 0 && (
              <tr><td colSpan={totalCols} className="py-8 text-center text-muted-foreground">{t("no_leads_empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-20">
      <FraudChecker />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="font-heading text-lg sm:text-xl flex items-center gap-2">
          <Target className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> {t("lead_sheet_title")}
        </h1>
        <div className="flex gap-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
          <span>{t("sales_ratio")}: <strong className="text-foreground">{salesRatio}%</strong></span>
          <span>{t("receive_ratio")}: <strong className="text-foreground">{receiveRatio}%</strong></span>
          <span>{t("orders_count")}: <strong className="text-foreground">{metrics.orders}</strong></span>
        </div>
      </div>

      {/* Filters */}
      {(campaigns.length > 0 || leads.length > 0) && (
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={filterCampaignId} onValueChange={v => { setFilterCampaignId(v); setFilterWebsite("all"); }}>
            <SelectTrigger className="h-8 w-[140px] sm:w-[180px] text-xs"><SelectValue placeholder={isBn ? "ক্যাম্পেইন" : "Campaign"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isBn ? "সব ক্যাম্পেইন" : "All Campaigns"}</SelectItem>
              {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {(() => {
            const filteredSites = filterCampaignId !== "all"
              ? websites.filter(w => w.campaign_id === filterCampaignId)
              : websites;
            return filteredSites.length > 0 ? (
              <Select value={filterWebsite} onValueChange={setFilterWebsite}>
                <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder={isBn ? "ওয়েবসাইট" : "Website"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isBn ? "সব ওয়েবসাইট" : "All Websites"}</SelectItem>
                  {filteredSites.map(w => <SelectItem key={w.id} value={w.site_name}>{w.site_name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null;
          })()}
        </div>
      )}

      {/* Data Request Button */}
      {leads.length === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-6 text-center">
            <Database className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground mb-3">{t("no_leads_request")}</p>
            <Button onClick={() => setShowDataRequestModal(true)} className="gap-2">
              <Send className="h-4 w-4" /> {t("send_data_request")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent requests */}
      {pendingRequests.length > 0 && (
        <div className="flex gap-2 flex-wrap text-xs">
          {pendingRequests.filter(r => r.status === 'pending').length > 0 && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/50">
              ⏳ {pendingRequests.filter(r => r.status === 'pending').length} {t("requests_pending")}
            </Badge>
          )}
          {pendingRequests.filter(r => r.status === 'fulfilled').length > 0 && (
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/50">
              ✓ {pendingRequests.filter(r => r.status === 'fulfilled').length} {t("requests_fulfilled")}
            </Badge>
          )}
        </div>
      )}

      <div>
        <Tabs value={activeDataTab} onValueChange={(v) => setActiveDataTab(v as "lead" | "processing")} className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="lead" className="flex-1 sm:flex-none text-xs sm:text-sm">🎯 {isBn ? "লিড" : "Lead"} ({leadModeLeads.length})</TabsTrigger>
              <TabsTrigger value="processing" className="flex-1 sm:flex-none text-xs sm:text-sm">⚙️ {isBn ? "প্রসেসিং" : "Processing"} ({processingModeLeads.length})</TabsTrigger>
            </TabsList>
            {leads.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowDataRequestModal(true)} className="gap-1.5 text-xs">
                <Send className="h-3.5 w-3.5" /> {t("need_data")}
              </Button>
            )}
          </div>
          <TabsContent value="lead">
            <Card><CardContent className="p-0 sm:p-2">{renderLeadTable(leadModeLeads)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="processing">
            <Card><CardContent className="p-0 sm:p-2">{renderLeadTable(processingModeLeads)}</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Order Confirm Modal */}
      <Dialog open={showOrderModal} onOpenChange={(open) => {
        if (!open && currentOrderLead) {
          setLeadStatuses(p => { const n = { ...p }; delete n[currentOrderLead.id]; return n; });
        }
        setShowOrderModal(open);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("order_confirmation")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Name & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("name")} *</Label><Input value={currentOrderLead?.name || ""} readOnly className="mt-1 bg-muted" /></div>
              <div><Label>{t("phone")} *</Label><Input value={currentOrderLead?.phone || ""} readOnly className="mt-1 bg-muted" /></div>
            </div>

            {/* District & Thana */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("district")}</Label>
                <Select value={orderDistrict} onValueChange={v => { setOrderDistrict(v); setOrderThana(""); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_district")} /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-2">
                      <Input placeholder={t("search_ph")} value={districtSearch} onChange={e => setDistrictSearch(e.target.value)} className="h-8 text-xs" />
                    </div>
                    {BD_DISTRICTS
                      .filter(d => !districtSearch || d.name.toLowerCase().includes(districtSearch.toLowerCase()) || d.name_bn.includes(districtSearch))
                      .map(d => <SelectItem key={d.name} value={d.name}>{d.name_bn} ({d.name})</SelectItem>)}
                  </SelectContent>
                </Select>
                {locationAutoDetected && orderDistrict && <p className="text-xs text-emerald-500 mt-0.5">{t("auto_detected")}</p>}
                {!orderDistrict && currentOrderLead?.address && <p className="text-xs text-amber-500 mt-0.5">{t("manual_search")}</p>}
              </div>
              <div>
                <Label>{t("thana")}</Label>
                <Select value={orderThana} onValueChange={setOrderThana} disabled={!orderDistrict}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_thana")} /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-2">
                      <Input placeholder={t("search_ph")} value={thanaSearch} onChange={e => setThanaSearch(e.target.value)} className="h-8 text-xs" />
                    </div>
                    {(BD_DISTRICTS.find(d => d.name === orderDistrict)?.thanas || [])
                      .filter(t => !thanaSearch || t.name.toLowerCase().includes(thanaSearch.toLowerCase()) || t.name_bn.includes(thanaSearch))
                      .map(t => <SelectItem key={t.name} value={t.name}>{t.name_bn} ({t.name})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location / Address */}
            <div>
              <Label>{t("location")}</Label>
              <Input value={orderAddress} onChange={e => setOrderAddress(e.target.value)} className="mt-1" placeholder={t("full_address")} />
            </div>

            {/* Product & Gift */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("product_name")} *</Label>
                <Select value={orderProduct} onValueChange={v => { setOrderProduct(v); const p = products.find(pr => pr.product_name === v); if (p) setOrderPrice(p.unit_price || 0); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_product_ph")} /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.product_name}>{p.product_name} (৳{p.unit_price})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("gift_name")}</Label>
                <Select value={orderGiftName} onValueChange={setOrderGiftName}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_gift")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("no_gift")}</SelectItem>
                    {giftNames.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amount & Advance */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("amount_label")} *</Label><Input type="number" value={orderPrice} onChange={e => setOrderPrice(Number(e.target.value))} className="mt-1" placeholder="৳" /></div>
              <div><Label>{t("advance_payment")}</Label><Input type="number" value={orderAdvancePayment} onChange={e => setOrderAdvancePayment(Number(e.target.value))} className="mt-1" placeholder="৳" /></div>
            </div>

            {/* Payment Method & Card */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("payment_method")}</Label>
                <Select value={orderPaymentMethod} onValueChange={setOrderPaymentMethod}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_method")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cod">{t("cod")}</SelectItem>
                    <SelectItem value="bkash">{t("bkash")}</SelectItem>
                    <SelectItem value="nagad">{t("nagad")}</SelectItem>
                    <SelectItem value="rocket">{t("rocket")}</SelectItem>
                    <SelectItem value="bank">{t("bank_transfer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("card_name_label")}</Label>
                <Select value={orderCardName} onValueChange={setOrderCardName}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_card")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("no_card")}</SelectItem>
                    {cardNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quantity & Order Media */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("quantity")}</Label><Input type="number" min={1} value={orderQty} onChange={e => setOrderQty(Number(e.target.value))} className="mt-1" /></div>
              <div>
                <Label>{t("order_media")}</Label>
                <Select value={orderMedia} onValueChange={setOrderMedia}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_media")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="phone_call">Phone Call</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Upsell & Success Ratio */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("upsell")}</Label>
                <Select value={orderUpsell} onValueChange={setOrderUpsell}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_upsell")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("none")}</SelectItem>
                    <SelectItem value="01_to_02">০১ থেকে ০২</SelectItem>
                    <SelectItem value="02_to_03">০২ থেকে ০৩</SelectItem>
                    <SelectItem value="03_to_04">০৩ থেকে ০৪</SelectItem>
                    <SelectItem value="04_to_05">০৪ থেকে ০৫</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("success_ratio_label")} *</Label>
                <Input type="number" min={1} max={100} value={orderSuccessRatio} onChange={e => setOrderSuccessRatio(e.target.value ? Number(e.target.value) : "")} className="mt-1" placeholder="1-100" />
              </div>
            </div>

            {/* Note */}
            <div><Label>{t("note")}</Label><Textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderModal(false)}>{t("cancel")}</Button>
            <Button onClick={handleOrderConfirm} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">{t("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-Order Modal (simple) */}
      <Dialog open={showPreOrderModal} onOpenChange={(open) => {
        if (!open && currentPreOrderLead) {
          setLeadStatuses(p => { const n = { ...p }; delete n[currentPreOrderLead.id]; return n; });
        }
        setShowPreOrderModal(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("pre_order")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("customer")}</Label><Input value={currentPreOrderLead?.name || ""} readOnly className="mt-1 bg-muted" /></div>
            <div><Label>{t("phone")}</Label><Input value={currentPreOrderLead?.phone || ""} readOnly className="mt-1 bg-muted" /></div>
            <div>
              <Label>{t("delivery_date")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left", !preOrderDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {preOrderDate ? format(preOrderDate, "PPP") : t("select_date_ph")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={preOrderDate} onSelect={setPreOrderDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>{t("note")}</Label><Textarea value={preOrderNote} onChange={e => setPreOrderNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handlePreOrderSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">{t("submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-Order Confirm Modal */}
      <Dialog open={showPreOrderConfirmModal} onOpenChange={(open) => {
        if (!open && currentPreOrderConfirmLead) {
          setLeadStatuses(p => { const n = { ...p }; delete n[currentPreOrderConfirmLead.id]; return n; });
        }
        setShowPreOrderConfirmModal(open);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("pre_order_confirm_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("name")} *</Label><Input value={currentPreOrderConfirmLead?.name || ""} readOnly className="mt-1 bg-muted" /></div>
              <div><Label>{t("phone")} *</Label><Input value={currentPreOrderConfirmLead?.phone || ""} readOnly className="mt-1 bg-muted" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("district")}</Label>
                <Select value={pocDistrict} onValueChange={v => { setPocDistrict(v); setPocThana(""); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_district")} /></SelectTrigger>
                  <SelectContent>
                    {BD_DISTRICTS.map(d => <SelectItem key={d.name} value={d.name}>{d.name_bn} ({d.name})</SelectItem>)}
                  </SelectContent>
                </Select>
                {!pocDistrict && currentPreOrderConfirmLead?.address && <p className="text-xs text-amber-500 mt-0.5">{t("manual_search")}</p>}
              </div>
              <div>
                <Label>{t("thana")}</Label>
                <Select value={pocThana} onValueChange={setPocThana} disabled={!pocDistrict}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_thana")} /></SelectTrigger>
                  <SelectContent>
                    {(BD_DISTRICTS.find(d => d.name === pocDistrict)?.thanas || []).map(th => <SelectItem key={th.name} value={th.name}>{th.name_bn} ({th.name})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("location")}</Label>
              <Input value={pocAddress} onChange={e => setPocAddress(e.target.value)} className="mt-1" placeholder={t("full_address")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("product")} *</Label>
                <Select value={pocProduct} onValueChange={setPocProduct}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_product_ph")} /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.product_name}>{p.product_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("preferred_delivery_date")} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left", !pocDeliveryDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pocDeliveryDate ? format(pocDeliveryDate, "PPP") : t("select_date_ph")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={pocDeliveryDate} onSelect={setPocDeliveryDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreOrderConfirmModal(false)}>{t("cancel")}</Button>
            <Button onClick={handlePreOrderConfirmSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">{t("save_pre_order")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Send Modal */}
      <Dialog open={showWaModal} onOpenChange={setShowWaModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-500" />
              {isBn ? "WhatsApp মেসেজ পাঠান" : "Send WhatsApp Message"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{isBn ? "কাস্টমার" : "Customer"}</Label>
              <Input value={waCurrentLead?.name || ""} readOnly className="mt-1 bg-muted" />
            </div>
            <div>
              <Label>{isBn ? "প্রাপকের নম্বর" : "Recipient Number"}</Label>
              <Input value={waRecipientPhone} onChange={e => setWaRecipientPhone(e.target.value)} className="mt-1" placeholder="+880..." />
            </div>
            <div>
              <Label>{isBn ? "টেমপ্লেট নির্বাচন করুন" : "Select Template"}</Label>
              <Select value={waSelectedTemplate} onValueChange={setWaSelectedTemplate}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={isBn ? "টেমপ্লেট বাছুন" : "Choose template"} /></SelectTrigger>
                <SelectContent>
                  {waTemplates.map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      <span className="flex items-center gap-2">
                        {tpl.image_url && <img src={tpl.image_url} alt="" className="h-5 w-5 rounded object-cover inline-block" />}
                        {tpl.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Preview selected template */}
            {waSelectedTemplate && (() => {
              const tpl = waTemplates.find(t => t.id === waSelectedTemplate);
              if (!tpl) return null;
              const preview = tpl.body
                .replace(/\{\{name\}\}/g, waCurrentLead?.name || "")
                .replace(/\{\{phone\}\}/g, waRecipientPhone || "")
                .replace(/\{\{address\}\}/g, waCurrentLead?.address || "");
              return (
                <div className="border border-emerald-500/20 bg-emerald-500/5 rounded p-3 space-y-2">
                  <p className="text-[10px] font-bold text-emerald-600">{isBn ? "প্রিভিউ" : "Preview"}</p>
                  {tpl.image_url && <img src={tpl.image_url} alt="" className="w-full max-h-32 object-cover rounded" />}
                  <p className="text-xs whitespace-pre-wrap text-foreground">{preview}</p>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWaModal(false)}>{isBn ? "বাতিল" : "Cancel"}</Button>
            <Button
              onClick={handleWhatsAppSend}
              disabled={waSending || !waSelectedTemplate || !waRecipientPhone}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="h-4 w-4" />
              {waSending ? (isBn ? "পাঠানো হচ্ছে..." : "Sending...") : (isBn ? "পাঠান" : "Send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={showDataRequestModal} onOpenChange={setShowDataRequestModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("data_request_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("data_request_desc")}</p>
            <div>
              <Label>{t("message_optional")}</Label>
              <Textarea value={dataRequestMsg} onChange={e => setDataRequestMsg(e.target.value)} className="mt-1" rows={3} placeholder={t("data_type_hint")} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleDataRequest} disabled={dataRequestLoading} className="gap-2">
              <Send className="h-4 w-4" /> {dataRequestLoading ? t("sending_request") : t("send_request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
