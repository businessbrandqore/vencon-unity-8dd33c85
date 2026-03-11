import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

const SARevenueSummary = () => {
  const { t, n } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const [data, setData] = useState<{
    thisMonth: number;
    lastMonth: number;
    totalOrders: number;
    avgOrderValue: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      const [thisMonthRes, lastMonthRes] = await Promise.all([
        supabase.from("orders").select("price").gte("created_at", thisMonthStart).eq("delivery_status", "delivered"),
        supabase.from("orders").select("price").gte("created_at", lastMonthStart).lte("created_at", lastMonthEnd).eq("delivery_status", "delivered"),
      ]);

      const thisTotal = thisMonthRes.data?.reduce((sum, o) => sum + (o.price || 0), 0) || 0;
      const lastTotal = lastMonthRes.data?.reduce((sum, o) => sum + (o.price || 0), 0) || 0;
      const orderCount = thisMonthRes.data?.length || 0;

      setData({
        thisMonth: thisTotal,
        lastMonth: lastTotal,
        totalOrders: orderCount,
        avgOrderValue: orderCount > 0 ? Math.round(thisTotal / orderCount) : 0,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return <div className="bg-card border border-border rounded-xl p-6 h-48 animate-pulse" />;
  }

  if (!data) return null;

  const growth = data.lastMonth > 0
    ? Math.round(((data.thisMonth - data.lastMonth) / data.lastMonth) * 100)
    : data.thisMonth > 0 ? 100 : 0;
  const isUp = growth >= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <h3 className="font-heading text-sm font-bold text-foreground flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-primary" />
        {isBn ? "রেভিনিউ সারসংক্ষেপ" : "Revenue Summary"}
      </h3>

      <div className="text-center py-2">
        <p className="font-body text-xs text-muted-foreground mb-1">
          {isBn ? "এই মাসের ডেলিভারি রেভিনিউ" : "This Month Delivered Revenue"}
        </p>
        <p className="font-heading text-3xl font-bold text-foreground">
          ৳{n(data.thisMonth)}
        </p>
        <div className="flex items-center justify-center gap-1 mt-2">
          {isUp ? (
            <TrendingUp className="h-3.5 w-3.5" style={{ color: "#22C55E" }} />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" style={{ color: "#EF4444" }} />
          )}
          <span
            className="font-heading text-xs font-medium"
            style={{ color: isUp ? "#22C55E" : "#EF4444" }}
          >
            {isUp ? "+" : ""}{growth}%
          </span>
          <span className="font-body text-[10px] text-muted-foreground ml-1">
            {isBn ? "গত মাসের তুলনায়" : "vs last month"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="text-center">
          <p className="font-heading text-lg font-bold text-foreground">{n(data.totalOrders)}</p>
          <p className="font-body text-[10px] text-muted-foreground">
            {isBn ? "ডেলিভারি সম্পন্ন" : "Delivered Orders"}
          </p>
        </div>
        <div className="text-center">
          <p className="font-heading text-lg font-bold text-foreground">৳{n(data.avgOrderValue)}</p>
          <p className="font-body text-[10px] text-muted-foreground">
            {isBn ? "গড় অর্ডার মূল্য" : "Avg Order Value"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SARevenueSummary;
