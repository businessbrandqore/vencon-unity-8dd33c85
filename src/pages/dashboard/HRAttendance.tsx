import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const BLUE = "#1D4ED8";

interface AttendanceSummary {
  date: string;
  present: number;
  total: number;
}

interface AttendanceDetail {
  id: string;
  user_name: string;
  clock_in: string | null;
  clock_out: string | null;
  is_late: boolean | null;
  is_early_out: boolean | null;
  deduction_amount: number | null;
  on_leave: boolean;
}

interface Appeal {
  id: string;
  user_name: string;
  date: string;
  explanation: string;
  created_at: string;
  attendance_id: string;
  status: string;
}

const HRAttendance = () => {
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [summaries, setSummaries] = useState<AttendanceSummary[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [loading, setLoading] = useState(true);

  // Detail slide-out
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [details, setDetails] = useState<AttendanceDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Appeals
  const [appeals, setAppeals] = useState<Appeal[]>([]);

  useEffect(() => {
    fetchMonthData();
    fetchAppeals();
  }, [selectedMonth]);

  const fetchMonthData = async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split("-").map(Number);
    const startDate = `${selectedMonth}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

    const [attRes, empRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("date, user_id")
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .neq("panel", "sa"),
    ]);

    const total = empRes.count || 0;
    setTotalEmployees(total);

    // Count unique users per date
    const dateMap: Record<string, Set<string>> = {};
    (attRes.data || []).forEach((a) => {
      if (!dateMap[a.date]) dateMap[a.date] = new Set();
      if (a.user_id) dateMap[a.date].add(a.user_id);
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const sums: AttendanceSummary[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2, "0")}`;
      sums.push({
        date: dateStr,
        present: dateMap[dateStr]?.size || 0,
        total,
      });
    }
    setSummaries(sums);
    setLoading(false);
  };

  const fetchAppeals = async () => {
    const { data: appealRows } = await supabase
      .from("attendance_appeals")
      .select("id, user_id, attendance_id, explanation, created_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!appealRows || appealRows.length === 0) {
      setAppeals([]);
      return;
    }

    const userIds = [...new Set(appealRows.map((a) => a.user_id).filter(Boolean))];
    const attIds = [...new Set(appealRows.map((a) => a.attendance_id).filter(Boolean))];

    const [usersRes, attRes] = await Promise.all([
      supabase.from("users").select("id, name").in("id", userIds as string[]),
      supabase.from("attendance").select("id, date").in("id", attIds as string[]),
    ]);

    const userMap: Record<string, string> = {};
    (usersRes.data || []).forEach((u) => { userMap[u.id] = u.name; });
    const attMap: Record<string, string> = {};
    (attRes.data || []).forEach((a) => { attMap[a.id] = a.date; });

    setAppeals(
      appealRows.map((a) => ({
        id: a.id,
        user_name: a.user_id ? userMap[a.user_id] || "Unknown" : "Unknown",
        date: a.attendance_id ? attMap[a.attendance_id] || "" : "",
        explanation: a.explanation,
        created_at: a.created_at || "",
        attendance_id: a.attendance_id || "",
        status: a.status || "pending",
      }))
    );
  };

  const openDateDetail = async (date: string) => {
    setDetailDate(date);
    setDetailLoading(true);

    const [attRes, empRes, leaveRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("id, user_id, clock_in, clock_out, is_late, is_early_out, deduction_amount")
        .eq("date", date),
      supabase
        .from("users")
        .select("id, name")
        .eq("is_active", true)
        .neq("panel", "sa"),
      supabase
        .from("leave_requests")
        .select("user_id")
        .eq("status", "approved")
        .lte("start_date", date)
        .gte("end_date", date),
    ]);

    const userMap: Record<string, string> = {};
    (empRes.data || []).forEach((u) => { userMap[u.id] = u.name; });

    const leaveSet = new Set((leaveRes.data || []).map((l) => l.user_id));
    const attendedSet = new Set((attRes.data || []).map((a) => a.user_id));

    const detailRows: AttendanceDetail[] = [];

    // Attended employees
    (attRes.data || []).forEach((a) => {
      detailRows.push({
        id: a.id,
        user_name: a.user_id ? userMap[a.user_id] || "Unknown" : "Unknown",
        clock_in: a.clock_in,
        clock_out: a.clock_out,
        is_late: a.is_late,
        is_early_out: a.is_early_out,
        deduction_amount: a.deduction_amount ? Number(a.deduction_amount) : null,
        on_leave: false,
      });
    });

    // Absent/on-leave employees
    Object.entries(userMap).forEach(([uid, name]) => {
      if (!attendedSet.has(uid)) {
        detailRows.push({
          id: uid,
          user_name: name,
          clock_in: null,
          clock_out: null,
          is_late: null,
          is_early_out: null,
          deduction_amount: null,
          on_leave: leaveSet.has(uid),
        });
      }
    });

    setDetails(detailRows.sort((a, b) => a.user_name.localeCompare(b.user_name)));
    setDetailLoading(false);
  };

  const getStatus = (d: AttendanceDetail): { label: string; color: string } => {
    if (d.on_leave) return { label: isBn ? "ছুটিতে" : "On Leave", color: "#3B82F6" };
    if (!d.clock_in) return { label: isBn ? "অনুপস্থিত" : "Absent", color: "#EF4444" };
    if (d.is_late) return { label: isBn ? "দেরি" : "Late", color: "#F59E0B" };
    if (d.is_early_out) return { label: isBn ? "আর্লি আউট" : "Early Out", color: "#F97316" };
    return { label: isBn ? "সময়মতো" : "On Time", color: "#22C55E" };
  };

  const handleAppeal = async (appeal: Appeal, approve: boolean) => {
    await supabase
      .from("attendance_appeals")
      .update({ status: approve ? "approved" : "rejected" })
      .eq("id", appeal.id);

    if (approve && appeal.attendance_id) {
      await supabase
        .from("attendance")
        .update({ deduction_amount: 0, is_late: false })
        .eq("id", appeal.attendance_id);
    }

    fetchAppeals();
  };

  // Build calendar
  const [year, month] = selectedMonth.split("-").map(Number);
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "উপস্থিতি ম্যানেজমেন্ট" : "Attendance Management"}
        </h2>
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-48 bg-background border-border text-foreground"
        />
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-16 bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-7 gap-1">
            {dayHeaders.map((d) => (
              <div key={d} className="text-center text-[10px] text-muted-foreground py-1 font-body">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {summaries.map((s) => {
              const day = Number(s.date.split("-")[2]);
              const pct = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
              const isPast = s.date <= today;
              return (
                <button
                  key={s.date}
                  onClick={() => isPast && openDateDetail(s.date)}
                  disabled={!isPast}
                  className="border border-border p-2 text-left hover:bg-secondary/50 disabled:opacity-30 transition-colors"
                >
                  <p className="font-heading text-xs font-bold text-foreground">{day}</p>
                  {isPast && (
                    <p className="text-[10px] font-body" style={{ color: pct >= 80 ? "#22C55E" : pct >= 50 ? "#F59E0B" : "#EF4444" }}>
                      {s.present}/{s.total}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Appeals Section */}
      <div className="space-y-3">
        <h3 className="font-heading text-lg font-bold text-foreground">
          {isBn ? "আপিল (পেন্ডিং)" : "Attendance Appeals (Pending)"}
        </h3>
        {appeals.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body border border-border p-4 text-center">
            {isBn ? "কোনো পেন্ডিং আপিল নেই" : "No pending appeals"}
          </p>
        ) : (
          <div className="border border-border">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-[11px]">
                  <th className="text-left p-3">{isBn ? "নাম" : "Name"}</th>
                  <th className="text-left p-3">{isBn ? "তারিখ" : "Date"}</th>
                  <th className="text-left p-3">{isBn ? "ব্যাখ্যা" : "Explanation"}</th>
                  <th className="text-left p-3">{isBn ? "জমা" : "Submitted"}</th>
                  <th className="text-right p-3">{isBn ? "অ্যাকশন" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {appeals.map((a) => (
                  <tr key={a.id}>
                    <td className="p-3 text-foreground font-bold">{a.user_name}</td>
                    <td className="p-3 text-foreground">{a.date}</td>
                    <td className="p-3 text-foreground text-xs max-w-xs truncate">{a.explanation}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleAppeal(a, true)}
                        className="text-xs px-2 py-1 text-white bg-green-600"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleAppeal(a, false)}
                        className="text-xs px-2 py-1 text-white bg-red-600"
                      >
                        ✗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Date Detail Dialog */}
      <Dialog open={!!detailDate} onOpenChange={(o) => { if (!o) setDetailDate(null); }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">
              {detailDate} — {isBn ? "উপস্থিতি বিবরণ" : "Attendance Detail"}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-secondary animate-pulse" />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-[11px]">
                  <th className="text-left p-2">{isBn ? "নাম" : "Name"}</th>
                   <th className="text-left p-2">{isBn ? "চেক ইন" : "Check In"}</th>
                   <th className="text-left p-2">{isBn ? "চেক আউট" : "Check Out"}</th>
                  <th className="text-left p-2">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                  <th className="text-right p-2">{isBn ? "কর্তন" : "Deduction"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {details.map((d) => {
                  const status = getStatus(d);
                  return (
                    <tr key={d.id}>
                      <td className="p-2 text-foreground">{d.user_name}</td>
                      <td className="p-2 text-foreground text-xs">
                        {d.clock_in ? new Date(d.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="p-2 text-foreground text-xs">
                        {d.clock_out ? new Date(d.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="p-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 text-white" style={{ backgroundColor: status.color }}>
                          {status.label}
                        </span>
                      </td>
                      <td className="p-2 text-right text-destructive text-xs">
                        {d.deduction_amount ? `৳${d.deduction_amount}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRAttendance;
