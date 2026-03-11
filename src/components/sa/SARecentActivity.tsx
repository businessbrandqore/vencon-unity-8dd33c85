import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Activity, ShieldCheck, UserPlus, Package, FileText } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  actor_role: string | null;
  target_table: string | null;
  created_at: string | null;
  actor_name?: string;
}

const actionIcons: Record<string, React.ElementType> = {
  approval_approved: ShieldCheck,
  approval_rejected: ShieldCheck,
  employee_hired: UserPlus,
  order_dispatched: Package,
};

const SARecentActivity = () => {
  const { t, d } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, actor_id, actor_role, target_table, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        const actorIds = [...new Set(data.map((e) => e.actor_id).filter(Boolean))];
        const { data: users } = await supabase
          .from("users")
          .select("id, name")
          .in("id", actorIds as string[]);
        const nameMap = new Map(users?.map((u) => [u.id, u.name]) || []);

        setEntries(
          data.map((e) => ({
            ...e,
            actor_name: e.actor_id ? nameMap.get(e.actor_id) || "Unknown" : "System",
          }))
        );
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const actionLabels: Record<string, { bn: string; en: string }> = {
    approval_approved: { bn: "অনুমোদিত", en: "Approved" },
    approval_rejected: { bn: "প্রত্যাখ্যাত", en: "Rejected" },
    employee_hired: { bn: "কর্মী নিয়োগ", en: "Employee Hired" },
    order_dispatched: { bn: "অর্ডার ডিসপ্যাচ", en: "Order Dispatched" },
    lead_assigned: { bn: "লিড assign", en: "Lead Assigned" },
    salary_config_changed: { bn: "বেতন কনফিগ পরিবর্তন", en: "Salary Config Changed" },
  };

  if (loading) {
    return <div className="bg-card border border-border rounded-xl p-6 h-64 animate-pulse" />;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-sm font-bold text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          {isBn ? "সাম্প্রতিক কার্যক্রম" : "Recent Activity"}
        </h3>
        <span className="font-body text-[10px] text-muted-foreground">
          {isBn ? "সর্বশেষ ১০টি" : "Last 10"}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground text-center py-8">
          {isBn ? "কোনো কার্যক্রম নেই" : "No recent activity"}
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => {
            const Icon = actionIcons[entry.action] || FileText;
            const label = actionLabels[entry.action]?.[isBn ? "bn" : "en"] || entry.action;
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs text-foreground truncate">
                    <span className="font-medium">{entry.actor_name}</span>
                    {" — "}
                    <span className="text-muted-foreground">{label}</span>
                  </p>
                </div>
                <span className="font-body text-[10px] text-muted-foreground whitespace-nowrap">
                  {entry.created_at ? d(new Date(entry.created_at)) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SARecentActivity;
