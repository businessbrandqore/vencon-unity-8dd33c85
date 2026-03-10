import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface Activity {
  id: string;
  action: string;
  actor_name: string;
  created_at: string;
  details: Record<string, unknown> | null;
}

const HRRecentActivity = () => {
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("id, action, actor_id, created_at, details")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!logs || logs.length === 0) {
        setLoading(false);
        return;
      }

      const actorIds = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))];
      let actorMap: Record<string, string> = {};

      if (actorIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name")
          .in("id", actorIds as string[]);
        if (users) {
          actorMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
        }
      }

      setActivities(
        logs.map((l) => ({
          id: l.id,
          action: l.action,
          actor_name: l.actor_id ? actorMap[l.actor_id] || "Unknown" : "System",
          created_at: l.created_at || "",
          details: l.details as Record<string, unknown> | null,
        }))
      );
      setLoading(false);
    };
    fetch();
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isBn ? "এইমাত্র" : "Just now";
    if (mins < 60) return isBn ? `${mins} মিনিট আগে` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isBn ? `${hours} ঘণ্টা আগে` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return isBn ? `${days} দিন আগে` : `${days}d ago`;
  };

  return (
    <div className="bg-background border border-border p-4">
      <h3 className="font-heading text-sm font-bold text-foreground mb-3">
        {isBn ? "সাম্প্রতিক কার্যকলাপ" : "Recent Activity"}
      </h3>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-secondary animate-pulse" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="font-body text-xs text-muted-foreground text-center py-4">
          {isBn ? "কোনো কার্যকলাপ নেই" : "No recent activity"}
        </p>
      ) : (
        <div className="space-y-0 divide-y divide-border max-h-80 overflow-y-auto">
          {activities.map((a) => (
            <div key={a.id} className="py-2 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs text-foreground truncate">
                  <span className="font-bold">{a.actor_name}</span>{" "}
                  <span className="text-muted-foreground">— {a.action}</span>
                </p>
              </div>
              <span className="font-body text-[10px] text-muted-foreground whitespace-nowrap">
                {timeAgo(a.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HRRecentActivity;
