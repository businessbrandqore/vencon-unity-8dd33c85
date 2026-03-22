import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useState, useEffect } from "react";
import SalaryCard from "@/components/SalaryCard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Package, AlertTriangle, CheckCircle, Clock, Send, ArrowRight } from "lucide-react";

export default function WarehouseAssistantDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, dispatched: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, steadfast_send_failed")
        .in("status", ["send_today", "dispatched"]);

      const orders = data || [];
      setStats({
        pending: orders.filter((o) => o.status === "send_today" && !o.steadfast_send_failed).length,
        dispatched: orders.filter((o) => o.status === "dispatched").length,
        failed: orders.filter((o) => o.steadfast_send_failed).length,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner text="লোড হচ্ছে..." />;

  return (
    <div className="space-y-6">
      <SalaryCard />

      <h1 className="font-heading text-xl flex items-center gap-2">
        <Package className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
        Warehouse Assistant Dashboard
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-xs text-muted-foreground">Pending Dispatch</p>
              <p className="text-2xl font-heading">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Dispatched</p>
              <p className="text-2xl font-heading">{stats.dispatched}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-2xl font-heading">{stats.failed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="cursor-pointer hover:border-[hsl(var(--panel-employee)/0.5)] transition-colors" onClick={() => navigate("/employee/dispatch")}>
        <CardContent className="pt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Send className="h-6 w-6 text-[hsl(var(--panel-employee))]" />
            <div>
              <p className="font-heading font-bold">অর্ডার ডিসপ্যাচ</p>
              <p className="text-xs text-muted-foreground">Send Today অর্ডার দেখুন, SteadFast-এ পাঠান, ইনভয়েস প্রিন্ট করুন</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}
