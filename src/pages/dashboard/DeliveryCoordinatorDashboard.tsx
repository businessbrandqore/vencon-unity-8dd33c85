import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Truck, Clock, CheckCircle, RotateCcw, Package } from "lucide-react";

export default function DeliveryCoordinatorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, pending: 0, delivered: 0, returned: 0 });
  const [overtime, setOvertime] = useState({ hours: 0, minutes: 0, active: false });
  const [profile, setProfile] = useState<{ shift_end: string | null }>({ shift_end: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("users").select("shift_end").eq("id", user.id).single();
      if (data) setProfile(data);
    })();
  }, [user]);

  const loadStats = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("delivery_status")
      .in("status", ["dispatched", "send_today"]);
    if (data) {
      const total = data.length;
      const pending = data.filter(o => !o.delivery_status || o.delivery_status === "pending" || o.delivery_status === "in_transit").length;
      const delivered = data.filter(o => o.delivery_status === "delivered").length;
      const returned = data.filter(o => o.delivery_status === "returned").length;
      setStats({ total, pending, delivered, returned });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Overtime tracker
  useEffect(() => {
    if (!profile?.shift_end) return;
    const calc = () => {
      const now = new Date();
      const parts = profile.shift_end!.split(":");
      const shiftEnd = new Date();
      shiftEnd.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
      if (now > shiftEnd) {
        const diff = Math.floor((now.getTime() - shiftEnd.getTime()) / 60000);
        setOvertime({ hours: Math.floor(diff / 60), minutes: diff % 60, active: true });
      } else {
        setOvertime({ hours: 0, minutes: 0, active: false });
      }
    };
    calc();
    const iv = setInterval(calc, 60000);
    return () => clearInterval(iv);
  }, [profile]);

  if (loading) return <LoadingSpinner text="লোড হচ্ছে..." />;

  const summaryCards = [
    { label: "মোট অর্ডার", value: stats.total, icon: Package, color: "text-foreground" },
    { label: "পাথে আছে", value: stats.pending, icon: Truck, color: "text-yellow-400" },
    { label: "ডেলিভার্ড", value: stats.delivered, icon: CheckCircle, color: "text-green-400" },
    { label: "রিটার্ন", value: stats.returned, icon: RotateCcw, color: "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl flex items-center gap-2">
        <Truck className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
        ড্যাশবোর্ড
      </h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryCards.map(c => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="pt-5 pb-4 flex items-center gap-3">
                <Icon className={cn("h-7 w-7 shrink-0", c.color)} />
                <div>
                  <p className="text-2xl font-heading leading-none">{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Overtime */}
      <Card className={cn(overtime.active && "border-orange-500/50")}>
        <CardContent className="pt-5 pb-4 flex items-center gap-3">
          <Clock className={cn("h-7 w-7", overtime.active ? "text-orange-400" : "text-muted-foreground")} />
          <div>
            <p className="text-xs text-muted-foreground">আজকের Overtime</p>
            <p className="text-xl font-heading">
              {overtime.active ? `${overtime.hours} ঘণ্টা ${overtime.minutes} মিনিট` : "নেই"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
