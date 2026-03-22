import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useState, useEffect, useCallback } from "react";
import SalaryCard from "@/components/SalaryCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Phone, CheckCircle } from "lucide-react";

const CS_STATUSES = [
  "Call Done", "Order Confirm", "Pre Order", "Phone Off", "Positive",
  "Customer Reschedule", "Do Not Pick", "No Response", "Busy Now", "Number Busy",
  "Negative", "Not Interested", "Cancelled", "Wrong Number", "Duplicate",
  "Already Ordered", "Follow Up", "Switch Off", "Not Reachable", "Out of Coverage",
];

interface OrderRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  product: string | null;
  address: string | null;
  delivery_status: string | null;
  warehouse_sent_at: string | null;
  tl_id: string | null;
  cs_note: string | null;
  cs_rating: string | null;
}

export default function CSExecutiveDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [doneCount, setDoneCount] = useState(0);

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, customer_name, phone, product, address, delivery_status, warehouse_sent_at, tl_id, cs_note, cs_rating")
      .eq("delivery_status", "delivered")
      .is("cs_call_done_at", null)
      .order("warehouse_sent_at", { ascending: true });
    if (data) setOrders(data as OrderRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Count done today
  useEffect(() => {
    if (!user) return;
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("cs_id", user.id)
        .gte("cs_call_done_at", todayStart.toISOString());
      setDoneCount(count || 0);
    })();
  }, [user, orders]);

  const handleSave = async (order: OrderRow) => {
    if (!user) return;
    const status = statuses[order.id];
    if (!status) { toast.error("Status নির্বাচন করুন"); return; }

    const note = notes[order.id] || "";
    const rating = ratings[order.id] || "";

    if (status === "Call Done") {
      await supabase.from("orders").update({
        status: "call_done",
        cs_id: user.id,
        cs_call_done_at: new Date().toISOString(),
        cs_note: note || null,
        cs_rating: rating || null,
      }).eq("id", order.id);

      // Progress lead: bronze→silver, silver→golden
      await supabase.rpc("progress_lead_after_cs", { _order_id: order.id });

      // Notify TL
      if (order.tl_id) {
        await supabase.from("notifications").insert({
          user_id: order.tl_id,
          title: "Call Done — পরবর্তী ধাপে পাঠানো হয়েছে",
          message: `Customer: ${order.customer_name} — Product: ${order.product}`,
          type: "info",
        });
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        action: "cs_call_done",
        actor_id: user.id,
        target_table: "orders",
        target_id: order.id,
        details: { cs_note: note, cs_rating: rating },
      });

      toast.success("Call Done ✓ — ডাটা পরবর্তী ধাপে পাঠানো হয়েছে");
    } else {
      await supabase.from("orders").update({
        cs_note: note || null,
        cs_rating: rating || null,
      }).eq("id", order.id);
      toast.success("আপডেট হয়েছে");
    }

    loadOrders();
  };

  if (loading) return <LoadingSpinner text="লোড হচ্ছে..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Phone className="h-5 w-5 text-[hsl(var(--panel-employee))]" />
          লিড — ডেলিভারড ডাটা
        </h1>
        <Badge variant="outline" className="text-[hsl(var(--panel-employee))] border-[hsl(var(--panel-employee)/0.5)]">
          <CheckCircle className="h-3 w-3 mr-1" /> আজ Done: {doneCount}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading">ডেলিভারড ডাটা — কল পেন্ডিং ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2 text-left">Order ID</th>
                  <th className="py-2 px-2 text-left">Customer</th>
                  <th className="py-2 px-2 text-left">Phone</th>
                  <th className="py-2 px-2 text-left">Product</th>
                  <th className="py-2 px-2 text-left">Delivery Date</th>
                  <th className="py-2 px-2 text-left min-w-[160px]">CS Status</th>
                  <th className="py-2 px-2 text-left">Note</th>
                  <th className="py-2 px-2 text-left">Rating</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border">
                    <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                    <td className="py-2 px-2">{o.customer_name || "—"}</td>
                    <td className="py-2 px-2">{o.phone || "—"}</td>
                    <td className="py-2 px-2">{o.product || "—"}</td>
                    <td className="py-2 px-2 text-xs">{o.warehouse_sent_at ? new Date(o.warehouse_sent_at).toLocaleDateString("bn-BD") : "—"}</td>
                    <td className="py-2 px-2">
                      <Select value={statuses[o.id] || ""} onValueChange={(v) => setStatuses((p) => ({ ...p, [o.id]: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          {CS_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        className="h-8 text-xs"
                        value={notes[o.id] ?? ""}
                        onChange={(e) => setNotes((p) => ({ ...p, [o.id]: e.target.value }))}
                        placeholder="Note"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <RadioGroup
                        value={ratings[o.id] || ""}
                        onValueChange={(v) => setRatings((p) => ({ ...p, [o.id]: v }))}
                        className="flex gap-2"
                      >
                        <div className="flex items-center"><RadioGroupItem value="good" id={`g-${o.id}`} className="sr-only" /><Label htmlFor={`g-${o.id}`} className={cn("cursor-pointer text-lg", ratings[o.id] === "good" && "ring-2 ring-[hsl(var(--panel-employee))] rounded-full")}>👍</Label></div>
                        <div className="flex items-center"><RadioGroupItem value="average" id={`a-${o.id}`} className="sr-only" /><Label htmlFor={`a-${o.id}`} className={cn("cursor-pointer text-lg", ratings[o.id] === "average" && "ring-2 ring-[hsl(var(--panel-employee))] rounded-full")}>🤚</Label></div>
                        <div className="flex items-center"><RadioGroupItem value="bad" id={`b-${o.id}`} className="sr-only" /><Label htmlFor={`b-${o.id}`} className={cn("cursor-pointer text-lg", ratings[o.id] === "bad" && "ring-2 ring-[hsl(var(--panel-employee))] rounded-full")}>👎</Label></div>
                      </RadioGroup>
                    </td>
                    <td className="py-2 px-2">
                      <Button size="sm" variant="outline" onClick={() => handleSave(o)} disabled={!statuses[o.id]} className="h-7 text-xs border-[hsl(var(--panel-employee))] text-[hsl(var(--panel-employee))]">
                        Save
                      </Button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">কোনো pending follow-up নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
