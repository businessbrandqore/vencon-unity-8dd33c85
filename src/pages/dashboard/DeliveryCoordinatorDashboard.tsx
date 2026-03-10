import { useState, useEffect, useCallback } from "react";
import SalaryCard from "@/components/SalaryCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Truck, Clock } from "lucide-react";

interface OrderRow {
  id: string;
  customer_name: string | null;
  address: string | null;
  product: string | null;
  steadfast_consignment_id: string | null;
  delivery_status: string | null;
  warehouse_sent_at: string | null;
}

interface UserProfile {
  basic_salary: number | null;
  shift_end: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 border-yellow-500/50",
  in_transit: "text-yellow-400 border-yellow-500/50",
  delivered: "text-green-400 border-green-600/50",
  returned: "text-orange-400 border-orange-500/50",
  failed: "text-destructive border-destructive/50",
};

export default function DeliveryCoordinatorDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [overtime, setOvertime] = useState({ hours: 0, minutes: 0, active: false });
  const [deductions, setDeductions] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("users").select("basic_salary, shift_end").eq("id", user.id).single();
      if (data) setProfile(data as UserProfile);
    })();
  }, [user]);

  // Load orders
  const loadOrders = useCallback(async () => {
    const query = supabase
      .from("orders")
      .select("id, customer_name, address, product, steadfast_consignment_id, delivery_status, warehouse_sent_at")
      .eq("status", "dispatched")
      .order("warehouse_sent_at", { ascending: false });
    const { data } = await query;
    if (data) setOrders(data as OrderRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Overtime tracker — updates every minute
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

  // Load deductions
  useEffect(() => {
    if (!user) return;
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("attendance")
        .select("deduction_amount")
        .eq("user_id", user.id)
        .gte("date", monthStart.toISOString().slice(0, 10));
      if (data) setDeductions(data.reduce((s, a) => s + (Number(a.deduction_amount) || 0), 0));
    })();
  }, [user]);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.delivery_status === filter);
  const basicSalary = profile?.basic_salary || 0;

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <SalaryCard />
      <h1 className="font-heading text-xl flex items-center gap-2">
        <Truck className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
        Delivery Coordinator
      </h1>

      {/* Top cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Overtime */}
        <Card className={cn(overtime.active && "border-orange-500/50")}>
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className={cn("h-8 w-8", overtime.active ? "text-orange-400" : "text-muted-foreground")} />
            <div>
              <p className="text-xs text-muted-foreground">আজকের Overtime</p>
              <p className="text-2xl font-heading">
                {overtime.active ? `${overtime.hours} ঘণ্টা ${overtime.minutes} মিনিট` : "নেই"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Salary */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Basic Salary</p>
            <p className="text-2xl font-heading">৳{basicSalary.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Net (Basic - Deductions)</p>
            <p className="text-2xl font-heading text-[hsl(var(--panel-employee))]">৳{(basicSalary - deductions).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Deductions: ৳{deductions}</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-heading">Dispatched Orders ({filtered.length})</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2 text-left">Consignment ID</th>
                  <th className="py-2 px-2 text-left">Customer</th>
                  <th className="py-2 px-2 text-left">Address</th>
                  <th className="py-2 px-2 text-left">Product</th>
                  <th className="py-2 px-2 text-left">Dispatch Date</th>
                  <th className="py-2 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-border">
                    <td className="py-2 px-2 font-mono text-xs">{o.steadfast_consignment_id || "—"}</td>
                    <td className="py-2 px-2">{o.customer_name || "—"}</td>
                    <td className="py-2 px-2 max-w-[180px] truncate">{o.address || "—"}</td>
                    <td className="py-2 px-2">{o.product || "—"}</td>
                    <td className="py-2 px-2 text-xs">{o.warehouse_sent_at ? new Date(o.warehouse_sent_at).toLocaleDateString("bn-BD") : "—"}</td>
                    <td className="py-2 px-2 text-center">
                      <Badge variant="outline" className={STATUS_COLORS[o.delivery_status || "pending"] || ""}>
                        {o.delivery_status || "pending"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">কোনো order নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
