import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import WarningLights from "@/components/profile/WarningLights";
import { ArrowLeft, User, Phone, Mail, Calendar, Clock, Briefcase, MapPin, CreditCard, ShieldCheck } from "lucide-react";

interface EmpFull {
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
  father_name: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  guardian_type: string | null;
  off_days: string[] | null;
  gps_location: string | null;
  date_of_birth: string | null;
  department: string | null;
  designation: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
}

interface OrderRow {
  id: string;
  customer_name: string | null;
  product: string | null;
  price: number | null;
  status: string | null;
  delivery_status: string | null;
  created_at: string | null;
}

interface AttendanceRow {
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  is_late: boolean | null;
  is_early_out: boolean | null;
  deduction_amount: number | null;
}

interface LeaveRow {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string | null;
}

interface ComplaintRow {
  id: string;
  reason: string;
  status: string;
  created_at: string;
}

const SAEmployeeProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const panel = location.pathname.startsWith("/hr") ? "hr" : "sa";
  const backPath = panel === "hr" ? "/hr/employees" : "/sa/employees";
  const isBn = t("vencon") === "VENCON";

  const [emp, setEmp] = useState<EmpFull | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [salaryData, setSalaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      const [empRes, ordersRes, attRes, leavesRes, complaintsRes] = await Promise.all([
        supabase.from("users").select("*").eq("id", id).single(),
        supabase.from("orders").select("id, customer_name, product, price, status, delivery_status, created_at")
          .eq("agent_id", id).order("created_at", { ascending: false }).limit(50),
        supabase.from("attendance").select("date, clock_in, clock_out, is_late, is_early_out, deduction_amount")
          .eq("user_id", id).gte("date", monthStart).order("date", { ascending: true }),
        supabase.from("leave_requests").select("id, start_date, end_date, reason, status")
          .eq("user_id", id).order("created_at", { ascending: false }).limit(20),
        supabase.from("employee_complaints").select("id, reason, status, created_at")
          .eq("target_id", id).order("created_at", { ascending: false }).limit(10),
      ]);

      if (empRes.data) setEmp(empRes.data as any);
      setOrders((ordersRes.data || []) as OrderRow[]);
      setAttendance((attRes.data || []) as AttendanceRow[]);
      setLeaves((leavesRes.data || []) as LeaveRow[]);
      setComplaints((complaintsRes.data || []) as ComplaintRow[]);

      // Campaign
      if (empRes.data) {
        const role = (empRes.data as any).role;
        const isTL = ["Team Leader", "Assistant Team Leader", "team_leader", "assistant_team_leader"].includes(role);
        if (isTL) {
          const { data: ct } = await supabase.from("campaign_tls").select("campaign_id").eq("tl_id", id).limit(1).single();
          if (ct) {
            const { data: camp } = await supabase.from("campaigns").select("name").eq("id", ct.campaign_id).single();
            if (camp) setCampaignName(camp.name);
          }
        } else {
          const { data: car } = await supabase.from("campaign_agent_roles").select("campaign_id").eq("agent_id", id).limit(1).single();
          if (car) {
            const { data: camp } = await supabase.from("campaigns").select("name").eq("id", car.campaign_id).single();
            if (camp) setCampaignName(camp.name);
          }
        }
      }

      // Salary
      const { data: salRes } = await supabase.rpc("calculate_salary", {
        _user_id: id,
        _year: now.getFullYear(),
        _month: now.getMonth() + 1,
      });
      if (salRes) setSalaryData(salRes);

      setLoading(false);
    };
    fetchAll();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">{isBn ? "লোড হচ্ছে..." : "Loading..."}</div>;
  if (!emp) return <div className="p-8 text-center text-muted-foreground">{isBn ? "কর্মচারী পাওয়া যায়নি" : "Employee not found"}</div>;

  const InfoItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm text-foreground font-semibold">{value || "—"}</p>
      </div>
    </div>
  );

  const statusColor = (s: string | null) => {
    if (!s) return "bg-muted text-muted-foreground";
    if (["delivered", "approved", "confirmed"].includes(s)) return "bg-green-600 text-white";
    if (["rejected", "cancelled", "returned"].includes(s)) return "bg-red-600 text-white";
    return "bg-yellow-600 text-white";
  };

  // Attendance calendar
  const buildCalendar = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const attMap: Record<string, AttendanceRow> = {};
    attendance.forEach(a => { attMap[a.date] = a; });
    const leaveSet = new Set<string>();
    leaves.filter(l => l.status === "approved").forEach(l => {
      let d = new Date(l.start_date);
      const end = new Date(l.end_date);
      while (d <= end) {
        leaveSet.add(d.toISOString().split("T")[0]);
        d.setDate(d.getDate() + 1);
      }
    });
    const cells: { day: number; color: string; label: string }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: 0, color: "transparent", label: "" });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const today = new Date().toISOString().split("T")[0];
      if (leaveSet.has(dateStr)) {
        cells.push({ day: d, color: "#3B82F6", label: isBn ? "ছুটি" : "Leave" });
      } else if (attMap[dateStr]) {
        cells.push({ day: d, color: attMap[dateStr].is_late ? "#F59E0B" : "#22C55E", label: attMap[dateStr].is_late ? (isBn ? "দেরি" : "Late") : (isBn ? "উপস্থিত" : "Present") });
      } else if (dateStr <= today) {
        cells.push({ day: d, color: "#EF4444", label: isBn ? "অনুপস্থিত" : "Absent" });
      } else {
        cells.push({ day: d, color: "hsl(var(--secondary))", label: "" });
      }
    }
    return cells;
  };

  const calendar = buildCalendar();
  const dayHeaders = isBn ? ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            {emp.avatar_url ? (
              <img src={emp.avatar_url} className="w-12 h-12 rounded-full object-cover" alt="" />
            ) : (
              <User className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-2xl font-bold text-foreground">{emp.name}</h2>
              <WarningLights targetUserId={emp.id} canView={true} />
            </div>
            <p className="font-body text-sm text-muted-foreground">{emp.role} • {emp.panel.toUpperCase()}</p>
          </div>
          <span className={`ml-2 px-2 py-0.5 text-[10px] font-bold text-white ${emp.is_active ? "bg-green-600" : "bg-red-600"}`}>
            {emp.is_active ? (isBn ? "সক্রিয়" : "Active") : (isBn ? "নিষ্ক্রিয়" : "Inactive")}
          </span>
        </div>
        <button onClick={() => navigate("/sa/employees")} className="text-xs px-3 py-1.5 border border-border text-foreground hover:bg-secondary flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> {isBn ? "তালিকা" : "Back"}
        </button>
      </div>

      {/* Personal Info Grid */}
      <div className="border border-border p-4">
        <h3 className="font-heading text-sm font-bold text-foreground mb-3">{isBn ? "ব্যক্তিগত তথ্য" : "Personal Information"}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <InfoItem icon={Mail} label={isBn ? "ইমেইল" : "Email"} value={emp.email} />
          <InfoItem icon={Phone} label={isBn ? "ফোন" : "Phone"} value={emp.phone || "—"} />
          <InfoItem icon={Calendar} label={isBn ? "জন্ম তারিখ" : "DOB"} value={emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString() : "—"} />
          <InfoItem icon={Calendar} label={isBn ? "যোগদান" : "Joined"} value={new Date(emp.created_at).toLocaleDateString()} />
          <InfoItem icon={User} label={isBn ? "পিতার নাম" : "Father"} value={emp.father_name || "—"} />
          <InfoItem icon={Phone} label={isBn ? "পিতার ফোন" : "Father Phone"} value={emp.father_phone || "—"} />
          <InfoItem icon={User} label={isBn ? "মাতার নাম" : "Mother"} value={emp.mother_name || "—"} />
          <InfoItem icon={Phone} label={isBn ? "মাতার ফোন" : "Mother Phone"} value={emp.mother_phone || "—"} />
          <InfoItem icon={ShieldCheck} label={isBn ? "অভিভাবক" : "Guardian"} value={emp.guardian_type || "—"} />
          <InfoItem icon={MapPin} label={isBn ? "GPS লোকেশন" : "GPS"} value={emp.gps_location || "—"} />
          <InfoItem icon={Briefcase} label={isBn ? "ক্যাম্পেইন" : "Campaign"} value={campaignName || "—"} />
          <InfoItem icon={Clock} label={isBn ? "ভাষা" : "Language"} value={emp.preferred_language || "—"} />
        </div>
      </div>

      {/* Work Info */}
      <div className="border border-border p-4">
        <h3 className="font-heading text-sm font-bold text-foreground mb-3">{isBn ? "কর্মসংক্রান্ত তথ্য" : "Work Details"}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <InfoItem icon={CreditCard} label={isBn ? "মাসিক বেতন" : "Basic Salary"} value={`৳${(emp.basic_salary || 0).toLocaleString()}`} />
          <InfoItem icon={Clock} label={isBn ? "শিফট শুরু" : "Shift Start"} value={emp.shift_start || "—"} />
          <InfoItem icon={Clock} label={isBn ? "শিফট শেষ" : "Shift End"} value={emp.shift_end || "—"} />
          <InfoItem icon={Calendar} label={isBn ? "সাপ্তাহিক ছুটি" : "Off Days"} value={(emp.off_days || []).join(", ") || "—"} />
        </div>
      </div>

      {/* Salary Summary */}
      {salaryData && !salaryData.error && (
        <div className="border border-border p-4">
          <h3 className="font-heading text-sm font-bold text-foreground mb-3">
            {isBn ? "এই মাসের বেতন সারাংশ" : "This Month's Salary"}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: isBn ? "বেসিক" : "Basic", value: `৳${Number(salaryData.basic_salary || 0).toLocaleString()}` },
              { label: isBn ? "ইনসেনটিভ" : "Incentive", value: `৳${Number(salaryData.incentive || 0).toLocaleString()}` },
              { label: isBn ? "কর্তন" : "Deductions", value: `৳${Number(salaryData.total_deductions || 0).toLocaleString()}` },
              { label: isBn ? "রিসিভ রেশিও" : "Receive Ratio", value: `${salaryData.receive_ratio || 0}%` },
              { label: isBn ? "নেট বেতন" : "Net Salary", value: `৳${Number(salaryData.net_salary || 0).toLocaleString()}` },
            ].map((s) => (
              <div key={s.label} className="bg-muted/30 p-3 rounded-lg">
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-sm font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
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
              className="aspect-square flex items-center justify-center text-xs font-bold rounded-sm"
              style={{ backgroundColor: cell.color, color: cell.day ? "#fff" : "transparent" }}
              title={cell.label}
            >
              {cell.day || ""}
            </div>
          ))}
        </div>
      </div>

      {/* Orders */}
      <div className="border border-border p-4">
        <h3 className="font-heading text-sm font-bold text-foreground mb-3">
          {isBn ? `সাম্প্রতিক অর্ডার (${orders.length})` : `Recent Orders (${orders.length})`}
        </h3>
        {orders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{isBn ? "কোনো অর্ডার নেই" : "No orders"}</p>
        ) : (
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">{isBn ? "কাস্টমার" : "Customer"}</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">{isBn ? "প্রোডাক্ট" : "Product"}</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">{isBn ? "মূল্য" : "Price"}</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">{isBn ? "ডেলিভারি" : "Delivery"}</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">{isBn ? "তারিখ" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50">
                    <td className="p-2 text-foreground">{o.customer_name || "—"}</td>
                    <td className="p-2 text-foreground">{o.product || "—"}</td>
                    <td className="p-2 text-foreground font-mono">৳{(o.price || 0).toLocaleString()}</td>
                    <td className="p-2"><span className={`px-1.5 py-0.5 text-[10px] font-bold ${statusColor(o.status)}`}>{o.status}</span></td>
                    <td className="p-2"><span className={`px-1.5 py-0.5 text-[10px] font-bold ${statusColor(o.delivery_status)}`}>{o.delivery_status || "—"}</span></td>
                    <td className="p-2 text-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leave History */}
      <div className="border border-border p-4">
        <h3 className="font-heading text-sm font-bold text-foreground mb-3">
          {isBn ? "ছুটির ইতিহাস" : "Leave History"}
        </h3>
        {leaves.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{isBn ? "কোনো রেকর্ড নেই" : "No records"}</p>
        ) : (
          <div className="divide-y divide-border">
            {leaves.map((l) => (
              <div key={l.id} className="py-2 flex items-center justify-between text-xs">
                <div className="text-foreground">
                  {l.start_date} → {l.end_date}
                  {l.reason && <span className="text-muted-foreground ml-2">({l.reason})</span>}
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold ${statusColor(l.status)}`}>{l.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complaints */}
      {complaints.length > 0 && (
        <div className="border border-border p-4">
          <h3 className="font-heading text-sm font-bold text-foreground mb-3">
            {isBn ? "অভিযোগ" : "Complaints Against"}
          </h3>
          <div className="divide-y divide-border">
            {complaints.map((c) => (
              <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                <div className="text-foreground">{c.reason}</div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold ${statusColor(c.status)}`}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SAEmployeeProfile;
