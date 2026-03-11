import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Users, UserCheck, UserX, Clock } from "lucide-react";

interface OverviewData {
  total: number;
  active: number;
  inactive: number;
  onLeave: number;
  byPanel: { panel: string; count: number }[];
}

const SAEmployeeOverview = () => {
  const { t, n } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [allRes, activeRes, inactiveRes, leaveRes] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", false),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "approved"),
      ]);

      const { data: panelData } = await supabase.from("users").select("panel");
      const panelMap = new Map<string, number>();
      panelData?.forEach((u) => {
        panelMap.set(u.panel, (panelMap.get(u.panel) || 0) + 1);
      });

      setData({
        total: allRes.count || 0,
        active: activeRes.count || 0,
        inactive: inactiveRes.count || 0,
        onLeave: leaveRes.count || 0,
        byPanel: Array.from(panelMap.entries()).map(([panel, count]) => ({ panel, count })),
      });
      setLoading(false);
    };
    fetch();
  }, []);

  const panelLabels: Record<string, { bn: string; en: string }> = {
    sa: { bn: "সুপার অ্যাডমিন", en: "Super Admin" },
    hr: { bn: "এইচআর", en: "HR" },
    tl: { bn: "টিম লিডার", en: "Team Leader" },
    employee: { bn: "এমপ্লয়ী", en: "Employee" },
  };

  const panelColors: Record<string, string> = {
    sa: "#0D9488",
    hr: "#1D4ED8",
    tl: "#7C3AED",
    employee: "#EA580C",
  };

  if (loading) {
    return <div className="bg-card border border-border rounded-xl p-6 h-48 animate-pulse" />;
  }

  if (!data) return null;

  const miniStats = [
    { icon: Users, label: isBn ? "মোট কর্মী" : "Total", value: data.total, color: "#EA580C" },
    { icon: UserCheck, label: isBn ? "সক্রিয়" : "Active", value: data.active, color: "#22C55E" },
    { icon: UserX, label: isBn ? "নিষ্ক্রিয়" : "Inactive", value: data.inactive, color: "#EF4444" },
    { icon: Clock, label: isBn ? "ছুটিতে" : "On Leave", value: data.onLeave, color: "#F59E0B" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <h3 className="font-heading text-sm font-bold text-foreground">
        {isBn ? "কর্মী সারসংক্ষেপ" : "Employee Overview"}
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {miniStats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-secondary/30 rounded-lg p-3 flex items-center gap-3">
              <Icon className="h-4 w-4 flex-shrink-0" style={{ color: s.color }} />
              <div>
                <p className="font-heading text-lg font-bold text-foreground">{n(s.value)}</p>
                <p className="font-body text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Panel breakdown bar */}
      <div className="space-y-2">
        <p className="font-body text-xs text-muted-foreground">
          {isBn ? "প্যানেল অনুযায়ী" : "By Panel"}
        </p>
        <div className="flex h-3 rounded-full overflow-hidden bg-secondary/50">
          {data.byPanel.map((p) => (
            <div
              key={p.panel}
              className="h-full transition-all"
              style={{
                width: `${data.total > 0 ? (p.count / data.total) * 100 : 0}%`,
                backgroundColor: panelColors[p.panel] || "#888",
              }}
              title={`${panelLabels[p.panel]?.[isBn ? "bn" : "en"] || p.panel}: ${p.count}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {data.byPanel.map((p) => (
            <div key={p.panel} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: panelColors[p.panel] || "#888" }} />
              <span className="font-body text-[10px] text-muted-foreground">
                {panelLabels[p.panel]?.[isBn ? "bn" : "en"] || p.panel} ({n(p.count)})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SAEmployeeOverview;
