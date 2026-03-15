import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, Search, Phone, ChevronUp, ChevronDown, Loader2, ShieldAlert, ShieldX, AlertTriangle, HelpCircle } from "lucide-react";

interface CourierResult {
  courier: string;
  total: number;
  success: number;
  cancel: number;
  error?: string;
}

interface FraudData {
  phone: string;
  couriers: Record<string, CourierResult>;
  totalSummary: { total: number; success: number; cancel: number; successRate: number; cancelRate: number };
  riskLevel: string;
  riskMessage: string;
}

interface HistoryOrder {
  id: string;
  customer_name: string | null;
  phone: string | null;
  product: string | null;
  status: string | null;
  delivery_status: string | null;
  created_at: string | null;
  address: string | null;
  district: string | null;
  thana: string | null;
  price: number | null;
  quantity: number | null;
  advance_payment: number | null;
  payment_method: string | null;
}

const FraudChecker = () => {
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [collapsed, setCollapsed] = useState(false);
  const [fraudPhone, setFraudPhone] = useState("");
  const [fraudLoading, setFraudLoading] = useState(false);
  const [fraudResult, setFraudResult] = useState<FraudData | null>(null);
  const [fraudError, setFraudError] = useState("");

  const [historyPhone, setHistoryPhone] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<HistoryOrder[]>([]);
  const [historyLeads, setHistoryLeads] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const checkFraud = async () => {
    if (!fraudPhone.trim()) return;
    setFraudLoading(true);
    setFraudError("");
    setFraudResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("fraud-check", {
        body: { phone_number: fraudPhone.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) {
        setFraudError(data.error);
      } else if (data?.data) {
        setFraudResult(data.data);
      } else {
        setFraudError(isBn ? "কোনো ডাটা পাওয়া যায়নি" : "No data found");
      }
    } catch (err: any) {
      setFraudError(err.message || "Error");
    } finally {
      setFraudLoading(false);
    }
  };

  const searchHistory = async () => {
    if (!historyPhone.trim()) return;
    setHistoryLoading(true);
    const phone = historyPhone.trim();

    const [ordersRes, leadsRes] = await Promise.all([
      supabase.from("orders").select("id, customer_name, phone, product, status, delivery_status, created_at").ilike("phone", `%${phone.slice(-10)}%`).order("created_at", { ascending: false }).limit(50),
      supabase.from("leads").select("id, name, phone, status, created_at, agent_type").ilike("phone", `%${phone.slice(-10)}%`).order("created_at", { ascending: false }).limit(50),
    ]);

    setHistoryOrders((ordersRes.data as HistoryOrder[]) || []);
    setHistoryLeads(leadsRes.data || []);
    setHistoryLoading(false);
    setShowHistory(true);
  };

  const getRiskColor = (level: string) => {
    if (level === "safe") return "text-green-600";
    if (level === "moderate") return "text-yellow-600";
    if (level === "risky") return "text-orange-500";
    if (level === "dangerous") return "text-red-600";
    return "text-muted-foreground";
  };

  const getRiskLabel = (level: string) => {
    if (level === "safe") return isBn ? "✅ নিরাপদ — পণ্য পাঠানো যাবে" : "✅ Safe to deliver";
    if (level === "moderate") return isBn ? "⚠️ মোটামুটি — সতর্কতার সাথে পাঠান" : "⚠️ Moderate — Send with caution";
    if (level === "risky") return isBn ? "🔶 ঝুঁকিপূর্ণ — অগ্রিম পেমেন্ট নিন" : "🔶 Risky — Take advance payment";
    if (level === "dangerous") return isBn ? "🔴 বিপজ্জনক — পাঠানো উচিত নয়" : "🔴 Dangerous — Do not send";
    return isBn ? "❓ কোনো ডাটা নেই" : "❓ No data";
  };

  const getRiskIcon = (level: string) => {
    if (level === "safe") return <ShieldCheck className="h-5 w-5 text-green-600" />;
    if (level === "moderate") return <ShieldAlert className="h-5 w-5 text-yellow-600" />;
    if (level === "risky") return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    if (level === "dangerous") return <ShieldX className="h-5 w-5 text-red-600" />;
    return <HelpCircle className="h-5 w-5 text-muted-foreground" />;
  };

  const getCourierColor = (courier: CourierResult) => {
    if (courier.error) return "border-muted";
    if (courier.total === 0) return "border-muted";
    const rate = (courier.success / courier.total) * 100;
    if (rate >= 80) return "border-green-500/50";
    if (rate >= 60) return "border-yellow-500/50";
    return "border-red-500/50";
  };

  return (
    <>
      {/* Sticky Panel */}
      <div className="sticky top-0 z-30 bg-card border border-border rounded-lg shadow-lg mb-4 overflow-hidden">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-primary/10 to-accent hover:from-primary/15 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-heading text-sm font-bold text-foreground">
              {isBn ? "ফ্রড চেকার ও নাম্বার সার্চ" : "Fraud Checker & Number Search"}
            </span>
          </div>
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </button>

        {!collapsed && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fraud Checker */}
              <div className="space-y-3">
                <h3 className="font-heading text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  {isBn ? "কুরিয়ার ফ্রড চেকার" : "Courier Fraud Checker"}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {isBn ? "Steadfast, Pathao, RedX থেকে সরাসরি ডেলিভারি হিস্টোরি চেক করুন" : "Check delivery history directly from Steadfast, Pathao, RedX"}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={fraudPhone}
                    onChange={(e) => setFraudPhone(e.target.value)}
                    placeholder={isBn ? "ফোন নাম্বার (01XXXXXXXXX)" : "Phone (01XXXXXXXXX)"}
                    className="text-sm h-9"
                    onKeyDown={(e) => e.key === "Enter" && checkFraud()}
                  />
                  <Button size="sm" onClick={checkFraud} disabled={fraudLoading} className="h-9 gap-1.5 px-3">
                    {fraudLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {isBn ? "চেক" : "Check"}
                  </Button>
                </div>

                {fraudError && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">{fraudError}</div>
                )}

                {fraudResult && (
                  <div className="space-y-3">
                    {/* Risk Assessment */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
                      {getRiskIcon(fraudResult.riskLevel)}
                      <div className="flex-1">
                        <div className={`text-lg font-bold font-heading ${getRiskColor(fraudResult.riskLevel)}`}>
                          {fraudResult.totalSummary.total > 0 ? `${fraudResult.totalSummary.successRate}%` : "N/A"}
                        </div>
                        <div className={`text-xs font-bold ${getRiskColor(fraudResult.riskLevel)}`}>
                          {getRiskLabel(fraudResult.riskLevel)}
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground space-y-0.5">
                        <div>{isBn ? "মোট অর্ডার" : "Total"}: <span className="font-bold text-foreground">{fraudResult.totalSummary.total}</span></div>
                        <div className="text-green-600">{isBn ? "সফল ডেলিভারি" : "Delivered"}: {fraudResult.totalSummary.success}</div>
                        <div className="text-red-500">{isBn ? "বাতিল/রিটার্ন" : "Cancelled"}: {fraudResult.totalSummary.cancel}</div>
                      </div>
                    </div>

                    {/* Individual Courier Results */}
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(fraudResult.couriers).map(([name, courier]) => {
                        const rate = courier.total > 0 ? ((courier.success / courier.total) * 100).toFixed(0) : "—";
                        return (
                          <div key={name} className={`p-2 rounded border-2 ${getCourierColor(courier)} bg-background text-center space-y-1`}>
                            <div className="text-[10px] font-bold text-foreground">{name}</div>
                            {courier.error ? (
                              <div className="text-[9px] text-muted-foreground">{isBn ? "ত্রুটি" : "Error"}</div>
                            ) : (
                              <>
                                <div className="text-sm font-bold text-foreground">{rate}%</div>
                                <div className="flex justify-center gap-2 text-[9px]">
                                  <span className="text-green-600">✓{courier.success}</span>
                                  <span className="text-muted-foreground">/{courier.total}</span>
                                  <span className="text-red-500">✗{courier.cancel}</span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Number History Search */}
              <div className="space-y-3">
                <h3 className="font-heading text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-primary" />
                  {isBn ? "নাম্বার হিস্টোরি সার্চ" : "Number History Search"}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {isBn ? "এই প্রতিষ্ঠানে এই নাম্বারের সকল অর্ডার ও লিড দেখুন" : "View all orders & leads for this number in our system"}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={historyPhone}
                    onChange={(e) => setHistoryPhone(e.target.value)}
                    placeholder={isBn ? "ফোন নাম্বার সার্চ করুন" : "Search phone number"}
                    className="text-sm h-9"
                    onKeyDown={(e) => e.key === "Enter" && searchHistory()}
                  />
                  <Button size="sm" variant="outline" onClick={searchHistory} disabled={historyLoading} className="h-9 gap-1.5 px-3">
                    {historyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    {isBn ? "সার্চ" : "Search"}
                  </Button>
                </div>

                {(historyOrders.length > 0 || historyLeads.length > 0) && !showHistory && (
                  <button onClick={() => setShowHistory(true)} className="text-xs text-primary hover:underline">
                    {isBn ? `পাওয়া গেছে: ${historyOrders.length} অর্ডার, ${historyLeads.length} লিড — বিস্তারিত দেখুন` : `Found: ${historyOrders.length} orders, ${historyLeads.length} leads — View details`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History Popup Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {isBn ? `নাম্বার হিস্টোরি: ${historyPhone}` : `Number History: ${historyPhone}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Orders */}
            <div>
              <h4 className="font-heading text-sm font-bold text-foreground mb-2">
                {isBn ? `অর্ডার (${historyOrders.length})` : `Orders (${historyOrders.length})`}
              </h4>
              {historyOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground">{isBn ? "কোনো অর্ডার নেই" : "No orders found"}</p>
              ) : (
                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-bold">{isBn ? "তারিখ" : "Date"}</th>
                        <th className="px-2 py-1.5 text-left font-bold">{isBn ? "কাস্টমার" : "Customer"}</th>
                        <th className="px-2 py-1.5 text-left font-bold">{isBn ? "পণ্য" : "Product"}</th>
                        <th className="px-2 py-1.5 text-left font-bold">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                        <th className="px-2 py-1.5 text-left font-bold">{isBn ? "ডেলিভারি" : "Delivery"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {historyOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-accent/30">
                          <td className="px-2 py-1.5">{o.created_at ? new Date(o.created_at).toLocaleDateString("bn-BD") : "-"}</td>
                          <td className="px-2 py-1.5">{o.customer_name || "-"}</td>
                          <td className="px-2 py-1.5">{o.product || "-"}</td>
                          <td className="px-2 py-1.5">
                            <Badge variant="outline" className="text-[9px]">{o.status || "-"}</Badge>
                          </td>
                          <td className="px-2 py-1.5">
                            <Badge
                              variant={o.delivery_status === "delivered" ? "default" : o.delivery_status === "returned" ? "destructive" : "outline"}
                              className="text-[9px]"
                            >
                              {o.delivery_status || "-"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Leads */}
            <div>
              <h4 className="font-heading text-sm font-bold text-foreground mb-2">
                {isBn ? `লিড (${historyLeads.length})` : `Leads (${historyLeads.length})`}
              </h4>
              {historyLeads.length === 0 ? (
                <p className="text-xs text-muted-foreground">{isBn ? "কোনো লিড নেই" : "No leads found"}</p>
              ) : (
                <div className="border border-border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-bold">{isBn ? "তারিখ" : "Date"}</th>
                        <th className="px-2 py-1.5 text-left font-bold">{isBn ? "নাম" : "Name"}</th>
                        <th className="px-2 py-1.5 text-left font-bold">{isBn ? "ফোন" : "Phone"}</th>
                        <th className="px-2 py-1.5 text-left font-bold">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                        <th className="px-2 py-1.5 text-left font-bold">{isBn ? "টাইপ" : "Type"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {historyLeads.map((l: any) => (
                        <tr key={l.id} className="hover:bg-accent/30">
                          <td className="px-2 py-1.5">{l.created_at ? new Date(l.created_at).toLocaleDateString("bn-BD") : "-"}</td>
                          <td className="px-2 py-1.5">{l.name || "-"}</td>
                          <td className="px-2 py-1.5">{l.phone || "-"}</td>
                          <td className="px-2 py-1.5">
                            <Badge variant="outline" className="text-[9px]">{l.status || "-"}</Badge>
                          </td>
                          <td className="px-2 py-1.5">
                            <Badge variant="secondary" className="text-[9px]">{l.agent_type || "bronze"}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FraudChecker;
