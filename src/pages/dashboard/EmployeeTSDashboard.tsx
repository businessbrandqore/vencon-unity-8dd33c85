import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDeductionConfig, getDeductionAmount } from "@/hooks/useDeductionConfig";
import { useAppealReasonOptions } from "@/hooks/useAppealReasonOptions";
import { Clock, AlertTriangle, LogOut, TrendingUp, Package, Truck, RotateCcw, XCircle, ShieldAlert, CheckCircle, BarChart3 } from "lucide-react";
import SalaryCard from "@/components/SalaryCard";

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

/* ───── constants ───── */
const MOODS = [
  { value: "happy", emoji: "😊", labelKey: "mood_happy" },
  { value: "sad", emoji: "😢", labelKey: "mood_sad" },
  { value: "excited", emoji: "🎉", labelKey: "mood_excited" },
  { value: "tired", emoji: "😴", labelKey: "mood_tired" },
  { value: "neutral", emoji: "😐", labelKey: "mood_neutral" },
  { value: "angry", emoji: "😠", labelKey: "mood_angry" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

/* ═══════════════════════════════════════════ */
export default function EmployeeTSDashboard() {
  const { user } = useAuth();
  const { t, n } = useLanguage();
  const deductionConfig = useDeductionConfig();

  /* user profile with shift info */
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isWithinShift, setIsWithinShift] = useState<boolean | null>(null);

  /* attendance */
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow | null>(null);
  const [monthAttendance, setMonthAttendance] = useState<AttendanceRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  /* flow state */
  const [deskReportDone, setDeskReportDone] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);

  /* modals */
  const [showDeskModal, setShowDeskModal] = useState(false);
  const [showMoodInModal, setShowMoodInModal] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealAttendanceId, setAppealAttendanceId] = useState("");
  const [appealExplanation, setAppealExplanation] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [existingAppeals, setExistingAppeals] = useState<Record<string, string>>({});

  /* desk report */
  const [deskCondition, setDeskCondition] = useState("");
  const [deskNote, setDeskNote] = useState("");
  const [phoneMins, setPhoneMins] = useState<number>(0);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [deskNumber, setDeskNumber] = useState("");
  const [phoneInstruction, setPhoneInstruction] = useState("");

  /* mood */
  const [selectedMood, setSelectedMood] = useState("");
  const [moodNote, setMoodNote] = useState("");
  const [clockOutMood, setClockOutMood] = useState("");
  const [clockOutNote, setClockOutNote] = useState("");

  /* metrics */
  const [metrics, setMetrics] = useState({ orders: 0, delivered: 0, cancelled: 0, returned: 0, totalLeads: 0 });
  const [monthDeductions, setMonthDeductions] = useState(0);
  const [dailyOrders, setDailyOrders] = useState(0);

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
      setIsWithinShift(true);
    }
  }, [profile]);

  /* ───── load today attendance ───── */
  const loadAttendance = useCallback(async () => {
    if (!user) return;
    setAttendanceLoading(true);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [todayRes, monthRes] = await Promise.all([
      supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", todayStr()).maybeSingle(),
      supabase.from("attendance").select("*").eq("user_id", user.id).gte("date", monthStart.toISOString().slice(0, 10)).order("date", { ascending: false }),
    ]);

    if (todayRes.data) {
      const row = todayRes.data as AttendanceRow;
      setTodayAttendance(row);
      setDeskReportDone(!!(row.desk_condition));
      setClockedIn(!!row.clock_in);
    } else {
      setTodayAttendance(null);
      setDeskReportDone(false);
      setClockedIn(false);
    }
    if (monthRes.data) {
      setMonthAttendance(monthRes.data as AttendanceRow[]);
    }
    setAttendanceLoading(false);
  }, [user]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  /* ───── load existing appeals ───── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("attendance_appeals").select("attendance_id, status").eq("user_id", user.id);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((a: any) => { if (a.attendance_id) map[a.attendance_id] = a.status; });
        setExistingAppeals(map);
      }
    })();
  }, [user]);

  /* ───── load phone instruction ───── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "phone_minutes_instruction").maybeSingle();
      if (data?.value) setPhoneInstruction(String(data.value).replace(/^"|"$/g, ''));
    })();
  }, []);

  /* ───── load metrics ───── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [ordersRes, attRes, leadsRes, dailyRes] = await Promise.all([
        supabase.from("orders").select("status, delivery_status").eq("agent_id", user.id).gte("created_at", monthStart.toISOString()),
        supabase.from("attendance").select("deduction_amount").eq("user_id", user.id).gte("date", monthStart.toISOString().slice(0, 10)),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", user.id),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("agent_id", user.id).gte("created_at", todayStart.toISOString()),
      ]);

      if (ordersRes.data) {
        setMetrics({
          orders: ordersRes.data.length,
          delivered: ordersRes.data.filter((o) => o.delivery_status === "delivered").length,
          cancelled: ordersRes.data.filter((o) => o.status === "cancelled").length,
          returned: ordersRes.data.filter((o) => o.delivery_status === "returned").length,
          totalLeads: leadsRes.count || 0,
        });
      }
      if (attRes.data) {
        setMonthDeductions(attRes.data.reduce((s, a) => s + (Number(a.deduction_amount) || 0), 0));
      }
      setDailyOrders(dailyRes.count || 0);
    })();
  }, [user, tick]);

  /* ───── computed ───── */
  const salesRatio = metrics.orders > 0 ? ((metrics.orders / Math.max(metrics.totalLeads + metrics.orders, 1)) * 100).toFixed(1) : "0";
  const receiveRatio = metrics.orders > 0 ? ((metrics.delivered / metrics.orders) * 100).toFixed(1) : "0";
  const cancelRatio = metrics.orders > 0 ? ((metrics.cancelled / metrics.orders) * 100).toFixed(1) : "0";
  const returnRatio = metrics.orders > 0 ? ((metrics.returned / metrics.orders) * 100).toFixed(1) : "0";
  const basicSalary = profile?.basic_salary || 0;
  const netSalary = basicSalary - monthDeductions;

  const lateDays = monthAttendance.filter(a => a.is_late).length;
  const earlyOuts = monthAttendance.filter(a => a.is_early_out).length;
  const presentDays = monthAttendance.filter(a => a.clock_in).length;

  /* ───── handlers ───── */
  const handleDeskReportSubmit = async () => {
    if (!user || (!deskCondition && !deskNote)) { toast.error("ডেস্কের অবস্থা নির্বাচন করুন বা লিখুন"); return; }
    const deskValue = deskNote ? `${deskCondition}||${deskNote}` : deskCondition;
    if (todayAttendance) {
      await supabase.from("attendance").update({
        desk_condition: deskValue, phone_minutes_remaining: phoneMins, phone_number: phoneNumber || null, desk_number: deskNumber || null,
      } as any).eq("id", todayAttendance.id);
    } else {
      await supabase.from("attendance").insert({
        user_id: user.id, date: todayStr(), desk_condition: deskValue, phone_minutes_remaining: phoneMins, phone_number: phoneNumber || null, desk_number: deskNumber || null,
      } as any);
    }
    setShowDeskModal(false);
    await loadAttendance();
    toast.success("ডেস্ক রিপোর্ট সংরক্ষণ করা হয়েছে");
  };

  const handleClockIn = async () => {
    if (!user || !selectedMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date();
    const nowISO = now.toISOString();
    let isLate = false;
    let lateMinutes = 0;
    if (profile?.shift_start) {
      const shiftParts = profile.shift_start.split(":");
      const shiftDate = new Date();
      shiftDate.setHours(parseInt(shiftParts[0]), parseInt(shiftParts[1]), 0, 0);
      if (now > shiftDate) { isLate = true; lateMinutes = Math.ceil((now.getTime() - shiftDate.getTime()) / 60000); }
    }
    const lateAmt = isLate ? getDeductionAmount(deductionConfig.late_tiers, lateMinutes) : 0;
    if (todayAttendance) {
      await supabase.from("attendance").update({ clock_in: nowISO, mood_in: selectedMood, mood_note: moodNote || null, is_late: isLate, deduction_amount: lateAmt }).eq("id", todayAttendance.id);
    } else {
      await supabase.from("attendance").insert({ user_id: user.id, date: todayStr(), clock_in: nowISO, mood_in: selectedMood, mood_note: moodNote || null, is_late: isLate, deduction_amount: lateAmt });
    }
    setShowMoodInModal(false);
    setClockedIn(true);
    await loadAttendance();
    toast.success(isLate ? `Check In হয়েছে (${lateMinutes} মিনিট দেরি — ৳${lateAmt} কর্তন)` : "Check In সফল ✓");
  };

  const handleClockOut = async () => {
    if (!user || !clockOutMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date();
    let earlyOut = false;
    let earlyMinutes = 0;
    let extraDeduction = 0;
    if (profile?.shift_end) {
      const shiftParts = profile.shift_end.split(":");
      const shiftEnd = new Date();
      shiftEnd.setHours(parseInt(shiftParts[0]), parseInt(shiftParts[1]), 0, 0);
      if (now < shiftEnd) { earlyOut = true; earlyMinutes = Math.ceil((shiftEnd.getTime() - now.getTime()) / 60000); extraDeduction = getDeductionAmount(deductionConfig.early_tiers, earlyMinutes); }
    }
    if (todayAttendance) {
      await supabase.from("attendance").update({
        clock_out: now.toISOString(), mood_out: clockOutMood, is_early_out: earlyOut,
        deduction_amount: (Number(todayAttendance.deduction_amount) || 0) + extraDeduction,
      }).eq("id", todayAttendance.id);
    }
    setShowClockOutModal(false);
    await loadAttendance();
    toast.success(earlyOut ? `Check Out হয়েছে (${earlyMinutes} মিনিট আগে — ৳${extraDeduction} কর্তন)` : "Check Out সফল ✓");
  };

  const handleAppealSubmit = async () => {
    if (!user || !appealAttendanceId || !appealExplanation.trim()) { toast.error("কারণ লিখুন"); return; }
    setAppealSubmitting(true);
    const { error } = await supabase.from("attendance_appeals").insert({
      user_id: user.id, attendance_id: appealAttendanceId, explanation: appealExplanation.trim(),
    });
    if (error) { toast.error("আপিল পাঠাতে সমস্যা হয়েছে"); console.error(error); }
    else {
      toast.success("আপিল পাঠানো হয়েছে — HR রিভিউ করবে");
      setExistingAppeals(p => ({ ...p, [appealAttendanceId]: "pending" }));
    }
    setAppealSubmitting(false);
    setShowAppealModal(false);
    setAppealExplanation("");
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

        <Dialog open={showDeskModal} onOpenChange={setShowDeskModal}>
          <DialogContent className="max-w-md">
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
                <Label>বিস্তারিত লিখুন (ঐচ্ছিক)</Label>
                <Textarea value={deskNote} onChange={(e) => setDeskNote(e.target.value)} className="mt-1" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>মোবাইল নাম্বার</Label><Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="mt-1" placeholder="01XXXXXXXXX" /></div>
                <div><Label>ডেস্ক নাম্বার</Label><Input value={deskNumber} onChange={(e) => setDeskNumber(e.target.value)} className="mt-1" placeholder="ডেস্ক নং" /></div>
              </div>
              <div>
                <Label>{t("phone_minutes")}</Label>
                {phoneInstruction && (
                  <div className="mt-1 mb-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300">
                    <p className="font-medium mb-1">📱 মিনিট চেক করার নিয়ম:</p>
                    <p className="whitespace-pre-wrap">{phoneInstruction}</p>
                  </div>
                )}
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
                <button key={m.value} onClick={() => setSelectedMood(m.value)}
                  className={cn("flex flex-col items-center rounded-md border p-4 transition-all hover:border-[hsl(var(--panel-employee))]",
                    selectedMood === m.value ? "border-[hsl(var(--panel-employee))] bg-[hsl(var(--panel-employee)/0.15)]" : "border-border"
                  )}>
                  <span className="text-3xl mb-1">{m.emoji}</span>
                  <span className="text-xs text-muted-foreground">{t(m.labelKey)}</span>
                </button>
              ))}
            </div>
            <div>
              <Label>{t("mood_write")}</Label>
              <Textarea value={moodNote} onChange={(e) => setMoodNote(e.target.value)} className="mt-1" rows={2} />
            </div>
            <Button onClick={handleClockIn} disabled={!selectedMood}
              className="w-full bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">
              {t("clock_in")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ═══════════════════════════════════════════ */
  /* ───── MAIN DASHBOARD (Analytics) ───── */
  /* ═══════════════════════════════════════════ */

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> ড্যাশবোর্ড
        </h1>
        <Button variant="outline" onClick={() => { setClockOutMood(""); setClockOutNote(""); setShowClockOutModal(true); }}
          className="border-destructive text-destructive hover:bg-destructive/10">
          <LogOut className="h-4 w-4 mr-2" />{t("clock_out")}
        </Button>
      </div>

      {/* Today's quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-[hsl(var(--panel-employee)/0.3)]">
          <CardContent className="pt-5 text-center">
            <Package className="h-6 w-6 mx-auto text-[hsl(var(--panel-employee))] mb-1" />
            <p className="text-2xl font-heading">{n(dailyOrders)}</p>
            <p className="text-xs text-muted-foreground">আজকের অর্ডার</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <TrendingUp className="h-6 w-6 mx-auto text-emerald-500 mb-1" />
            <p className="text-2xl font-heading">{n(metrics.orders)}</p>
            <p className="text-xs text-muted-foreground">মাসিক অর্ডার</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <Truck className="h-6 w-6 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-heading">{n(metrics.delivered)}</p>
            <p className="text-xs text-muted-foreground">ডেলিভারি হয়েছে</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <RotateCcw className="h-6 w-6 mx-auto text-orange-500 mb-1" />
            <p className="text-2xl font-heading">{n(metrics.returned)}</p>
            <p className="text-xs text-muted-foreground">রিটার্ন</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Ratios */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading flex items-center gap-2"><TrendingUp className="h-4 w-4" /> পারফরমেন্স এনালাইসিস</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-md border border-border">
              <p className="text-xs text-muted-foreground mb-1">সেলস রেশিও</p>
              <p className={cn("text-2xl font-heading", Number(salesRatio) >= 20 ? "text-emerald-500" : "text-orange-500")}>{salesRatio}%</p>
            </div>
            <div className="text-center p-3 rounded-md border border-border">
              <p className="text-xs text-muted-foreground mb-1">রিসিভ রেশিও</p>
              <p className={cn("text-2xl font-heading", Number(receiveRatio) >= 60 ? "text-emerald-500" : "text-destructive")}>{receiveRatio}%</p>
              {Number(receiveRatio) < 60 && Number(receiveRatio) > 0 && (
                <p className="text-[10px] text-destructive mt-1">⚠ ৬০% এর নিচে — ইনসেনটিভ ০</p>
              )}
            </div>
            <div className="text-center p-3 rounded-md border border-border">
              <p className="text-xs text-muted-foreground mb-1">ক্যান্সেল রেশিও</p>
              <p className={cn("text-2xl font-heading", Number(cancelRatio) > 20 ? "text-destructive" : "text-foreground")}>{cancelRatio}%</p>
            </div>
            <div className="text-center p-3 rounded-md border border-border">
              <p className="text-xs text-muted-foreground mb-1">রিটার্ন রেশিও</p>
              <p className={cn("text-2xl font-heading", Number(returnRatio) > 15 ? "text-orange-500" : "text-foreground")}>{returnRatio}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Salary Summary */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">বেতন সারাংশ (চলমান মাস)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">বেসিক</p>
              <p className="text-lg font-heading">৳{n(basicSalary)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">কর্তন</p>
              <p className="text-lg font-heading text-destructive">-৳{n(monthDeductions)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">নেট</p>
              <p className="text-lg font-heading text-[hsl(var(--panel-employee))]">৳{n(netSalary)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Summary */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading flex items-center gap-2"><Clock className="h-4 w-4" /> উপস্থিতি সারাংশ</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-2 rounded border border-border">
              <CheckCircle className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
              <p className="text-xl font-heading">{n(presentDays)}</p>
              <p className="text-[10px] text-muted-foreground">উপস্থিত</p>
            </div>
            <div className="text-center p-2 rounded border border-border">
              <AlertTriangle className="h-5 w-5 mx-auto text-orange-400 mb-1" />
              <p className="text-xl font-heading">{n(lateDays)}</p>
              <p className="text-[10px] text-muted-foreground">দেরি</p>
            </div>
            <div className="text-center p-2 rounded border border-border">
              <XCircle className="h-5 w-5 mx-auto text-orange-400 mb-1" />
              <p className="text-xl font-heading">{n(earlyOuts)}</p>
              <p className="text-[10px] text-muted-foreground">আগে প্রস্থান</p>
            </div>
            <div className="text-center p-2 rounded border border-border">
              <p className="text-xl font-heading text-destructive">৳{n(monthDeductions)}</p>
              <p className="text-[10px] text-muted-foreground">মোট কর্তন</p>
            </div>
          </div>

          {/* Late/early rows with appeal */}
          {monthAttendance.filter(a => a.is_late || a.is_early_out).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">কর্তন হয়েছে এমন দিনগুলো:</p>
              {monthAttendance.filter(a => a.is_late || a.is_early_out).map(a => {
                const appealStatus = existingAppeals[a.id];
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span>{new Date(a.date).toLocaleDateString("bn-BD")}</span>
                      {a.is_late && <Badge variant="outline" className="text-orange-400 border-orange-500/50 text-[10px]">Late</Badge>}
                      {a.is_early_out && <Badge variant="outline" className="text-orange-400 border-orange-500/50 text-[10px]">Early</Badge>}
                      <span className="text-destructive">৳{a.deduction_amount || 0}</span>
                    </div>
                    <div>
                      {appealStatus === "pending" && <Badge variant="outline" className="text-amber-500 border-amber-500/50 text-[10px]">আপিল পেন্ডিং</Badge>}
                      {appealStatus === "approved" && <Badge variant="outline" className="text-emerald-500 border-emerald-500/50 text-[10px]">আপিল গৃহীত ✓</Badge>}
                      {appealStatus === "rejected" && <Badge variant="outline" className="text-destructive border-destructive/50 text-[10px]">আপিল প্রত্যাখ্যাত</Badge>}
                      {!appealStatus && Number(a.deduction_amount) > 0 && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] border-[hsl(var(--panel-employee))] text-[hsl(var(--panel-employee))]"
                          onClick={() => { setAppealAttendanceId(a.id); setAppealExplanation(""); setShowAppealModal(true); }}>
                          <ShieldAlert className="h-3 w-3 mr-1" /> আপিল করুন
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigate to Leads */}
      <Card className="border-[hsl(var(--panel-employee)/0.3)] bg-[hsl(var(--panel-employee)/0.05)]">
        <CardContent className="py-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">লিড শীট দেখতে ও কাজ করতে</p>
          <Button onClick={() => window.location.href = "/employee/leads"} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">
            লিড শীটে যান →
          </Button>
        </CardContent>
      </Card>

      {/* Appeal Modal */}
      <Dialog open={showAppealModal} onOpenChange={setShowAppealModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>কর্তন আপিল</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">দেরি বা আগে যাওয়ার কারণ ব্যাখ্যা করুন। HR রিভিউ করে সিদ্ধান্ত নিবে।</p>
            <div>
              <Label>কারণ *</Label>
              <Textarea value={appealExplanation} onChange={e => setAppealExplanation(e.target.value)} className="mt-1" rows={3} placeholder="কেন দেরি হয়েছিল বা আগে যেতে হয়েছিল..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAppealModal(false)}>বাতিল</Button>
            <Button onClick={handleAppealSubmit} disabled={appealSubmitting || !appealExplanation.trim()}
              className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">
              {appealSubmitting ? "পাঠানো হচ্ছে..." : "আপিল পাঠান"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clock Out Modal */}
      <Dialog open={showClockOutModal} onOpenChange={setShowClockOutModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("clock_out")} — {t("mood_select")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MOODS.map((m) => (
                <button key={m.value} onClick={() => setClockOutMood(m.value)}
                  className={cn("flex flex-col items-center rounded-md border p-3 transition-all",
                    clockOutMood === m.value ? "border-[hsl(var(--panel-employee))] bg-[hsl(var(--panel-employee)/0.15)]" : "border-border"
                  )}>
                  <span className="text-2xl mb-1">{m.emoji}</span>
                  <span className="text-xs">{t(m.labelKey)}</span>
                </button>
              ))}
            </div>
            <Textarea value={clockOutNote} onChange={(e) => setClockOutNote(e.target.value)} placeholder="মন্তব্য (optional)" rows={2} />
          </div>
          <DialogFooter>
            <Button onClick={handleClockOut} disabled={!clockOutMood} className="bg-destructive hover:bg-destructive/80 text-destructive-foreground">
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
