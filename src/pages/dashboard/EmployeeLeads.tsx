import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, differenceInMinutes, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, Target, AlertTriangle, Database, Send } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

interface LeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  status: string | null;
  called_time: number | null;
  special_note: string | null;
  agent_type: string | null;
  requeue_count: number | null;
  requeue_at: string | null;
  campaign_id: string | null;
  tl_id: string | null;
  created_at: string | null;
}

interface InventoryItem {
  id: string;
  product_name: string;
  unit_price: number | null;
}

const LEAD_STATUSES = [
  "Order Confirm", "Pre Order", "Phone Off", "Positive", "Customer Reschedule",
  "Do Not Pick", "No Response", "Busy Now", "Number Busy", "Negative",
  "Not Interested", "Cancelled", "Wrong Number", "Duplicate", "Already Ordered",
];

const REQUEUE_STATUSES = ["Phone Off", "Positive", "Customer Reschedule", "Do Not Pick", "No Response", "Busy Now", "Number Busy"];
const REQUEUE_MINUTES = 40;
const DELETE_SHEET_THRESHOLD = 5;

export default function EmployeeLeads() {
  const { user } = useAuth();

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);

  const [leadStatuses, setLeadStatuses] = useState<Record<string, string>>({});
  const [leadCalledTimes, setLeadCalledTimes] = useState<Record<string, number>>({});
  const [leadNotes, setLeadNotes] = useState<Record<string, string>>({});

  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [currentOrderLead, setCurrentOrderLead] = useState<LeadRow | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderAddress, setOrderAddress] = useState("");
  const [orderProduct, setOrderProduct] = useState("");
  const [orderQty, setOrderQty] = useState(1);
  const [orderPrice, setOrderPrice] = useState(0);
  const [orderNote, setOrderNote] = useState("");

  const [currentPreOrderLead, setCurrentPreOrderLead] = useState<LeadRow | null>(null);
  const [showPreOrderModal, setShowPreOrderModal] = useState(false);
  const [preOrderDate, setPreOrderDate] = useState<Date>();
  const [preOrderNote, setPreOrderNote] = useState("");

  const [metrics, setMetrics] = useState({ orders: 0, delivered: 0, cancelled: 0, returned: 0 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  // Check if clocked in
  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("attendance").select("clock_in").eq("user_id", user.id).eq("date", today).maybeSingle();
      setCheckedIn(!!data?.clock_in);
      setLoading(false);
    })();
  }, [user]);

  const loadLeads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("leads").select("*").eq("assigned_to", user.id)
      .not("status", "in", '("order_confirm","negative","not_interested","cancelled","wrong_number","duplicate","already_ordered")');
    if (data) setLeads(data as LeadRow[]);
  }, [user]);

  useEffect(() => { if (checkedIn) loadLeads(); }, [checkedIn, loadLeads]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("inventory").select("id, product_name, unit_price");
      if (data) setProducts(data as InventoryItem[]);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("orders").select("status, delivery_status").eq("agent_id", user.id).gte("created_at", monthStart.toISOString());
      if (data) {
        setMetrics({
          orders: data.length,
          delivered: data.filter(o => o.delivery_status === "delivered").length,
          cancelled: data.filter(o => o.status === "cancelled").length,
          returned: data.filter(o => o.delivery_status === "returned").length,
        });
      }
    })();
  }, [user, tick]);

  const bronzeLeads = useMemo(() => leads.filter(l => l.agent_type === "bronze" || !l.agent_type), [leads]);
  const silverLeads = useMemo(() => leads.filter(l => l.agent_type === "silver"), [leads]);

  const getRequeueRemaining = (lead: LeadRow) => {
    if (!lead.requeue_at) return null;
    const remaining = differenceInMinutes(new Date(lead.requeue_at), new Date());
    return remaining > 0 ? remaining : null;
  };

  const salesRatio = metrics.orders > 0 ? ((metrics.orders / Math.max(leads.length + metrics.orders, 1)) * 100).toFixed(1) : "0";
  const receiveRatio = metrics.orders > 0 ? ((metrics.delivered / metrics.orders) * 100).toFixed(1) : "0";

  const handleLeadSave = async (lead: LeadRow) => {
    const newStatus = leadStatuses[lead.id];
    if (!newStatus || !user) return;
    const calledTime = leadCalledTimes[lead.id] || lead.called_time || 1;
    const note = leadNotes[lead.id] ?? lead.special_note;

    if (newStatus === "Order Confirm") {
      setCurrentOrderLead(lead);
      setOrderAddress(lead.address || ""); setOrderProduct(""); setOrderQty(1); setOrderPrice(0); setOrderNote("");
      setShowOrderModal(true); return;
    }
    if (newStatus === "Pre Order") {
      setCurrentPreOrderLead(lead);
      setPreOrderDate(undefined); setPreOrderNote("");
      setShowPreOrderModal(true); return;
    }

    const updatePayload: Record<string, unknown> = {
      status: newStatus.toLowerCase().replace(/\s+/g, "_"), called_time: calledTime, special_note: note, called_date: new Date().toISOString(),
    };
    if (REQUEUE_STATUSES.includes(newStatus)) {
      const cnt = (lead.requeue_count || 0) + 1;
      updatePayload.requeue_count = cnt;
      updatePayload.requeue_at = addMinutes(new Date(), REQUEUE_MINUTES).toISOString();
      if (cnt >= DELETE_SHEET_THRESHOLD) updatePayload.status = "tl_delete_sheet";
    }
    await supabase.from("leads").update(updatePayload).eq("id", lead.id);
    toast.success("Lead আপডেট হয়েছে");
    loadLeads();
  };

  const handleOrderConfirm = async () => {
    if (!currentOrderLead || !user || !orderProduct) { toast.error("Product নির্বাচন করুন"); return; }
    const { error } = await supabase.from("orders").insert({
      customer_name: currentOrderLead.name, phone: currentOrderLead.phone, address: orderAddress,
      product: orderProduct, quantity: orderQty, price: orderPrice, agent_id: user.id,
      tl_id: currentOrderLead.tl_id, lead_id: currentOrderLead.id, status: "pending_cso",
    });
    if (error) { toast.error("অর্ডার তৈরিতে সমস্যা"); return; }
    await supabase.from("leads").update({ status: "order_confirm", called_date: new Date().toISOString() }).eq("id", currentOrderLead.id);
    setShowOrderModal(false);
    toast.success("অর্ডার নিশ্চিত হয়েছে ✓");
    loadLeads();
  };

  const handlePreOrderSubmit = async () => {
    if (!currentPreOrderLead || !user || !preOrderDate) { toast.error("তারিখ নির্বাচন করুন"); return; }
    await supabase.from("pre_orders").insert({
      lead_id: currentPreOrderLead.id, agent_id: user.id, tl_id: currentPreOrderLead.tl_id,
      scheduled_date: format(preOrderDate, "yyyy-MM-dd"), note: preOrderNote || null,
    });
    await supabase.from("leads").update({ status: "pre_order", called_date: new Date().toISOString() }).eq("id", currentPreOrderLead.id);
    setShowPreOrderModal(false);
    toast.success("Pre-order তৈরি হয়েছে ✓");
    loadLeads();
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  if (!checkedIn) {
    return (
      <div className="space-y-6">
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-orange-400" />
            <h2 className="font-heading text-lg mb-2">প্রথমে Check In করুন</h2>
            <p className="text-sm text-muted-foreground">লিড দেখতে হলে আগে ড্যাশবোর্ড থেকে Check In করতে হবে</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/employee/dashboard"}>
              ড্যাশবোর্ডে যান
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderLeadTable = (leadList: LeadRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2 px-2 text-left">#</th>
            <th className="py-2 px-2 text-left">কাস্টমার</th>
            <th className="py-2 px-2 text-left">ফোন</th>
            <th className="py-2 px-2 text-left">ঠিকানা</th>
            <th className="py-2 px-2 text-left">স্ট্যাটাস</th>
            <th className="py-2 px-2 text-left">কল</th>
            <th className="py-2 px-2 text-left">নোট</th>
            <th className="py-2 px-2"></th>
          </tr>
        </thead>
        <tbody>
          {leadList.map((lead, idx) => {
            const requeueRemaining = getRequeueRemaining(lead);
            const isRequeued = requeueRemaining !== null && requeueRemaining > 0;
            return (
              <tr key={lead.id} className={cn("border-b border-border", isRequeued && "opacity-50 pointer-events-none bg-muted/30")}>
                <td className="py-2 px-2">{idx + 1}</td>
                <td className="py-2 px-2">{lead.name || "—"}</td>
                <td className="py-2 px-2">{lead.phone || "—"}</td>
                <td className="py-2 px-2 max-w-[150px] truncate">{lead.address || "—"}</td>
                <td className="py-2 px-2 min-w-[180px]">
                  {isRequeued ? (
                    <Badge variant="outline" className="text-orange-400 border-orange-400/50">⏳ {requeueRemaining} মিনিটে</Badge>
                  ) : (
                    <Select value={leadStatuses[lead.id] || ""} onValueChange={v => setLeadStatuses(p => ({ ...p, [lead.id]: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="স্ট্যাটাস" /></SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="py-2 px-2 min-w-[70px]">
                  <Select value={String(leadCalledTimes[lead.id] || lead.called_time || 1)} onValueChange={v => setLeadCalledTimes(p => ({ ...p, [lead.id]: Number(v) }))}>
                    <SelectTrigger className="h-8 text-xs w-14"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-2 px-2">
                  <Input className="h-8 text-xs" value={leadNotes[lead.id] ?? (lead.special_note || "")} onChange={e => setLeadNotes(p => ({ ...p, [lead.id]: e.target.value }))} placeholder="নোট" />
                </td>
                <td className="py-2 px-2">
                  <Button size="sm" variant="outline" onClick={() => handleLeadSave(lead)} disabled={!leadStatuses[lead.id]} className="h-7 text-xs border-[hsl(var(--panel-employee))] text-[hsl(var(--panel-employee))]">
                    সেভ
                  </Button>
                </td>
              </tr>
            );
          })}
          {leadList.length === 0 && (
            <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">কোনো লিড নেই — টিম লিডার অ্যাসাইন করলে এখানে দেখাবে</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <Target className="h-5 w-5 text-[hsl(var(--panel-employee))]" /> লিড শীট
        </h1>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>সেলস রেশিও: <strong className="text-foreground">{salesRatio}%</strong></span>
          <span>রিসিভ রেশিও: <strong className="text-foreground">{receiveRatio}%</strong></span>
          <span>অর্ডার: <strong className="text-foreground">{metrics.orders}</strong></span>
        </div>
      </div>

      <Tabs defaultValue="bronze">
        <TabsList>
          <TabsTrigger value="bronze">ব্রোঞ্জ লিড ({bronzeLeads.length})</TabsTrigger>
          <TabsTrigger value="silver">সিল্ভার লিড ({silverLeads.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="bronze">
          <Card><CardContent className="p-0 sm:p-2">{renderLeadTable(bronzeLeads)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="silver">
          <Card><CardContent className="p-0 sm:p-2">{renderLeadTable(silverLeads)}</CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Order Confirm Modal */}
      <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>অর্ডার নিশ্চিত করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>কাস্টমার</Label><Input value={currentOrderLead?.name || ""} readOnly className="mt-1 bg-muted" /></div>
            <div><Label>ফোন</Label><Input value={currentOrderLead?.phone || ""} readOnly className="mt-1 bg-muted" /></div>
            <div><Label>ঠিকানা</Label><Input value={orderAddress} onChange={e => setOrderAddress(e.target.value)} className="mt-1" /></div>
            <div>
              <Label>প্রোডাক্ট</Label>
              <Select value={orderProduct} onValueChange={v => { setOrderProduct(v); const p = products.find(pr => pr.product_name === v); if (p) setOrderPrice(p.unit_price || 0); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="প্রোডাক্ট নির্বাচন" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.product_name}>{p.product_name} (৳{p.unit_price})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>পরিমাণ</Label><Input type="number" min={1} value={orderQty} onChange={e => setOrderQty(Number(e.target.value))} className="mt-1" /></div>
              <div><Label>মূল্য</Label><Input type="number" value={orderPrice} onChange={e => setOrderPrice(Number(e.target.value))} className="mt-1" /></div>
            </div>
            <div><Label>নোট</Label><Textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleOrderConfirm} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">নিশ্চিত করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-Order Modal */}
      <Dialog open={showPreOrderModal} onOpenChange={setShowPreOrderModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>প্রি-অর্ডার</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>কাস্টমার</Label><Input value={currentPreOrderLead?.name || ""} readOnly className="mt-1 bg-muted" /></div>
            <div><Label>ফোন</Label><Input value={currentPreOrderLead?.phone || ""} readOnly className="mt-1 bg-muted" /></div>
            <div>
              <Label>ডেলিভারি তারিখ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left", !preOrderDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {preOrderDate ? format(preOrderDate, "PPP") : "তারিখ নির্বাচন"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={preOrderDate} onSelect={setPreOrderDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>নোট</Label><Textarea value={preOrderNote} onChange={e => setPreOrderNote(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handlePreOrderSubmit} className="bg-[hsl(var(--panel-employee))] hover:bg-[hsl(var(--panel-employee)/0.8)] text-white">সাবমিট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
