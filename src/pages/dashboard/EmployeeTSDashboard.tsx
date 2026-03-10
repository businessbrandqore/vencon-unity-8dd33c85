import { useState, useEffect, useCallback, useMemo } from "react";
import SalaryCard from "@/components/SalaryCard";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, differenceInMinutes, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, Clock, AlertTriangle, LogOut } from "lucide-react";

/* ───── types ───── */
interface UserProfile {
  id: string;
  shift_start: string | null;
  shift_end: string | null;
  basic_salary: number | null;
  role: string;
}

interface AttendanceRow {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  mood_in: string | null;
  mood_out: string | null;
  mood_note: string | null;
  desk_condition: string | null;
  phone_minutes_remaining: number | null;
  deduction_amount: number | null;
  is_late: boolean | null;
  is_early_out: boolean | null;
}

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

/* ───── constants ───── */
const MOODS = [
  { value: "happy", emoji: "😊", labelKey: "mood_happy" },
  { value: "sad", emoji: "😢", labelKey: "mood_sad" },
  { value: "excited", emoji: "🎉", labelKey: "mood_excited" },
  { value: "tired", emoji: "😴", labelKey: "mood_tired" },
  { value: "neutral", emoji: "😐", labelKey: "mood_neutral" },
  { value: "angry", emoji: "😠", labelKey: "mood_angry" },
];

const LEAD_STATUSES = [
  "Order Confirm",
  "Pre Order",
  "Phone Off",
  "Positive",
  "Customer Reschedule",
  "Do Not Pick",
  "No Response",
  "Busy Now",
  "Number Busy",
  "Negative",
  "Not Interested",
  "Cancelled",
  "Wrong Number",
  "Duplicate",
  "Already Ordered",
];

const REQUEUE_STATUSES = [
  "Phone Off",
  "Positive",
  "Customer Reschedule",
  "Do Not Pick",
  "No Response",
  "Busy Now",
  "Number Busy",
];

const REQUEUE_MINUTES = 40;
const DELETE_SHEET_THRESHOLD = 5;
const LATE_DEDUCTION = 33;

const todayStr = () => new Date().toISOString().slice(0, 10);

/* ═══════════════════════════════════════════ */
export default function EmployeeTSDashboard() {
  const { user } = useAuth();
  const { t, n, lang, statusName } = useLanguage();

  /* user profile with shift info */
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isWithinShift, setIsWithinShift] = useState<boolean | null>(null);

  /* attendance */
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  /* flow state */
  const [deskReportDone, setDeskReportDone] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);

  /* modals */
  const [showDeskModal, setShowDeskModal] = useState(false);
  const [showMoodInModal, setShowMoodInModal] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPreOrderModal, setShowPreOrderModal] = useState(false);

  /* desk report */
  const [deskCondition, setDeskCondition] = useState("");
  const [phoneMins, setPhoneMins] = useState<number>(0);

  /* mood */
  const [selectedMood, setSelectedMood] = useState("");
  const [moodNote, setMoodNote] = useState("");
  const [clockOutMood, setClockOutMood] = useState("");
  const [clockOutNote, setClockOutNote] = useState("");

  /* leads */
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<Record<string, string>>({});
  const [leadCalledTimes, setLeadCalledTimes] = useState<Record<string, number>>({});
  const [leadNotes, setLeadNotes] = useState<Record<string, string>>({});
  const [currentOrderLead, setCurrentOrderLead] = useState<LeadRow | null>(null);
  const [currentPreOrderLead, setCurrentPreOrderLead] = useState<LeadRow | null>(null);

  /* inventory */
  const [products, setProducts] = useState<InventoryItem[]>([]);

  /* order form */
  const [orderAddress, setOrderAddress] = useState("");
  const [orderProduct, setOrderProduct] = useState("");
  const [orderQty, setOrderQty] = useState(1);
  const [orderPrice, setOrderPrice] = useState<number>(0);
  const [orderNote, setOrderNote] = useState("");

  /* pre-order form */
  const [preOrderDate, setPreOrderDate] = useState<Date>();
  const [preOrderNote, setPreOrderNote] = useState("");

  /* metrics */
  const [metrics, setMetrics] = useState({ orders: 0, delivered: 0, cancelled: 0, returned: 0 });
  const [monthDeductions, setMonthDeductions] = useState(0);

  /* requeue countdown tick */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  /* ───── load profile ───── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("id, shift_start, shift_end, basic_salary, role")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data as UserProfile);
    })();
  }, [user]);

  /* ───── check shift ───── */
  useEffect(() => {
    if (!profile) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
    if (profile.shift_start && profile.shift_end) {
      setIsWithinShift(hhmm >= profile.shift_start && hhmm <= profile.shift_end);
    } else {
      setIsWithinShift(true); // no shift configured → allow
    }
  }, [profile]);

  /* ───── load today attendance ───── */
  const loadAttendance = useCallback(async () => {
    if (!user) return;
    setAttendanceLoading(true);
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", todayStr())
      .maybeSingle();
    if (data) {
      const row = data as AttendanceRow;
      setTodayAttendance(row);
      setDeskReportDone(!!(row.desk_condition));
      setClockedIn(!!row.clock_in);
    } else {
      setTodayAttendance(null);
      setDeskReportDone(false);
      setClockedIn(false);
    }
    setAttendanceLoading(false);
  }, [user]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  /* ───── load leads ───── */
  const loadLeads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("assigned_to", user.id)
      .not("status", "in", '("order_confirm","negative","not_interested","cancelled","wrong_number","duplicate","already_ordered")');
    if (data) setLeads(data as LeadRow[]);
  }, [user]);

  useEffect(() => { if (clockedIn) loadLeads(); }, [clockedIn, loadLeads]);

  /* ───── load products ───── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("inventory").select("id, product_name, unit_price");
      if (data) setProducts(data as InventoryItem[]);
    })();
  }, []);

  /* ───── load metrics ───── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { data: ordersData } = await supabase
        .from("orders")
        .select("status, delivery_status")
        .eq("agent_id", user.id)
        .gte("created_at", monthStart.toISOString());

      if (ordersData) {
        setMetrics({
          orders: ordersData.length,
          delivered: ordersData.filter((o) => o.delivery_status === "delivered").length,
          cancelled: ordersData.filter((o) => o.status === "cancelled").length,
          returned: ordersData.filter((o) => o.delivery_status === "returned").length,
        });
      }

      const { data: attData } = await supabase
        .from("attendance")
        .select("deduction_amount")
        .eq("user_id", user.id)
        .gte("date", monthStart.toISOString().slice(0, 10));

      if (attData) {
        setMonthDeductions(attData.reduce((s, a) => s + (Number(a.deduction_amount) || 0), 0));
      }
    })();
  }, [user, tick]);

  /* ───── computed ───── */
  const salesRatio = metrics.orders > 0 ? ((metrics.orders / Math.max(leads.length + metrics.orders, 1)) * 100).toFixed(1) : "0";
  const receiveRatio = metrics.orders > 0 ? ((metrics.delivered / metrics.orders) * 100).toFixed(1) : "0";
  const cancelRatio = metrics.orders > 0 ? ((metrics.cancelled / metrics.orders) * 100).toFixed(1) : "0";
  const returnRatio = metrics.orders > 0 ? ((metrics.returned / metrics.orders) * 100).toFixed(1) : "0";
  const basicSalary = profile?.basic_salary || 0;
  const netSalary = basicSalary - monthDeductions;

  const bronzeLeads = useMemo(() => leads.filter((l) => l.agent_type === "bronze" || !l.agent_type), [leads]);
  const silverLeads = useMemo(() => leads.filter((l) => l.agent_type === "silver"), [leads]);

  /* ───── handlers ───── */

  const handleDeskReportSubmit = async () => {
    if (!user || !deskCondition) { toast.error("ডেস্কের অবস্থা নির্বাচন করুন"); return; }
    // upsert attendance row for today
    if (todayAttendance) {
      await supabase.from("attendance").update({
        desk_condition: deskCondition,
        phone_minutes_remaining: phoneMins,
      }).eq("id", todayAttendance.id);
    } else {
      await supabase.from("attendance").insert({
        user_id: user.id,
        date: todayStr(),
        desk_condition: deskCondition,
        phone_minutes_remaining: phoneMins,
      });
    }
    setShowDeskModal(false);
    setDeskReportDone(true);
    await loadAttendance();
    toast.success("ডেস্ক রিপোর্ট সংরক্ষণ করা হয়েছে");
  };

  const handleClockIn = async () => {
    if (!user || !selectedMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date().toISOString();
    let isLate = false;
    if (profile?.shift_start) {
      const shiftParts = profile.shift_start.split(":");
      const shiftDate = new Date();
      shiftDate.setHours(parseInt(shiftParts[0]), parseInt(shiftParts[1]), 0, 0);
      if (new Date() > shiftDate) isLate = true;
    }
    if (todayAttendance) {
      await supabase.from("attendance").update({
        clock_in: now,
        mood_in: selectedMood,
        mood_note: moodNote || null,
        is_late: isLate,
        deduction_amount: isLate ? LATE_DEDUCTION : 0,
      }).eq("id", todayAttendance.id);
    } else {
      await supabase.from("attendance").insert({
        user_id: user.id,
        date: todayStr(),
        clock_in: now,
        mood_in: selectedMood,
        mood_note: moodNote || null,
        is_late: isLate,
        deduction_amount: isLate ? LATE_DEDUCTION : 0,
      });
    }
    setShowMoodInModal(false);
    setClockedIn(true);
    await loadAttendance();
    toast.success(isLate ? "Clock In হয়েছে (Late entry — ৳33 কর্তন)" : "Clock In সফল ✓");
  };

  const handleClockOut = async () => {
    if (!user || !clockOutMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date();
    let earlyOut = false;
    let extraDeduction = 0;
    if (profile?.shift_end) {
      const shiftParts = profile.shift_end.split(":");
      const shiftEnd = new Date();
      shiftEnd.setHours(parseInt(shiftParts[0]), parseInt(shiftParts[1]), 0, 0);
      if (now < shiftEnd) { earlyOut = true; extraDeduction = LATE_DEDUCTION; }
    }
    if (todayAttendance) {
      await supabase.from("attendance").update({
        clock_out: now.toISOString(),
        mood_out: clockOutMood,
        is_early_out: earlyOut,
        deduction_amount: (Number(todayAttendance.deduction_amount) || 0) + extraDeduction,
      }).eq("id", todayAttendance.id);
    }
    setShowClockOutModal(false);
    await loadAttendance();
    toast.success(earlyOut ? "Clock Out হয়েছে (Early out — ৳33 কর্তন)" : "Clock Out সফল ✓");
  };

  const handleLeadSave = async (lead: LeadRow) => {
    const newStatus = leadStatuses[lead.id];
    if (!newStatus || !user) return;

    const calledTime = leadCalledTimes[lead.id] || lead.called_time || 1;
    const note = leadNotes[lead.id] ?? lead.special_note;

    if (newStatus === "Order Confirm") {
      setCurrentOrderLead(lead);
      setOrderAddress(lead.address || "");
      setOrderProduct("");
      setOrderQty(1);
      setOrderPrice(0);
      setOrderNote("");
      setShowOrderModal(true);
      return;
    }

    if (newStatus === "Pre Order") {
      setCurrentPreOrderLead(lead);
      setPreOrderDate(undefined);
      setPreOrderNote("");
      setShowPreOrderModal(true);
      return;
    }

    // Update lead
    const updatePayload: Record<string, unknown> = {
      status: newStatus.toLowerCase().replace(/\s+/g, "_"),
      called_time: calledTime,
      special_note: note,
      called_date: new Date().toISOString(),
    };

    if (REQUEUE_STATUSES.includes(newStatus)) {
      const newRequeueCount = (lead.requeue_count || 0) + 1;
      updatePayload.requeue_count = newRequeueCount;
      updatePayload.requeue_at = addMinutes(new Date(), REQUEUE_MINUTES).toISOString();
      if (newRequeueCount >= DELETE_SHEET_THRESHOLD) {
        updatePayload.status = "tl_delete_sheet";
      }
    }

    await supabase.from("leads").update(updatePayload).eq("id", lead.id);
    toast.success("Lead আপডেট হয়েছে");
    loadLeads();
  };

  const handleOrderConfirm = async () => {
    if (!currentOrderLead || !user || !orderProduct) { toast.error("Product নির্বাচন করুন"); return; }
    // Insert order
    const { error } = await supabase.from("orders").insert({
      customer_name: currentOrderLead.name,
      phone: currentOrderLead.phone,
      address: orderAddress,
      product: orderProduct,
      quantity: orderQty,
      price: orderPrice,
      agent_id: user.id,
      tl_id: currentOrderLead.tl_id,
      lead_id: currentOrderLead.id,
      status: "pending_cso",
    });
    if (error) { toast.error("অর্ডার তৈরিতে সমস্যা"); return; }

    // Update lead
    await supabase.from("leads").update({
      status: "order_confirm",
      called_date: new Date().toISOString(),
    }).eq("id", currentOrderLead.id);

    setShowOrderModal(false);
    toast.success("অর্ডার নিশ্চিত হয়েছে ✓");
    loadLeads();
  };

  const handlePreOrderSubmit = async () => {
    if (!currentPreOrderLead || !user || !preOrderDate) { toast.error("তারিখ নির্বাচন করুন"); return; }
    await supabase.from("pre_orders").insert({
      lead_id: currentPreOrderLead.id,
      agent_id: user.id,
      tl_id: currentPreOrderLead.tl_id,
      scheduled_date: format(preOrderDate, "yyyy-MM-dd"),
      note: preOrderNote || null,
    });
    await supabase.from("leads").update({
      status: "pre_order",
      called_date: new Date().toISOString(),
    }).eq("id", currentPreOrderLead.id);

    setShowPreOrderModal(false);
    toast.success("Pre-order তৈরি হয়েছে ✓");
    loadLeads();
  };

  /* ───── requeue helper ───── */
  const getRequeueRemaining = (lead: LeadRow) => {
    if (!lead.requeue_at) return null;
    const remaining = differenceInMinutes(new Date(lead.requeue_at), new Date());
    return remaining > 0 ? remaining : null;
  };

  /* ───── loading ───── */
  if (!profile || isWithinShift === null || attendanceLoading) {
    return <div className="p-6 text-muted-foreground">{t("loading")}</div>;
  }

  /* ───── OUTSIDE SHIFT ───── */
  if (!isWithinShift) {
    return (
      <div className="space-y-6">
        <Card className="border-[hsl(var(--panel-employee))]">
          <CardContent className="py-8 text-center">
            <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="font-heading text-xl mb-2">{t("outside_shift")}</h2>
            <p className="text-muted-foreground">{t("personal_info_only")}</p>
          </CardContent>
        </Card>
        <SalaryCard />
      </div>
    );
  }

  /* ───── DESK REPORT BANNER ───── */
  if (!deskReportDone) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowDeskModal(true)}
          className="w-full rounded-md border border-orange-500/50 bg-orange-500/10 p-6 text-center hover:bg-orange-500/20 transition-colors"
        >
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-orange-400" />
           <p className="font-heading text-lg text-orange-300">{t("desk_report_pending")}</p>
           <p className="text-sm text-muted-foreground mt-1">{t("click_to_report")}</p>
        </button>

        {/* Desk Report Modal */}
        <Dialog open={showDeskModal} onOpenChange={setShowDeskModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("desk_report")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("desk_condition")}</Label>
                <RadioGroup value={deskCondition} onValueChange={setDeskCondition} className="mt-2 space-y-2">
                  <div className="flex items-center gap-2"><RadioGroupItem value="good" id="good" /><Label htmlFor="good">{t("desk_good")}</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="acceptable" id="acceptable" /><Label htmlFor="acceptable">{t("desk_acceptable")}</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="needs_repair" id="needs_repair" /><Label htmlFor="needs_repair">{t("desk_needs_repair")}</Label></div>
                </RadioGroup>
              </div>
              <div>
                <Label>{t("phone_minutes")}</Label>
                <Input type="number" min={0} value={phoneMins} onChange={(e) => setPhoneMins(Number(e.target.value))} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleDeskReportSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)]">{t("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ───── MOOD CHECK-IN ───── */
  if (!clockedIn) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="font-heading">{t("mood_select")}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setSelectedMood(m.value)}
                  className={cn(
                    "flex flex-col items-center rounded-md border p-4 transition-all hover:border-[hsl(var(--panel-employee))]",
                    selectedMood === m.value
                      ? "border-[hsl(var(--panel-employee))] bg-[hsl(var(--panel-employee)/0.15)]"
                      : "border-border"
                  )}
                >
                  <span className="text-3xl mb-1">{m.emoji}</span>
                  <span className="text-xs text-muted-foreground">{t(m.labelKey)}</span>
                </button>
              ))}
            </div>
            <div>
              <Label>{t("mood_write")}</Label>
              <Textarea value={moodNote} onChange={(e) => setMoodNote(e.target.value)} className="mt-1" rows={2} />
            </div>
            <Button
              onClick={handleClockIn}
              disabled={!selectedMood}
              className="w-full bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white"
            >
              {t("clock_in")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ═══════════════════════════════════════════ */
  /* ───── MAIN LEAD SHEET ───── */
  /* ═══════════════════════════════════════════ */

  const renderLeadTable = (leadList: LeadRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2 px-2 text-left">#</th>
            <th className="py-2 px-2 text-left">Customer</th>
            <th className="py-2 px-2 text-left">Phone</th>
            <th className="py-2 px-2 text-left">City</th>
            <th className="py-2 px-2 text-left">Status</th>
            <th className="py-2 px-2 text-left">Called</th>
            <th className="py-2 px-2 text-left">Note</th>
            <th className="py-2 px-2"></th>
          </tr>
        </thead>
        <tbody>
          {leadList.map((lead, idx) => {
            const requeueRemaining = getRequeueRemaining(lead);
            const isRequeued = requeueRemaining !== null && requeueRemaining > 0;
            return (
              <tr key={lead.id} className={cn("border-b border-border", isRequeued && "opacity-50 pointer-events-none bg-muted/30")}>
                <td className="py-2 px-2">{idx + 1}</td>
                <td className="py-2 px-2">{lead.name || "—"}</td>
                <td className="py-2 px-2">{lead.phone || "—"}</td>
                <td className="py-2 px-2">{lead.address || "—"}</td>
                <td className="py-2 px-2 min-w-[180px]">
                  {isRequeued ? (
                    <Badge variant="outline" className="text-orange-400 border-orange-400/50">আসছে: {requeueRemaining} মিনিটে</Badge>
                  ) : (
                    <Select value={leadStatuses[lead.id] || ""} onValueChange={(v) => setLeadStatuses((p) => ({ ...p, [lead.id]: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status নির্বাচন" /></SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="py-2 px-2 min-w-[80px]">
                  <Select value={String(leadCalledTimes[lead.id] || lead.called_time || 1)} onValueChange={(v) => setLeadCalledTimes((p) => ({ ...p, [lead.id]: Number(v) }))}>
                    <SelectTrigger className="h-8 text-xs w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-2 px-2">
                  <Input
                    className="h-8 text-xs"
                    value={leadNotes[lead.id] ?? (lead.special_note || "")}
                    onChange={(e) => setLeadNotes((p) => ({ ...p, [lead.id]: e.target.value }))}
                    placeholder="Note"
                  />
                </td>
                <td className="py-2 px-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLeadSave(lead)}
                    disabled={!leadStatuses[lead.id]}
                    className="h-7 text-xs border-[hsl(var(--panel-employee))] text-[hsl(var(--panel-employee))]"
                  >
                    Save
                  </Button>
                </td>
              </tr>
            );
          })}
          {leadList.length === 0 && (
            <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">কোনো lead নেই</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4 pb-24">
      {/* Clock Out button */}
      <div className="flex justify-between items-center">
        <h1 className="font-heading text-xl">{t("lead_sheet")}</h1>
        <Button
          variant="outline"
          onClick={() => { setClockOutMood(""); setClockOutNote(""); setShowClockOutModal(true); }}
          className="border-destructive text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 mr-2" />{t("clock_out")}
        </Button>
      </div>

      {/* Lead Tabs */}
      <Tabs defaultValue="bronze">
        <TabsList>
          <TabsTrigger value="bronze">{t("bronze_leads")} ({n(bronzeLeads.length)})</TabsTrigger>
          <TabsTrigger value="silver">{t("silver_leads")} ({n(silverLeads.length)})</TabsTrigger>
        </TabsList>
        <TabsContent value="bronze">{renderLeadTable(bronzeLeads)}</TabsContent>
        <TabsContent value="silver">{renderLeadTable(silverLeads)}</TabsContent>
      </Tabs>

      {/* ── Bottom Metrics Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-screen-xl mx-auto text-xs">
          <div className="flex gap-4">
            <span>{t("sales_ratio")}: <strong>{n(Number(salesRatio))}%</strong></span>
            <span>{t("receive_ratio")}: <strong>{n(Number(receiveRatio))}%</strong></span>
            <span>{t("cancel_ratio")}: <strong className="text-destructive">{n(Number(cancelRatio))}%</strong></span>
            <span>{t("return_ratio")}: <strong className="text-orange-400">{n(Number(returnRatio))}%</strong></span>
          </div>
          <div>
            {t("net_salary")}: <strong>৳{n(basicSalary)} - ৳{n(monthDeductions)} = <span className="text-[hsl(var(--panel-employee))]">৳{n(netSalary)}</span></strong>
          </div>
        </div>
      </div>

      {/* ── Order Confirm Modal ── */}
      <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("order_confirm_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("customer_name")}</Label><Input value={currentOrderLead?.name || ""} readOnly className="mt-1 bg-muted" /></div>
            <div><Label>{t("phone")}</Label><Input value={currentOrderLead?.phone || ""} readOnly className="mt-1 bg-muted" /></div>
            <div><Label>{t("address")}</Label><Input value={orderAddress} onChange={(e) => setOrderAddress(e.target.value)} className="mt-1" /></div>
            <div>
              <Label>{t("product")}</Label>
              <Select value={orderProduct} onValueChange={(v) => {
                setOrderProduct(v);
                const p = products.find((pr) => pr.product_name === v);
                if (p) setOrderPrice(p.unit_price || 0);
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("select_product")} /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.product_name}>{p.product_name} (৳{p.unit_price})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("quantity")}</Label><Input type="number" min={1} value={orderQty} onChange={(e) => setOrderQty(Number(e.target.value))} className="mt-1" /></div>
              <div><Label>{t("price")}</Label><Input type="number" value={orderPrice} onChange={(e) => setOrderPrice(Number(e.target.value))} className="mt-1" /></div>
            </div>
            <div><Label>Agent's Note</Label><Textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleOrderConfirm} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">{t("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Pre-Order Modal ── */}
      <Dialog open={showPreOrderModal} onOpenChange={setShowPreOrderModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("pre_order_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Customer</Label><Input value={currentPreOrderLead?.name || ""} readOnly className="mt-1 bg-muted" /></div>
            <div><Label>Phone</Label><Input value={currentPreOrderLead?.phone || ""} readOnly className="mt-1 bg-muted" /></div>
            <div>
              <Label>Expected Delivery Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left", !preOrderDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {preOrderDate ? format(preOrderDate, "PPP") : t("select_date")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={preOrderDate} onSelect={setPreOrderDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>Note</Label><Textarea value={preOrderNote} onChange={(e) => setPreOrderNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handlePreOrderSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">{t("submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Clock Out Modal ── */}
      <Dialog open={showClockOutModal} onOpenChange={setShowClockOutModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("clock_out")} — {t("mood_select")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setClockOutMood(m.value)}
                  className={cn(
                    "flex flex-col items-center rounded-md border p-3 transition-all",
                    clockOutMood === m.value
                      ? "border-[hsl(var(--panel-employee))] bg-[hsl(var(--panel-employee)/0.15)]"
                      : "border-border"
                  )}
                >
                  <span className="text-2xl mb-1">{m.emoji}</span>
                  <span className="text-xs">{t(m.labelKey)}</span>
                </button>
              ))}
            </div>
            <Textarea value={clockOutNote} onChange={(e) => setClockOutNote(e.target.value)} placeholder="মন্তব্য (optional)" rows={2} />
          </div>
          <DialogFooter>
            <Button onClick={handleClockOut} disabled={!clockOutMood} className="bg-destructive hover:bg-destructive/80 text-destructive-foreground">
              Clock Out নিশ্চিত করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
