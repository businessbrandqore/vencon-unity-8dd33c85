import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import HRQuickActions from "@/components/hr/HRQuickActions";
import HRMoodChart from "@/components/hr/HRMoodChart";
import HRRecentActivity from "@/components/hr/HRRecentActivity";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCheck, Clock, CalendarOff } from "lucide-react";

const HRDashboard = () => {
  const { user } = useAuth();
  const { t, n } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [stats, setStats] = useState({ total: 0, active: 0, presentToday: 0, pendingLeaves: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [totalRes, activeRes, attendanceRes, leavesRes] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setStats({
        total: totalRes.count || 0,
        active: activeRes.count || 0,
        presentToday: attendanceRes.count || 0,
        pendingLeaves: leavesRes.count || 0,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  if (!user) return null;

  const statCards = [
    { icon: Users, label: isBn ? "মোট কর্মী" : "Total Employees", value: stats.total, color: "#1D4ED8", bg: "rgba(29, 78, 216, 0.15)" },
    { icon: UserCheck, label: isBn ? "সক্রিয় কর্মী" : "Active Employees", value: stats.active, color: "#22C55E", bg: "rgba(34, 197, 94, 0.15)" },
    { icon: Clock, label: isBn ? "আজ উপস্থিত" : "Present Today", value: stats.presentToday, color: "#EA580C", bg: "rgba(234, 88, 12, 0.15)" },
    { icon: CalendarOff, label: isBn ? "পেন্ডিং ছুটি" : "Pending Leaves", value: stats.pendingLeaves, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "এইচআর ড্যাশবোর্ড" : "HR Dashboard"}
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {isBn ? "কর্মী ও উপস্থিতি ব্যবস্থাপনা" : "Employee & attendance management"}
        </p>
      </div>

      {/* HR-specific Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: s.bg }}
                >
                  <Icon className="h-5 w-5" style={{ color: s.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-heading text-2xl font-bold mt-0.5" style={{ color: s.color }}>
                    {n(s.value)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <HRQuickActions />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HRMoodChart />
        <HRRecentActivity />
      </div>
    </div>
  );
};

export default HRDashboard;