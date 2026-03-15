import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, CheckCircle, XCircle, LogIn, LogOut, ShieldAlert } from "lucide-react";
import { useDeductionConfig, getDeductionAmount } from "@/hooks/useDeductionConfig";
import { useAppealReasonOptions } from "@/hooks/useAppealReasonOptions";

interface AttendanceRow {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  mood_in: string | null;
  mood_out: string | null;
  desk_condition: string | null;
  phone_minutes_remaining: number | null;
  deduction_amount: number | null;
  is_late: boolean | null;
  is_early_out: boolean | null;
}

interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string | null;
  created_at: string | null;
}

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😊", sad: "😢", excited: "🎉", tired: "😴", neutral: "😐", angry: "😠",
};

const MOODS = [
  { value: "happy", emoji: "😊", label: "খুশি" },
  { value: "sad", emoji: "😢", label: "দুঃখিত" },
  { value: "excited", emoji: "🎉", label: "উৎসাহিত" },
  { value: "tired", emoji: "😴", label: "ক্লান্ত" },
  { value: "neutral", emoji: "😐", label: "সাধারণ" },
  { value: "angry", emoji: "😠", label: "রাগান্বিত" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function EmployeeAttendance() {
  const { user } = useAuth();
  const deductionConfig = useDeductionConfig();
  const appealReasonOptions = useAppealReasonOptions();
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ shift_start: string | null; shift_end: string | null } | null>(null);

  // Today's record
  const [todayRecord, setTodayRecord] = useState<AttendanceRow | null>(null);

  // Check In modal
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInMood, setCheckInMood] = useState("");
  const [checkInNote, setCheckInNote] = useState("");

  // Check Out modal
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [checkOutMood, setCheckOutMood] = useState("");
  const [checkOutNote, setCheckOutNote] = useState("");

  // Leave modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  // Appeal
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealAttendanceId, setAppealAttendanceId] = useState("");
  const [appealExplanation, setAppealExplanation] = useState("");
  const [appealSelectedReasons, setAppealSelectedReasons] = useState<string[]>([]);
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [existingAppeals, setExistingAppeals] = useState<Record<string, string>>({});

  // Load profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("users").select("shift_start, shift_end").eq("id", user.id).single();
      if (data) setProfile(data);
    })();
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [attRes, leaveRes] = await Promise.all([
      supabase.from("attendance").select("*").eq("user_id", user.id)
        .gte("date", monthStart.toISOString().slice(0, 10))
        .order("date", { ascending: false }),
      supabase.from("leave_requests").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(20),
    ]);

    if (attRes.data) {
      const rows = attRes.data as AttendanceRow[];
      setAttendance(rows);
      setTodayRecord(rows.find(a => a.date === todayStr()) || null);
    }
    if (leaveRes.data) setLeaves(leaveRes.data as LeaveRequest[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load existing appeals
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

  const totalDeductions = attendance.reduce((s, a) => s + (Number(a.deduction_amount) || 0), 0);
  const lateDays = attendance.filter((a) => a.is_late).length;
  const earlyOuts = attendance.filter((a) => a.is_early_out).length;
  const presentDays = attendance.filter((a) => a.clock_in).length;

  // Check In handler
  const handleCheckIn = async () => {
    if (!user || !checkInMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date();
    const nowISO = now.toISOString();
    let isLate = false;
    let lateMinutes = 0;
    if (profile?.shift_start) {
      const parts = profile.shift_start.split(":");
      const shiftDate = new Date();
      shiftDate.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
      if (now > shiftDate) {
        isLate = true;
        lateMinutes = Math.ceil((now.getTime() - shiftDate.getTime()) / 60000);
      }
    }

    const lateAmt = isLate ? getDeductionAmount(deductionConfig.late_tiers, lateMinutes) : 0;
    if (todayRecord) {
      await supabase.from("attendance").update({
        clock_in: nowISO, mood_in: checkInMood, mood_note: checkInNote || null,
        is_late: isLate, deduction_amount: lateAmt,
      }).eq("id", todayRecord.id);
    } else {
      await supabase.from("attendance").insert({
        user_id: user.id, date: todayStr(), clock_in: nowISO, mood_in: checkInMood,
        mood_note: checkInNote || null, is_late: isLate, deduction_amount: lateAmt,
      });
    }

    setShowCheckInModal(false);
    setCheckInMood("");
    setCheckInNote("");
    await loadData();
    toast.success(isLate ? `Check In হয়েছে (${lateMinutes} মিনিট দেরি — ৳${lateAmt} কর্তন)` : "Check In সফল ✓");
  };

  // Check Out handler
  const handleCheckOut = async () => {
    if (!user || !checkOutMood) { toast.error("মুড নির্বাচন করুন"); return; }
    const now = new Date();
    let earlyOut = false;
    let earlyMinutes = 0;
    let extraDeduction = 0;
    if (profile?.shift_end) {
      const parts = profile.shift_end.split(":");
      const shiftEnd = new Date();
      shiftEnd.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
      if (now < shiftEnd) {
        earlyOut = true;
        earlyMinutes = Math.ceil((shiftEnd.getTime() - now.getTime()) / 60000);
        extraDeduction = getDeductionAmount(deductionConfig.early_tiers, earlyMinutes);
      }
    }

    if (todayRecord) {
      await supabase.from("attendance").update({
        clock_out: now.toISOString(), mood_out: checkOutMood,
        is_early_out: earlyOut,
        deduction_amount: (Number(todayRecord.deduction_amount) || 0) + extraDeduction,
      }).eq("id", todayRecord.id);
    }

    setShowCheckOutModal(false);
    setCheckOutMood("");
    setCheckOutNote("");
    await loadData();
    toast.success(earlyOut ? "Check Out হয়েছে (Early — ৳33 কর্তন)" : "Check Out সফল ✓");
  };

  const handleLeaveSubmit = async () => {
    if (!user || !leaveStart || !leaveEnd) { toast.error("তারিখ দিন"); return; }
    await supabase.from("leave_requests").insert({
      user_id: user.id, start_date: leaveStart, end_date: leaveEnd, reason: leaveReason || null,
    });
    toast.success("ছুটির আবেদন জমা হয়েছে ✓");
    setShowLeaveModal(false);
    setLeaveStart(""); setLeaveEnd(""); setLeaveReason("");
    const { data } = await supabase.from("leave_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (data) setLeaves(data as LeaveRequest[]);
  };

  const handleAppealSubmit = async () => {
    if (!user || !appealAttendanceId || !appealExplanation.trim()) { toast.error("কারণ লিখুন"); return; }
    setAppealSubmitting(true);
    const { error } = await supabase.from("attendance_appeals").insert({
      user_id: user.id, attendance_id: appealAttendanceId, explanation: appealExplanation.trim(),
    });
    if (error) { toast.error("আপিল পাঠাতে সমস্যা"); console.error(error); }
    else {
      toast.success("আপিল পাঠানো হয়েছে — HR রিভিউ করবে");
      setExistingAppeals(p => ({ ...p, [appealAttendanceId]: "pending" }));
    }
    setAppealSubmitting(false);
    setShowAppealModal(false);
    setAppealExplanation("");
  };

  const statusColor = (s: string | null) => {
    if (s === "approved") return "text-green-400 border-green-600/50";
    if (s === "rejected") return "text-destructive border-destructive/50";
    return "text-yellow-400 border-yellow-500/50";
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  const hasCheckedIn = !!todayRecord?.clock_in;
  const hasCheckedOut = !!todayRecord?.clock_out;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Clock className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> উপস্থিতি
        </h1>
        <Button onClick={() => setShowLeaveModal(true)} variant="outline">ছুটির আবেদন</Button>
      </div>

      {/* Check In / Check Out Action Card */}
      <Card className="border-[hsl(var(--panel-employee)/0.3)]">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Today's status */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Check In</p>
                <p className="font-heading text-sm">
                  {hasCheckedIn ? (
                    <span className="text-green-500">{new Date(todayRecord!.clock_in!).toLocaleTimeString("bn-BD")}</span>
                  ) : (
                    <span className="text-orange-400">করা হয়নি</span>
                  )}
                </p>
                {todayRecord?.is_late && <Badge variant="outline" className="text-orange-400 border-orange-500/50 text-[10px] mt-1">Late</Badge>}
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Check Out</p>
                <p className="font-heading text-sm">
                  {hasCheckedOut ? (
                    <span className="text-green-500">{new Date(todayRecord!.clock_out!).toLocaleTimeString("bn-BD")}</span>
                  ) : hasCheckedIn ? (
                    <span className="text-blue-400">চলমান</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
                {todayRecord?.is_early_out && <Badge variant="outline" className="text-orange-400 border-orange-500/50 text-[10px] mt-1">Early</Badge>}
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">মুড</p>
                <p className="text-xl">{todayRecord?.mood_in ? MOOD_EMOJIS[todayRecord.mood_in] || "—" : "—"}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">আজকের কর্তন</p>
                <p className="font-heading text-sm">
                  {Number(todayRecord?.deduction_amount) > 0 ? (
                    <span className="text-destructive">৳{todayRecord?.deduction_amount}</span>
                  ) : (
                    <span className="text-green-500">৳০</span>
                  )}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 sm:flex-col">
              {!hasCheckedIn && (
                <Button
                  onClick={() => { setCheckInMood(""); setCheckInNote(""); setShowCheckInModal(true); }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <LogIn className="h-4 w-4 mr-2" /> Check In
                </Button>
              )}
              {hasCheckedIn && !hasCheckedOut && (
                <Button
                  onClick={() => { setCheckOutMood(""); setCheckOutNote(""); setShowCheckOutModal(true); }}
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Check Out
                </Button>
              )}
              {hasCheckedIn && hasCheckedOut && (
                <Badge variant="outline" className="text-green-500 border-green-600/50 px-4 py-2">✓ সম্পূর্ণ</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-heading">{presentDays}</p>
          <p className="text-xs text-muted-foreground">উপস্থিত দিন</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <AlertTriangle className="h-6 w-6 mx-auto text-orange-400 mb-1" />
          <p className="text-2xl font-heading">{lateDays}</p>
          <p className="text-xs text-muted-foreground">দেরিতে আসা</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <XCircle className="h-6 w-6 mx-auto text-orange-400 mb-1" />
          <p className="text-2xl font-heading">{earlyOuts}</p>
          <p className="text-xs text-muted-foreground">আগে চলে যাওয়া</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-heading text-destructive">৳{totalDeductions}</p>
          <p className="text-xs text-muted-foreground">মোট কর্তন</p>
        </CardContent></Card>
      </div>

      {/* Attendance History */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">এই মাসের উপস্থিতি</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2 text-left">তারিখ</th>
                  <th className="py-2 px-2 text-left">Check In</th>
                  <th className="py-2 px-2 text-left">Check Out</th>
                  <th className="py-2 px-2 text-center">মুড</th>
                  <th className="py-2 px-2 text-left">ডেস্ক</th>
                  <th className="py-2 px-2 text-right">মিনিট</th>
                  <th className="py-2 px-2 text-right">কর্তন</th>
                  <th className="py-2 px-2 text-center">স্ট্যাটাস</th>
                  <th className="py-2 px-2 text-center">আপিল</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => {
                  const appealStatus = existingAppeals[a.id];
                  return (
                  <tr key={a.id} className={cn("border-b border-border", (a.is_late || a.is_early_out) && "bg-orange-500/5")}>
                    <td className="py-2 px-2">{new Date(a.date).toLocaleDateString("bn-BD")}</td>
                    <td className="py-2 px-2 text-xs">{a.clock_in ? new Date(a.clock_in).toLocaleTimeString("bn-BD") : "—"}</td>
                    <td className="py-2 px-2 text-xs">{a.clock_out ? new Date(a.clock_out).toLocaleTimeString("bn-BD") : "—"}</td>
                    <td className="py-2 px-2 text-center text-lg">{a.mood_in ? MOOD_EMOJIS[a.mood_in] || "—" : "—"}</td>
                    <td className="py-2 px-2 text-xs">{a.desk_condition?.split("||")[0] || "—"}</td>
                    <td className="py-2 px-2 text-right">{a.phone_minutes_remaining ?? "—"}</td>
                    <td className="py-2 px-2 text-right">{Number(a.deduction_amount) > 0 ? <span className="text-destructive">৳{a.deduction_amount}</span> : "—"}</td>
                    <td className="py-2 px-2 text-center">
                      {a.is_late && <Badge variant="outline" className="text-orange-400 border-orange-500/50 text-xs mr-1">Late</Badge>}
                      {a.is_early_out && <Badge variant="outline" className="text-orange-400 border-orange-500/50 text-xs">Early</Badge>}
                      {!a.is_late && !a.is_early_out && a.clock_in && <Badge variant="outline" className="text-green-400 border-green-600/50 text-xs">OK</Badge>}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {(a.is_late || a.is_early_out) && Number(a.deduction_amount) > 0 ? (
                        appealStatus === "pending" ? <Badge variant="outline" className="text-amber-500 border-amber-500/50 text-[10px]">পেন্ডিং</Badge> :
                        appealStatus === "approved" ? <Badge variant="outline" className="text-emerald-500 border-emerald-500/50 text-[10px]">গৃহীত ✓</Badge> :
                        appealStatus === "rejected" ? <Badge variant="outline" className="text-destructive border-destructive/50 text-[10px]">প্রত্যাখ্যাত</Badge> :
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-[hsl(var(--panel-employee))]"
                          onClick={() => { setAppealAttendanceId(a.id); setAppealExplanation(""); setShowAppealModal(true); }}>
                          <ShieldAlert className="h-3 w-3 mr-1" /> আপিল
                        </Button>
                      ) : "—"}
                    </td>
                  </tr>
                  );
                })}
                {attendance.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">এই মাসে কোনো রেকর্ড নেই</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-heading">ছুটির আবেদন</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2 text-left">শুরু</th>
                  <th className="py-2 px-2 text-left">শেষ</th>
                  <th className="py-2 px-2 text-left">কারণ</th>
                  <th className="py-2 px-2 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id} className="border-b border-border">
                    <td className="py-2 px-2">{new Date(l.start_date).toLocaleDateString("bn-BD")}</td>
                    <td className="py-2 px-2">{new Date(l.end_date).toLocaleDateString("bn-BD")}</td>
                    <td className="py-2 px-2 text-xs">{l.reason || "—"}</td>
                    <td className="py-2 px-2 text-center">
                      <Badge variant="outline" className={statusColor(l.status)}>{l.status || "pending"}</Badge>
                    </td>
                  </tr>
                ))}
                {leaves.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">কোনো ছুটির আবেদন নেই</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Check In Modal */}
      <Dialog open={showCheckInModal} onOpenChange={setShowCheckInModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Check In — মুড নির্বাচন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MOODS.map((m) => (
                <button key={m.value} onClick={() => setCheckInMood(m.value)} className={cn("flex flex-col items-center rounded-md border p-3 transition-all", checkInMood === m.value ? "border-[hsl(var(--panel-employee))] bg-[hsl(var(--panel-employee)/0.15)]" : "border-border")}>
                  <span className="text-2xl mb-1">{m.emoji}</span>
                  <span className="text-xs">{m.label}</span>
                </button>
              ))}
            </div>
            <div>
              <Label>মন্তব্য (ঐচ্ছিক)</Label>
              <Textarea value={checkInNote} onChange={(e) => setCheckInNote(e.target.value)} className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCheckIn} disabled={!checkInMood} className="bg-green-600 hover:bg-green-700 text-white">Check In নিশ্চিত করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check Out Modal */}
      <Dialog open={showCheckOutModal} onOpenChange={setShowCheckOutModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Check Out — মুড নির্বাচন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MOODS.map((m) => (
                <button key={m.value} onClick={() => setCheckOutMood(m.value)} className={cn("flex flex-col items-center rounded-md border p-3 transition-all", checkOutMood === m.value ? "border-[hsl(var(--panel-employee))] bg-[hsl(var(--panel-employee)/0.15)]" : "border-border")}>
                  <span className="text-2xl mb-1">{m.emoji}</span>
                  <span className="text-xs">{m.label}</span>
                </button>
              ))}
            </div>
            <div>
              <Label>মন্তব্য (ঐচ্ছিক)</Label>
              <Textarea value={checkOutNote} onChange={(e) => setCheckOutNote(e.target.value)} className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCheckOut} disabled={!checkOutMood} className="bg-destructive hover:bg-destructive/80 text-destructive-foreground">Check Out নিশ্চিত করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Modal */}
      <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ছুটির আবেদন</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">শুরু তারিখ</label>
                <input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">শেষ তারিখ</label>
                <input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">কারণ</label>
              <Textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleLeaveSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">আবেদন জমা দিন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appeal Modal */}
      <Dialog open={showAppealModal} onOpenChange={setShowAppealModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>কর্তন আপিল</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">দেরি বা আগে যাওয়ার কারণ ব্যাখ্যা করুন। HR রিভিউ করে সিদ্ধান্ত নিবে।</p>
            <div>
              <Label>কারণ *</Label>
              <Textarea value={appealExplanation} onChange={e => setAppealExplanation(e.target.value)} className="mt-1" rows={3} placeholder="কেন দেরি হয়েছিল..." />
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
    </div>
  );
}
