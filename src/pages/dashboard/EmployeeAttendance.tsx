import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

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

export default function EmployeeAttendance() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
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

      if (attRes.data) setAttendance(attRes.data as AttendanceRow[]);
      if (leaveRes.data) setLeaves(leaveRes.data as LeaveRequest[]);
      setLoading(false);
    })();
  }, [user]);

  const totalDeductions = attendance.reduce((s, a) => s + (Number(a.deduction_amount) || 0), 0);
  const lateDays = attendance.filter((a) => a.is_late).length;
  const earlyOuts = attendance.filter((a) => a.is_early_out).length;
  const presentDays = attendance.filter((a) => a.clock_in).length;

  const handleLeaveSubmit = async () => {
    if (!user || !leaveStart || !leaveEnd) { toast.error("তারিখ দিন"); return; }
    await supabase.from("leave_requests").insert({
      user_id: user.id,
      start_date: leaveStart,
      end_date: leaveEnd,
      reason: leaveReason || null,
    });
    toast.success("ছুটির আবেদন জমা হয়েছে ✓");
    setShowLeaveModal(false);
    setLeaveStart(""); setLeaveEnd(""); setLeaveReason("");
    // Reload
    const { data } = await supabase.from("leave_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (data) setLeaves(data as LeaveRequest[]);
  };

  const statusColor = (s: string | null) => {
    if (s === "approved") return "text-green-400 border-green-600/50";
    if (s === "rejected") return "text-destructive border-destructive/50";
    return "text-yellow-400 border-yellow-500/50";
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Clock className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> উপস্থিতি
        </h1>
        <Button onClick={() => setShowLeaveModal(true)} variant="outline">ছুটির আবেদন</Button>
      </div>

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
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
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
                  </tr>
                ))}
                {attendance.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">এই মাসে কোনো রেকর্ড নেই</td></tr>}
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
    </div>
  );
}
