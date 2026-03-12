import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BLUE = "#1D4ED8";

interface EmployeeData {
  id: string;
  name: string;
  email: string;
  role: string;
  panel: string;
  is_active: boolean;
  basic_salary: number | null;
  shift_start: string | null;
  shift_end: string | null;
  phone: string | null;
  created_at: string;
  father_name?: string;
  father_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  guardian_type?: string;
  off_days?: string[];
  gps_location?: string;
}

interface AttendanceDay {
  date: string;
  is_late: boolean | null;
  clock_in: string | null;
}

interface LeaveReq {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
}

const HREmployeeProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isBn = t("vencon") === "VENCON";

  const [emp, setEmp] = useState<EmployeeData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceDay[]>([]);
  const [leaves, setLeaves] = useState<LeaveReq[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [editSalary, setEditSalary] = useState("");
  const [editShiftStart, setEditShiftStart] = useState("");
  const [editShiftEnd, setEditShiftEnd] = useState("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [currentCampaignId, setCurrentCampaignId] = useState("");
  const [editCampaignId, setEditCampaignId] = useState("");

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      const [empRes, attRes, leaveRes, campaignsRes] = await Promise.all([
        supabase.from("users").select("*").eq("id", id).single(),
        supabase
          .from("attendance")
          .select("date, is_late, clock_in")
          .eq("user_id", id)
          .gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0])
          .order("date", { ascending: true }),
        supabase
          .from("leave_requests")
          .select("id, start_date, end_date, reason, status")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("campaigns").select("id, name").eq("status", "active"),
      ]);

      if (empRes.data) {
        const empData = empRes.data as any;
        setEmp(empData);
        setEditSalary(String(empData.basic_salary || ""));
        setEditShiftStart(empData.shift_start || "");
        setEditShiftEnd(empData.shift_end || "");
      }
      setAttendance(attRes.data || []);
      setLeaves((leaveRes.data || []) as LeaveReq[]);
      setCampaigns(campaignsRes.data || []);

      // Find current campaign assignment
      const isTL = empRes.data && ["Team Leader", "Assistant Team Leader"].includes((empRes.data as any).role);
      if (isTL) {
        const { data: ctData } = await supabase.from("campaign_tls").select("campaign_id").eq("tl_id", id).limit(1).single();
        if (ctData) {
          setCurrentCampaignId(ctData.campaign_id);
          setEditCampaignId(ctData.campaign_id);
        }
      } else {
        const { data: carData } = await supabase.from("campaign_agent_roles").select("campaign_id").eq("agent_id", id).limit(1).single();
        if (carData) {
          setCurrentCampaignId(carData.campaign_id);
          setEditCampaignId(carData.campaign_id);
        }
      }

      setLoading(false);
    };
    fetchAll();
  }, [id]);

  const handleSave = async () => {
    if (!emp || !user) return;
    const updates: Record<string, unknown> = {};
    let changes: string[] = [];

    if (editSalary && Number(editSalary) !== emp.basic_salary) {
      updates.basic_salary = Number(editSalary);
      changes.push(`salary: ${emp.basic_salary} → ${editSalary}`);
    }
    if (editShiftStart && editShiftStart !== emp.shift_start) {
      updates.shift_start = editShiftStart;
      changes.push(`shift_start: ${emp.shift_start} → ${editShiftStart}`);
    }
    if (editShiftEnd && editShiftEnd !== emp.shift_end) {
      updates.shift_end = editShiftEnd;
      changes.push(`shift_end: ${emp.shift_end} → ${editShiftEnd}`);
    }

    // Handle campaign change
    if (editCampaignId !== currentCampaignId) {
      const isTL = ["Team Leader", "Assistant Team Leader"].includes(emp.role);
      if (isTL) {
        // Remove old
        if (currentCampaignId) {
          await supabase.from("campaign_tls").delete().eq("tl_id", emp.id).eq("campaign_id", currentCampaignId);
        }
        // Add new
        if (editCampaignId) {
          await supabase.from("campaign_tls").insert({ campaign_id: editCampaignId, tl_id: emp.id });
        }
      } else {
        // Remove old
        if (currentCampaignId) {
          await supabase.from("campaign_agent_roles").delete().eq("agent_id", emp.id).eq("campaign_id", currentCampaignId);
        }
        // Add new
        if (editCampaignId) {
          const { data: campaignTl } = await supabase
            .from("campaign_tls")
            .select("tl_id")
            .eq("campaign_id", editCampaignId)
            .limit(1)
            .single();
          if (campaignTl) {
            await supabase.from("campaign_agent_roles").insert({
              campaign_id: editCampaignId,
              agent_id: emp.id,
              tl_id: campaignTl.tl_id,
              is_bronze: true,
              is_silver: false,
            });
          }
        }
      }
      changes.push(`campaign: ${currentCampaignId || 'none'} → ${editCampaignId || 'none'}`);
      setCurrentCampaignId(editCampaignId);
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("users").update(updates as any).eq("id", emp.id);
    }

    if (changes.length === 0) return;

    // Audit log
    await supabase.from("audit_logs").insert({
      action: `employee_updated: ${changes.join(", ")}`,
      actor_id: user.id,
      actor_role: user.role,
      target_id: emp.id,
      target_table: "users",
      details: { changes, old: { basic_salary: emp.basic_salary, shift_start: emp.shift_start, shift_end: emp.shift_end } },
    } as any);

    toast({ title: isBn ? "আপডেট সফল ✓" : "Updated ✓" });
    // Refresh
    const { data } = await supabase.from("users").select("*").eq("id", emp.id).single();
    if (data) setEmp(data as any);
  };

  // Build calendar for current month
  const buildCalendar = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const attMap: Record<string, AttendanceDay> = {};
    attendance.forEach((a) => { attMap[a.date] = a; });

    const leaveSet = new Set<string>();
    leaves.filter((l) => l.status === "approved").forEach((l) => {
      let d = new Date(l.start_date);
      const end = new Date(l.end_date);
      while (d <= end) {
        leaveSet.add(d.toISOString().split("T")[0]);
        d.setDate(d.getDate() + 1);
      }
    });

    const cells: { day: number; color: string; label: string }[] = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: 0, color: "transparent", label: "" });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const today = new Date().toISOString().split("T")[0];

      if (leaveSet.has(dateStr)) {
        cells.push({ day: d, color: "#3B82F6", label: isBn ? "ছুটি" : "Leave" });
      } else if (attMap[dateStr]) {
        const att = attMap[dateStr];
        if (att.is_late) {
          cells.push({ day: d, color: "#F59E0B", label: isBn ? "দেরি" : "Late" });
        } else {
          cells.push({ day: d, color: "#22C55E", label: isBn ? "উপস্থিত" : "Present" });
        }
      } else if (dateStr <= today) {
        cells.push({ day: d, color: "#EF4444", label: isBn ? "অনুপস্থিত" : "Absent" });
      } else {
        cells.push({ day: d, color: "hsl(var(--secondary))", label: "" });
      }
    }

    return cells;
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">{isBn ? "লোড হচ্ছে..." : "Loading..."}</div>;
  }

  if (!emp) {
    return <div className="p-8 text-center text-muted-foreground">{isBn ? "কর্মচারী পাওয়া যায়নি" : "Employee not found"}</div>;
  }

  const calendar = buildCalendar();
  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">{emp.name}</h2>
          <p className="font-body text-sm text-muted-foreground">{emp.role} • {emp.email}</p>
        </div>
        <button onClick={() => navigate("/hr/employees")} className="text-xs px-3 py-1.5 border border-border text-foreground hover:bg-secondary">
          {isBn ? "← তালিকা" : "← Back"}
        </button>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-border">
        {[
          { label: isBn ? "প্যানেল" : "Panel", value: emp.panel.toUpperCase() },
          { label: isBn ? "স্ট্যাটাস" : "Status", value: emp.is_active ? (isBn ? "সক্রিয়" : "Active") : (isBn ? "নিষ্ক্রিয়" : "Inactive") },
          { label: isBn ? "যোগদান" : "Joined", value: new Date(emp.created_at).toLocaleDateString() },
          { label: isBn ? "ফোন" : "Phone", value: emp.phone || "—" },
          { label: isBn ? "পিতার নাম" : "Father", value: emp.father_name || "—" },
          { label: isBn ? "পিতার ফোন" : "Father Phone", value: emp.father_phone || "—" },
          { label: isBn ? "মাতার নাম" : "Mother", value: emp.mother_name || "—" },
          { label: isBn ? "অভিভাবক" : "Guardian", value: emp.guardian_type || "—" },
        ].map((item) => (
          <div key={item.label} className="bg-background p-3">
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
            <p className="text-sm text-foreground font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Editable Fields */}
      <div className="border border-border p-4 space-y-3">
        <h3 className="font-heading text-sm font-bold text-foreground">
          {isBn ? "সম্পাদনাযোগ্য তথ্য" : "Editable Details"}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "মাসিক বেতন (BDT)" : "Monthly Salary (BDT)"}
            </label>
            <Input type="number" value={editSalary} onChange={(e) => setEditSalary(e.target.value)} className="bg-background border-border text-foreground" />
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "শিফট শুরু" : "Shift Start"}
            </label>
            <Input type="time" value={editShiftStart} onChange={(e) => setEditShiftStart(e.target.value)} className="bg-background border-border text-foreground" />
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "শিফট শেষ" : "Shift End"}
            </label>
            <Input type="time" value={editShiftEnd} onChange={(e) => setEditShiftEnd(e.target.value)} className="bg-background border-border text-foreground" />
          </div>
        </div>
        <div>
          <label className="font-body text-xs text-muted-foreground block mb-1">
            {isBn ? "ক্যাম্পেইন" : "Campaign"}
          </label>
          <Select value={editCampaignId} onValueChange={setEditCampaignId}>
            <SelectTrigger className="bg-background border-border text-foreground w-full sm:w-64">
              <SelectValue placeholder={isBn ? "ক্যাম্পেইন নির্বাচন করুন" : "Select campaign"} />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border max-h-60">
              <SelectItem value="none">{isBn ? "কোনো ক্যাম্পেইন নেই" : "No campaign"}</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button onClick={handleSave} className="px-4 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: BLUE }}>
          {isBn ? "সংরক্ষণ করুন" : "Save Changes"}
        </button>
      </div>

      {/* Attendance Calendar */}
      <div className="border border-border p-4">
        <h3 className="font-heading text-sm font-bold text-foreground mb-3">
          {isBn ? "এই মাসের উপস্থিতি" : "This Month's Attendance"}
        </h3>
        <div className="flex gap-3 mb-3 flex-wrap">
          {[
            { color: "#22C55E", label: isBn ? "সময়মতো" : "On Time" },
            { color: "#F59E0B", label: isBn ? "দেরি" : "Late" },
            { color: "#EF4444", label: isBn ? "অনুপস্থিত" : "Absent" },
            { color: "#3B82F6", label: isBn ? "ছুটি" : "Leave" },
          ].map((l) => (
            <div key={l.color} className="flex items-center gap-1 text-xs text-foreground">
              <span className="w-3 h-3" style={{ backgroundColor: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-[10px] text-muted-foreground py-1">{d}</div>
          ))}
          {calendar.map((cell, i) => (
            <div
              key={i}
              className="aspect-square flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: cell.color, color: cell.day ? "#fff" : "transparent" }}
              title={cell.label}
            >
              {cell.day || ""}
            </div>
          ))}
        </div>
      </div>

      {/* Leave History */}
      <div className="border border-border p-4">
        <h3 className="font-heading text-sm font-bold text-foreground mb-3">
          {isBn ? "ছুটির ইতিহাস" : "Leave History"}
        </h3>
        {leaves.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {isBn ? "কোনো ছুটির রেকর্ড নেই" : "No leave records"}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {leaves.map((l) => (
              <div key={l.id} className="py-2 flex items-center justify-between text-xs">
                <div className="text-foreground">
                  {l.start_date} → {l.end_date}
                  {l.reason && <span className="text-muted-foreground ml-2">({l.reason})</span>}
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold text-white ${
                  l.status === "approved" ? "bg-green-600" : l.status === "rejected" ? "bg-red-600" : "bg-yellow-600"
                }`}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HREmployeeProfile;
