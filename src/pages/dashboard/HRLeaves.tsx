import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BLUE = "#1D4ED8";

interface LeaveRequest {
  id: string;
  user_id: string;
  user_name: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
  status: string;
  decided_by: string | null;
}

const HRLeaves = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const isBn = t("vencon") === "VENCON";

  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [pendingRes, historyRes, empRes] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("id, user_id, start_date, end_date, reason, created_at, status, decided_by")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("leave_requests")
        .select("id, user_id, start_date, end_date, reason, created_at, status, decided_by")
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("users")
        .select("id, name")
        .eq("is_active", true),
    ]);

    const userMap: Record<string, string> = {};
    (empRes.data || []).forEach((u) => { userMap[u.id] = u.name; });
    setEmployees(empRes.data || []);

    const mapRows = (rows: any[]) =>
      rows.map((r) => ({
        ...r,
        user_name: r.user_id ? userMap[r.user_id] || "Unknown" : "Unknown",
      }));

    setPending(mapRows(pendingRes.data || []));
    setHistory(mapRows(historyRes.data || []));
    setLoading(false);
  };

  const getDuration = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleDecision = async (leave: LeaveRequest, decision: "paid" | "unpaid" | "rejected") => {
    if (!user) return;

    const statusMap = {
      paid: "approved",
      unpaid: "approved",
      rejected: "rejected",
    };

    await supabase
      .from("leave_requests")
      .update({
        status: statusMap[decision],
        decided_by: user.id,
      })
      .eq("id", leave.id);

    // If unpaid, calculate deduction
    if (decision === "unpaid" && leave.user_id) {
      const { data: empData } = await supabase
        .from("users")
        .select("basic_salary")
        .eq("id", leave.user_id)
        .single();

      if (empData?.basic_salary) {
        const days = getDuration(leave.start_date, leave.end_date);
        const dailyRate = Number(empData.basic_salary) / 26;
        const deduction = Math.round(dailyRate * days);

        // Insert deduction as attendance record for tracking
        // We log this via audit
        await supabase.from("audit_logs").insert({
          action: `leave_unpaid_deduction: ৳${deduction} for ${days} days`,
          actor_id: user.id,
          actor_role: user.role,
          target_id: leave.user_id,
          target_table: "leave_requests",
          details: { leave_id: leave.id, deduction, days },
        } as any);
      }
    }

    const labels = {
      paid: isBn ? "বেতনসহ ছুটি অনুমোদিত ✓" : "Paid leave approved ✓",
      unpaid: isBn ? "বিনা বেতনে ছুটি — কর্তন প্রযোজ্য" : "Unpaid leave — deduction applied",
      rejected: isBn ? "ছুটি প্রত্যাখ্যাত" : "Leave rejected",
    };

    toast({ title: labels[decision] });
    fetchAll();
  };

  const filteredHistory = filterEmployee === "all"
    ? history
    : history.filter((h) => h.user_id === filterEmployee);

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold text-foreground">
        {isBn ? "ছুটি ম্যানেজমেন্ট" : "Leave Management"}
      </h2>

      <Tabs defaultValue="pending">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="pending" className="data-[state=active]:bg-background font-body text-sm">
            {isBn ? "পেন্ডিং" : "Pending"} ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-background font-body text-sm">
            {isBn ? "ইতিহাস" : "History"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {loading ? (
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-secondary animate-pulse" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 border border-border">
              {isBn ? "কোনো পেন্ডিং ছুটির অনুরোধ নেই" : "No pending leave requests"}
            </p>
          ) : (
            <div className="border border-border">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="bg-secondary text-muted-foreground text-[11px]">
                    <th className="text-left p-3">{isBn ? "নাম" : "Name"}</th>
                    <th className="text-left p-3">{isBn ? "তারিখ" : "Dates"}</th>
                    <th className="text-center p-3">{isBn ? "দিন" : "Days"}</th>
                    <th className="text-left p-3">{isBn ? "কারণ" : "Reason"}</th>
                    <th className="text-left p-3">{isBn ? "অনুরোধ" : "Requested"}</th>
                    <th className="text-right p-3">{isBn ? "অ্যাকশন" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pending.map((l) => (
                    <tr key={l.id}>
                      <td className="p-3 text-foreground font-bold">{l.user_name}</td>
                      <td className="p-3 text-foreground text-xs">
                        {l.start_date} → {l.end_date}
                      </td>
                      <td className="p-3 text-center text-foreground font-bold">
                        {getDuration(l.start_date, l.end_date)}
                      </td>
                      <td className="p-3 text-foreground text-xs max-w-[200px] truncate">
                        {l.reason || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {new Date(l.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => handleDecision(l, "paid")}
                          className="text-[10px] px-2 py-1 text-white bg-green-600 font-bold"
                          title={isBn ? "বেতনসহ ছুটি" : "Paid Holiday"}
                        >
                          ✓ {isBn ? "বেতনসহ" : "Paid"}
                        </button>
                        <button
                          onClick={() => handleDecision(l, "unpaid")}
                          className="text-[10px] px-2 py-1 text-white font-bold"
                          style={{ backgroundColor: "#F59E0B" }}
                          title={isBn ? "বিনা বেতনে" : "Unpaid"}
                        >
                          ~ {isBn ? "বিনা বেতনে" : "Unpaid"}
                        </button>
                        <button
                          onClick={() => handleDecision(l, "rejected")}
                          className="text-[10px] px-2 py-1 text-white bg-red-600 font-bold"
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
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-64 bg-background border-border text-foreground">
              <SelectValue placeholder={isBn ? "কর্মচারী ফিল্টার" : "Filter by employee"} />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border max-h-60">
              <SelectItem value="all">{isBn ? "সকল" : "All"}</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="border border-border">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-[11px]">
                  <th className="text-left p-3">{isBn ? "নাম" : "Name"}</th>
                  <th className="text-left p-3">{isBn ? "তারিখ" : "Dates"}</th>
                  <th className="text-center p-3">{isBn ? "দিন" : "Days"}</th>
                  <th className="text-left p-3">{isBn ? "কারণ" : "Reason"}</th>
                  <th className="text-center p-3">{isBn ? "সিদ্ধান্ত" : "Decision"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredHistory.map((l) => (
                  <tr key={l.id}>
                    <td className="p-3 text-foreground">{l.user_name}</td>
                    <td className="p-3 text-foreground text-xs">{l.start_date} → {l.end_date}</td>
                    <td className="p-3 text-center text-foreground">{getDuration(l.start_date, l.end_date)}</td>
                    <td className="p-3 text-foreground text-xs max-w-[200px] truncate">{l.reason || "—"}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 text-white ${
                        l.status === "approved" ? "bg-green-600" : "bg-red-600"
                      }`}>
                        {l.status === "approved" ? (isBn ? "অনুমোদিত" : "Approved") : (isBn ? "প্রত্যাখ্যাত" : "Rejected")}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      {isBn ? "কোনো রেকর্ড নেই" : "No records"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HRLeaves;
