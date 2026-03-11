import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Server, Database, Wifi, AlertTriangle } from "lucide-react";

interface HealthItem {
  label: string;
  status: "ok" | "warning" | "error";
  detail: string;
  icon: React.ElementType;
}

const SASystemHealth = () => {
  const { t, n } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const [items, setItems] = useState<HealthItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const results: HealthItem[] = [];

      // Check DB connectivity
      const dbStart = Date.now();
      const { error: dbErr } = await supabase.from("users").select("id", { count: "exact", head: true });
      const dbTime = Date.now() - dbStart;
      results.push({
        label: isBn ? "ডাটাবেজ" : "Database",
        status: dbErr ? "error" : dbTime > 2000 ? "warning" : "ok",
        detail: dbErr ? (isBn ? "সংযোগ ব্যর্থ" : "Connection failed") : `${dbTime}ms`,
        icon: Database,
      });

      // Check pending approvals (warning if > 5)
      const { count: pendingCount } = await supabase
        .from("sa_approvals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      results.push({
        label: isBn ? "পেন্ডিং অনুমোদন" : "Pending Approvals",
        status: (pendingCount || 0) > 5 ? "warning" : "ok",
        detail: `${pendingCount || 0}`,
        icon: AlertTriangle,
      });

      // Check low stock items
      const { data: inventory } = await supabase.from("inventory").select("product_name, stock_in, dispatched, low_stock_threshold");
      const lowStockCount = inventory?.filter((i) => {
        const available = (i.stock_in || 0) - (i.dispatched || 0);
        return available <= (i.low_stock_threshold || 10);
      }).length || 0;
      results.push({
        label: isBn ? "লো স্টক আইটেম" : "Low Stock Items",
        status: lowStockCount > 0 ? "warning" : "ok",
        detail: `${lowStockCount}`,
        icon: Server,
      });

      // Active campaigns
      const { count: activeCampaigns } = await supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      results.push({
        label: isBn ? "সক্রিয় ক্যাম্পেইন" : "Active Campaigns",
        status: "ok",
        detail: `${activeCampaigns || 0}`,
        icon: Wifi,
      });

      setItems(results);
      setLoading(false);
    };
    check();
  }, []);

  const statusColors = {
    ok: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
  };

  if (loading) {
    return <div className="bg-card border border-border rounded-xl p-6 h-48 animate-pulse" />;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="font-heading text-sm font-bold text-foreground mb-4">
        {isBn ? "সিস্টেম স্ট্যাটাস" : "System Status"}
      </h3>
      <div className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: statusColors[item.status] }}
              />
              <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-body text-xs text-foreground flex-1">{item.label}</span>
              <span
                className="font-heading text-xs font-medium"
                style={{ color: statusColors[item.status] }}
              >
                {item.detail}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SASystemHealth;
