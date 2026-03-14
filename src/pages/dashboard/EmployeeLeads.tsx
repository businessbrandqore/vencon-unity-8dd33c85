import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { CalendarIcon, Target, AlertTriangle, Database, Send, Search } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { BD_DISTRICTS, detectLocation } from "@/lib/bdLocations";

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
  note?: string;
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

// Statuses that trigger requeue
const REQUEUE_STATUS_VALUES = ["phone_off", "positive", "customer_reschedule", "do_not_pick", "no_response", "busy_now", "number_busy"];
const REQUEUE_MINUTES = 40;
const DELETE_SHEET_THRESHOLD = 5;

// Statuses that trigger special modals
const MODAL_STATUSES = ["order_confirm", "pre_order", "pre_order_confirm"];

export default function EmployeeLeads() {
  const { user } = useAuth();

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [dynamicColumns, setDynamicColumns] = useState<StatusColumn[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

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

  // Load dynamic config from campaign_data_operations
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get agent's campaign
      const { data: carData } = await supabase.from("campaign_agent_roles")
        .select("campaign_id, is_bronze, is_silver").eq("agent_id", user.id).limit(1).maybeSingle();
      if (!carData?.campaign_id) { setConfigLoaded(true); return; }

      // Load config
      const { data: configData } = await supabase.from("campaign_data_operations")
        .select("fields_config").eq("campaign_id", carData.campaign_id).maybeSingle();
      if (!configData?.fields_config) { setConfigLoaded(true); return; }

      // Determine role key
      const roleKey = carData.is_silver ? "silver_agent" : "telesales_executive";
      const configs = configData.fields_config as unknown as RoleColumnConfig[];
      const roleConfig = configs.find(c => c.role === roleKey) || configs[0];
      if (roleConfig?.columns?.length) {
        setDynamicColumns(roleConfig.columns);
      }
      setConfigLoaded(true);
    })();
  }, [user]);

  // Compute available statuses from dynamic config or fallback
  const availableStatuses = useMemo(() => {
    if (dynamicColumns.length > 0) {
      const dropdownCol = dynamicColumns.find(c => c.type === "dropdown");
      if (dropdownCol?.options?.length) {
        return dropdownCol.options.map(o => ({ value: o.value, label: o.label || o.value, label_bn: o.label_bn, next_panel: o.next_panel, next_location: o.next_location }));
      }
    }
    return FALLBACK_STATUSES.map(s => ({ ...s, next_panel: undefined, next_location: undefined }));
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
    // Load all leads assigned to this agent, excluding terminal statuses
    const terminalStatuses = ["negative","not_interested","cancelled","wrong_number","duplicate","already_ordered"];
    const { data } = await supabase.from("leads").select("*").eq("assigned_to", user.id)
      .not("status", "in", `(${terminalStatuses.join(",")})`);
    if (data) setLeads(data as LeadRow[]);
  }, [user]);

  useEffect(() => { if (checkedIn) { loadLeads(); loadMyRequests(); } }, [checkedIn, loadLeads]);

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
      if (!carData?.[0]?.tl_id) { toast.error("টিম লিডার পাওয়া যায়নি"); setDataRequestLoading(false); return; }
      await supabase.from("data_requests").insert({ requested_by: user.id, tl_id: carData[0].tl_id, campaign_id: carData[0].campaign_id, message: dataRequestMsg || null });
    } else {
      await supabase.from("data_requests").insert({ requested_by: user.id, tl_id: tlId, message: dataRequestMsg || null });
    }
    toast.success("ডাটা রিকোয়েস্ট পাঠানো হয়েছে ✓");
    setShowDataRequestModal(false);
    setDataRequestMsg("");
    setDataRequestLoading(false);
    loadMyRequests();
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("inventory").select("id, product_name, unit_price");
      if (data) setProducts(data as InventoryItem[]);
    })();
    // Load product names from app_settings and merge with inventory
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "product_names").maybeSingle();
      if (data?.value && Array.isArray(data.value)) {
        const settingsProducts = (data.value as string[]).map((name, i) => ({
          id: `setting-${i}`,
          product_name: name,
          unit_price: 0,
        }));
        setProducts(prev => {
          const existingNames = new Set(prev.map(p => p.product_name));
          const newOnes = settingsProducts.filter(p => !existingNames.has(p.product_name));
          return [...prev, ...newOnes];
        });
      }
    })();
    // Load gift names and card names from app_settings
    (async () => {
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["gift_names", "card_names"]);
      (data || []).forEach(row => {
        if (row.key === "gift_names" && Array.isArray(row.value)) setGiftNames(row.value as string[]);
        if (row.key === "card_names" && Array.isArray(row.value)) setCardNames(row.value as string[]);
      });
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

  const bronzeLeads = useMemo(() => leads.filter(l => l.agent_type === "bronze" || !l.agent_type), [leads]);
  const silverLeads = useMemo(() => leads.filter(l => l.agent_type === "silver"), [leads]);

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
    // Use includes/endsWith to match modal triggers regardless of prefix
    const normalizedStatus = newStatus.toLowerCase().replace(/\s+/g, "_");

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

    // Use the value directly as status (it comes from dynamic config)
    const updatePayload: Record<string, unknown> = {
      status: newStatus, called_time: calledTime, special_note: note, called_date: new Date().toISOString(),
    };
    // Check if this status routes to another panel — if so, clear assignment
    const selectedOpt = availableStatuses.find(s => s.value === newStatus);
    if (selectedOpt?.next_panel && selectedOpt.next_panel !== "employee") {
      updatePayload.assigned_to = null;
    }
    if (REQUEUE_STATUS_VALUES.includes(normalizedStatus)) {
      const cnt = (lead.requeue_count || 0) + 1;
      updatePayload.requeue_count = cnt;
      updatePayload.requeue_at = addMinutes(new Date(), REQUEUE_MINUTES).toISOString();
      if (cnt >= DELETE_SHEET_THRESHOLD) updatePayload.status = "tl_delete_sheet";
    }
    await supabase.from("leads").update(updatePayload).eq("id", lead.id);
    toast.success("Lead আপডেট হয়েছে");
    loadLeads();
  };

  const handleOrderConfirm = async () => {
    if (!currentOrderLead || !user || !orderProduct) { toast.error("Product নির্বাচন করুন"); return; }
    if (!orderPrice || orderPrice <= 0) { toast.error("মূল্য দিন"); return; }
    const { error } = await supabase.from("orders").insert({
      customer_name: currentOrderLead.name, phone: currentOrderLead.phone, address: orderAddress,
      product: orderProduct, quantity: orderQty, price: orderPrice, agent_id: user.id,
      tl_id: currentOrderLead.tl_id, lead_id: currentOrderLead.id, status: "pending_tl",
      district: orderDistrict || null, thana: orderThana || null, gift_name: orderGiftName || null,
      advance_payment: orderAdvancePayment || 0, payment_method: orderPaymentMethod || null,
      card_name: orderCardName || null, order_media: orderMedia || null,
      upsell: orderUpsell || null, success_ratio: orderSuccessRatio || null,
    } as any);
    if (error) { toast.error("অর্ডার তৈরিতে সমস্যা"); console.error(error); return; }
    // Use the actual selected status value from dynamic config
    const selectedStatus = leadStatuses[currentOrderLead.id] || "order_confirm";
    await supabase.from("leads").update({ status: selectedStatus, assigned_to: null, called_date: new Date().toISOString() }).eq("id", currentOrderLead.id);
    setShowOrderModal(false);
    toast.success("অর্ডার নিশ্চিত হয়েছে ✓");
    loadLeads();
  };

  const handlePreOrderSubmit = async () => {
    if (!currentPreOrderLead || !user || !preOrderDate) { toast.error("তারিখ নির্বাচন করুন"); return; }
    await supabase.from("pre_orders").insert({
      lead_id: currentPreOrderLead.id, agent_id: user.id, tl_id: currentPreOrderLead.tl_id,
      scheduled_date: format(preOrderDate, "yyyy-MM-dd"), note: preOrderNote || null,
    });
    const selectedStatus = leadStatuses[currentPreOrderLead.id] || "pre_order";
    await supabase.from("leads").update({ status: selectedStatus, called_date: new Date().toISOString() }).eq("id", currentPreOrderLead.id);
    setShowPreOrderModal(false);
    toast.success("Pre-order তৈরি হয়েছে ✓");
    loadLeads();
  };

  const handlePreOrderConfirmSubmit = async () => {
    if (!currentPreOrderConfirmLead || !user) return;
    if (!pocProduct) { toast.error("Product নির্বাচন করুন"); return; }
    if (!pocDeliveryDate) { toast.error("Delivery Date নির্বাচন করুন"); return; }
    // Create order from pre-order confirm
    const { error } = await supabase.from("orders").insert({
      customer_name: currentPreOrderConfirmLead.name, phone: currentPreOrderConfirmLead.phone,
      address: [pocDistrict, pocThana, pocAddress].filter(Boolean).join(", ") || currentPreOrderConfirmLead.address,
      product: pocProduct, quantity: 1, price: products.find(p => p.product_name === pocProduct)?.unit_price || 0,
      agent_id: user.id, tl_id: currentPreOrderConfirmLead.tl_id, lead_id: currentPreOrderConfirmLead.id,
      status: "pending_tl", district: pocDistrict || null, thana: pocThana || null,
    } as any);
    if (error) { toast.error("অর্ডার তৈরিতে সমস্যা"); console.error(error); return; }
    const selectedStatus = leadStatuses[currentPreOrderConfirmLead.id] || "pre_order_confirm";
    await supabase.from("leads").update({ status: selectedStatus, assigned_to: null, called_date: new Date().toISOString() }).eq("id", currentPreOrderConfirmLead.id);
    setShowPreOrderConfirmModal(false);
    toast.success("Pre-Order Confirm হয়েছে ✓");
    loadLeads();
  };

  // Extract dynamic raw-data column keys from special_note JSON across all leads
  const rawDataKeys = useMemo(() => {
    const keySet = new Set<string>();
    leads.forEach(lead => {
      if (!lead.special_note) return;
      try {
        const parsed = JSON.parse(lead.special_note);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.keys(parsed).forEach(k => keySet.add(k));
        }
      } catch { /* not JSON */ }
    });
    return Array.from(keySet);
  }, [leads]);

  const parseSpecialNote = (note: string | null): Record<string, string> => {
    if (!note) return {};
    try {
      const parsed = JSON.parse(note);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const result: Record<string, string> = {};
        Object.entries(parsed).forEach(([k, v]) => { result[k] = v != null ? String(v) : ""; });
        return result;
      }
    } catch { /* not JSON */ }
    return {};
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  if (!checkedIn) {
    return (
      <div className="space-y-6">
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-orange-400" />
            <h2 className="font-heading text-lg mb-2">প্রথমে Check In করুন</h2>
            <p className="text-sm text-muted-foreground">লিড দেখতে হলে আগে ড্যাশবোর্ড থেকে Check In করতে হবে</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/employee/dashboard"}>
              ড্যাশবোর্ডে যান
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderLeadTable = (leadList: LeadRow[]) => {
    // Fixed columns: #, name, phone, address
    // Then raw data keys from special_note
    // Then HR dynamic columns (dropdowns + notes) + call count
    const dropdownCols = dynamicColumns.filter(c => c.type === "dropdown");
    const noteCols = dynamicColumns.filter(c => c.type === "note");
    const totalCols = 4 + rawDataKeys.length + dropdownCols.length + noteCols.length;

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-2 px-2 text-left">#</th>
              <th className="py-2 px-2 text-left">কাস্টমার</th>
              <th className="py-2 px-2 text-left">ফোন</th>
              <th className="py-2 px-2 text-left">ঠিকানা</th>
              {rawDataKeys.map(key => (
                <th key={key} className="py-2 px-2 text-left whitespace-nowrap">{key}</th>
              ))}
              {dropdownCols.map(col => (
                <th key={col.id} className="py-2 px-2 text-left whitespace-nowrap">{col.name_bn || col.name}</th>
              ))}
              {noteCols.map(col => (
                <th key={col.id} className="py-2 px-2 text-left whitespace-nowrap">{col.name_bn || col.name}</th>
              ))}
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
                  <td className="py-2 px-2 whitespace-nowrap">{lead.phone || "—"}</td>
                  <td className="py-2 px-2 max-w-[150px] truncate">{lead.address || "—"}</td>
                  {rawDataKeys.map(key => (
                    <td key={key} className="py-2 px-2 max-w-[150px] truncate">{rawData[key] || "—"}</td>
                  ))}
                  {dropdownCols.map(col => (
                    <td key={col.id} className="py-2 px-2 min-w-[180px]">
                      {isRequeued ? (
                        <Badge variant="outline" className="text-orange-400 border-orange-400/50">⏳ {requeueRemaining} মিনিটে</Badge>
                      ) : (
                        <Select value={leadStatuses[lead.id] || ""} onValueChange={v => {
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
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={col.name_bn || "স্ট্যাটাস"} /></SelectTrigger>
                          <SelectContent>
                            {col.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label_bn || o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                  ))}
                  {/* Fallback: if no dynamic dropdown columns, show fallback statuses */}
                  {dropdownCols.length === 0 && (
                    <td className="py-2 px-2 min-w-[180px]">
                      {isRequeued ? (
                        <Badge variant="outline" className="text-orange-400 border-orange-400/50">⏳ {requeueRemaining} মিনিটে</Badge>
                      ) : (
                        <Select value={leadStatuses[lead.id] || ""} onValueChange={v => {
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
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="স্ট্যাটাস" /></SelectTrigger>
                          <SelectContent>
                            {availableStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label_bn || s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                  )}
                  {noteCols.map(col => (
                    <td key={col.id} className="py-2 px-2 min-w-[120px]">
                      <Input
                        className="h-8 text-xs"
                        placeholder={col.name_bn || col.name}
                        value={leadNotes[`${lead.id}_${col.id}`] || ""}
                        onChange={e => setLeadNotes(p => ({ ...p, [`${lead.id}_${col.id}`]: e.target.value }))}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
            {leadList.length === 0 && (
              <tr><td colSpan={totalCols} className="py-8 text-center text-muted-foreground">কোনো লিড নেই — টিম লিডার অ্যাসাইন করলে এখানে দেখাবে</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Target className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> লিড শীট
        </h1>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>সেলস রেশিও: <strong className="text-foreground">{salesRatio}%</strong></span>
          <span>রিসিভ রেশিও: <strong className="text-foreground">{receiveRatio}%</strong></span>
          <span>অর্ডার: <strong className="text-foreground">{metrics.orders}</strong></span>
        </div>
      </div>

      {/* Data Request Button */}
      {leads.length === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-6 text-center">
            <Database className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground mb-3">আপনার কোনো লিড নেই। TL-কে ডাটা রিকোয়েস্ট পাঠান।</p>
            <Button onClick={() => setShowDataRequestModal(true)} className="gap-2">
              <Send className="h-4 w-4" /> ডাটা রিকোয়েস্ট পাঠান
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent requests */}
      {pendingRequests.length > 0 && (
        <div className="flex gap-2 flex-wrap text-xs">
          {pendingRequests.filter(r => r.status === 'pending').length > 0 && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/50">
              ⏳ {pendingRequests.filter(r => r.status === 'pending').length}টি রিকোয়েস্ট পেন্ডিং
            </Badge>
          )}
          {pendingRequests.filter(r => r.status === 'fulfilled').length > 0 && (
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/50">
              ✓ {pendingRequests.filter(r => r.status === 'fulfilled').length}টি পূরণ হয়েছে
            </Badge>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Tabs defaultValue="bronze" className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <TabsList>
              <TabsTrigger value="bronze">ব্রোঞ্জ লিড ({bronzeLeads.length})</TabsTrigger>
              <TabsTrigger value="silver">সিল্ভার লিড ({silverLeads.length})</TabsTrigger>
            </TabsList>
            {leads.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowDataRequestModal(true)} className="gap-1.5 text-xs">
                <Send className="h-3.5 w-3.5" /> ডাটা চাই
              </Button>
            )}
          </div>
          <TabsContent value="bronze">
            <Card><CardContent className="p-0 sm:p-2">{renderLeadTable(bronzeLeads)}</CardContent></Card>
          </TabsContent>
          <TabsContent value="silver">
            <Card><CardContent className="p-0 sm:p-2">{renderLeadTable(silverLeads)}</CardContent></Card>
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
          <DialogHeader><DialogTitle>Order Confirmation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Name & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={currentOrderLead?.name || ""} readOnly className="mt-1 bg-muted" /></div>
              <div><Label>Phone *</Label><Input value={currentOrderLead?.phone || ""} readOnly className="mt-1 bg-muted" /></div>
            </div>

            {/* District & Thana */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>District</Label>
                <Select value={orderDistrict} onValueChange={v => { setOrderDistrict(v); setOrderThana(""); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="জেলা নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-2">
                      <Input placeholder="খুঁজুন..." value={districtSearch} onChange={e => setDistrictSearch(e.target.value)} className="h-8 text-xs" />
                    </div>
                    {BD_DISTRICTS
                      .filter(d => !districtSearch || d.name.toLowerCase().includes(districtSearch.toLowerCase()) || d.name_bn.includes(districtSearch))
                      .map(d => <SelectItem key={d.name} value={d.name}>{d.name_bn} ({d.name})</SelectItem>)}
                  </SelectContent>
                </Select>
                {locationAutoDetected && orderDistrict && <p className="text-xs text-emerald-500 mt-0.5">✓ অটো-ডিটেক্ট হয়েছে</p>}
                {!orderDistrict && currentOrderLead?.address && <p className="text-xs text-amber-500 mt-0.5">⚠ ম্যানুয়ালি খুঁজে নিন</p>}
              </div>
              <div>
                <Label>Thana</Label>
                <Select value={orderThana} onValueChange={setOrderThana} disabled={!orderDistrict}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="থানা নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-2">
                      <Input placeholder="খুঁজুন..." value={thanaSearch} onChange={e => setThanaSearch(e.target.value)} className="h-8 text-xs" />
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
              <Label>Location</Label>
              <Input value={orderAddress} onChange={e => setOrderAddress(e.target.value)} className="mt-1" placeholder="সম্পূর্ণ ঠিকানা" />
            </div>

            {/* Product & Gift */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Product Name *</Label>
                <Select value={orderProduct} onValueChange={v => { setOrderProduct(v); const p = products.find(pr => pr.product_name === v); if (p) setOrderPrice(p.unit_price || 0); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="প্রোডাক্ট নির্বাচন" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.product_name}>{p.product_name} (৳{p.unit_price})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gift Name</Label>
                <Select value={orderGiftName} onValueChange={setOrderGiftName}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="গিফট নির্বাচন" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">কোনো গিফট নেই</SelectItem>
                    {giftNames.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amount & Advance */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount *</Label><Input type="number" value={orderPrice} onChange={e => setOrderPrice(Number(e.target.value))} className="mt-1" placeholder="৳" /></div>
              <div><Label>Advance Payment</Label><Input type="number" value={orderAdvancePayment} onChange={e => setOrderAdvancePayment(Number(e.target.value))} className="mt-1" placeholder="৳" /></div>
            </div>

            {/* Payment Method & Card */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment Method</Label>
                <Select value={orderPaymentMethod} onValueChange={setOrderPaymentMethod}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cod">Cash on Delivery</SelectItem>
                    <SelectItem value="bkash">বিকাশ</SelectItem>
                    <SelectItem value="nagad">নগদ</SelectItem>
                    <SelectItem value="rocket">রকেট</SelectItem>
                    <SelectItem value="bank">ব্যাংক ট্রান্সফার</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Card Name</Label>
                <Select value={orderCardName} onValueChange={setOrderCardName}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select card" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Card</SelectItem>
                    {cardNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quantity & Order Media */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity</Label><Input type="number" min={1} value={orderQty} onChange={e => setOrderQty(Number(e.target.value))} className="mt-1" /></div>
              <div>
                <Label>Order Media</Label>
                <Select value={orderMedia} onValueChange={setOrderMedia}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select media" /></SelectTrigger>
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
                <Label>Upsell</Label>
                <Select value={orderUpsell} onValueChange={setOrderUpsell}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select upsell" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="01_to_02">০১ থেকে ০২</SelectItem>
                    <SelectItem value="02_to_03">০২ থেকে ০৩</SelectItem>
                    <SelectItem value="03_to_04">০৩ থেকে ০৪</SelectItem>
                    <SelectItem value="04_to_05">০৪ থেকে ০৫</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Success Ratio (1-100) *</Label>
                <Input type="number" min={1} max={100} value={orderSuccessRatio} onChange={e => setOrderSuccessRatio(e.target.value ? Number(e.target.value) : "")} className="mt-1" placeholder="1-100" />
              </div>
            </div>

            {/* Note */}
            <div><Label>নোট</Label><Textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderModal(false)}>বাতিল</Button>
            <Button onClick={handleOrderConfirm} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">নিশ্চিত করুন</Button>
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
          <DialogHeader><DialogTitle>প্রি-অর্ডার</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>কাস্টমার</Label><Input value={currentPreOrderLead?.name || ""} readOnly className="mt-1 bg-muted" /></div>
            <div><Label>ফোন</Label><Input value={currentPreOrderLead?.phone || ""} readOnly className="mt-1 bg-muted" /></div>
            <div>
              <Label>ডেলিভারি তারিখ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left", !preOrderDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {preOrderDate ? format(preOrderDate, "PPP") : "তারিখ নির্বাচন"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={preOrderDate} onSelect={setPreOrderDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>নোট</Label><Textarea value={preOrderNote} onChange={e => setPreOrderNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handlePreOrderSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">সাবমিট</Button>
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
          <DialogHeader><DialogTitle>Pre-Order Confirm</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={currentPreOrderConfirmLead?.name || ""} readOnly className="mt-1 bg-muted" /></div>
              <div><Label>Phone *</Label><Input value={currentPreOrderConfirmLead?.phone || ""} readOnly className="mt-1 bg-muted" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>District</Label>
                <Select value={pocDistrict} onValueChange={v => { setPocDistrict(v); setPocThana(""); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="জেলা নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    {BD_DISTRICTS.map(d => <SelectItem key={d.name} value={d.name}>{d.name_bn} ({d.name})</SelectItem>)}
                  </SelectContent>
                </Select>
                {!pocDistrict && currentPreOrderConfirmLead?.address && <p className="text-xs text-amber-500 mt-0.5">⚠ ম্যানুয়ালি খুঁজে নিন</p>}
              </div>
              <div>
                <Label>Thana</Label>
                <Select value={pocThana} onValueChange={setPocThana} disabled={!pocDistrict}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="থানা নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    {(BD_DISTRICTS.find(d => d.name === pocDistrict)?.thanas || []).map(t => <SelectItem key={t.name} value={t.name}>{t.name_bn} ({t.name})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input value={pocAddress} onChange={e => setPocAddress(e.target.value)} className="mt-1" placeholder="সম্পূর্ণ ঠিকানা" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Product *</Label>
                <Select value={pocProduct} onValueChange={setPocProduct}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.product_name}>{p.product_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preferred Delivery Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left", !pocDeliveryDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pocDeliveryDate ? format(pocDeliveryDate, "PPP") : "তারিখ নির্বাচন"}
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
            <Button variant="outline" onClick={() => setShowPreOrderConfirmModal(false)}>Cancel</Button>
            <Button onClick={handlePreOrderConfirmSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">Save Pre-Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Request Modal */}
      <Dialog open={showDataRequestModal} onOpenChange={setShowDataRequestModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ডাটা রিকোয়েস্ট</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">আপনার TL-কে নতুন ডাটা পাঠানোর জন্য রিকোয়েস্ট পাঠান।</p>
            <div>
              <Label>মেসেজ (ঐচ্ছিক)</Label>
              <Textarea value={dataRequestMsg} onChange={e => setDataRequestMsg(e.target.value)} className="mt-1" rows={3} placeholder="কি ধরনের ডাটা দরকার..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleDataRequest} disabled={dataRequestLoading} className="gap-2">
              <Send className="h-4 w-4" /> {dataRequestLoading ? "পাঠানো হচ্ছে..." : "রিকোয়েস্ট পাঠান"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
