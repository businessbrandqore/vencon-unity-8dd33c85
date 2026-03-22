import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, ThumbsUp, ThumbsDown } from "lucide-react";

interface FeedbackOrder {
  id: string;
  customer_name: string | null;
  phone: string | null;
  product: string | null;
  cs_rating: string | null;
  cs_note: string | null;
  cs_call_done_at: string | null;
  cs_id: string | null;
}

export default function HRFeedback() {
  const [orders, setOrders] = useState<FeedbackOrder[]>([]);
  const [csNames, setCsNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_name, phone, product, cs_rating, cs_note, cs_call_done_at, cs_id")
        .not("cs_call_done_at", "is", null)
        .order("cs_call_done_at", { ascending: false })
        .limit(200);

      if (data) {
        setOrders(data as FeedbackOrder[]);
        const csIds = [...new Set(data.map((o) => o.cs_id).filter(Boolean))] as string[];
        if (csIds.length > 0) {
          const { data: users } = await supabase.from("users").select("id, name").in("id", csIds);
          if (users) {
            const map: Record<string, string> = {};
            users.forEach((u) => { map[u.id] = u.name; });
            setCsNames(map);
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.cs_rating === filter);
  const goodCount = orders.filter((o) => o.cs_rating === "good").length;
  const avgCount = orders.filter((o) => o.cs_rating === "average").length;
  const badCount = orders.filter((o) => o.cs_rating === "bad").length;

  const RATING_DISPLAY: Record<string, { emoji: string; label: string; color: string }> = {
    good: { emoji: "👍", label: "ভালো", color: "text-green-400 border-green-600/50" },
    average: { emoji: "🤚", label: "মাঝামাঝি", color: "text-yellow-400 border-yellow-500/50" },
    bad: { emoji: "👎", label: "খারাপ", color: "text-destructive border-destructive/50" },
  };

  if (loading) return <LoadingSpinner text="লোড হচ্ছে..." />;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl flex items-center gap-2">
        <Star className="h-5 w-5 text-primary" /> Customer Feedback
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <ThumbsUp className="h-8 w-8 text-green-500" />
          <div><p className="text-xs text-muted-foreground">ভালো</p><p className="text-2xl font-heading">{goodCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <span className="text-3xl">🤚</span>
          <div><p className="text-xs text-muted-foreground">মাঝামাঝি</p><p className="text-2xl font-heading">{avgCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <ThumbsDown className="h-8 w-8 text-destructive" />
          <div><p className="text-xs text-muted-foreground">খারাপ</p><p className="text-2xl font-heading">{badCount}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-heading">সকল Feedback ({filtered.length})</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সকল</SelectItem>
              <SelectItem value="good">ভালো</SelectItem>
              <SelectItem value="average">মাঝামাঝি</SelectItem>
              <SelectItem value="bad">খারাপ</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2 text-left">Customer</th>
                  <th className="py-2 px-2 text-left">Phone</th>
                  <th className="py-2 px-2 text-left">Product</th>
                  <th className="py-2 px-2 text-center">Rating</th>
                  <th className="py-2 px-2 text-left">CS Note</th>
                  <th className="py-2 px-2 text-left">CS Officer</th>
                  <th className="py-2 px-2 text-left">তারিখ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const r = RATING_DISPLAY[o.cs_rating || ""] || { emoji: "—", label: "—", color: "" };
                  return (
                    <tr key={o.id} className="border-b border-border">
                      <td className="py-2 px-2">{o.customer_name || "—"}</td>
                      <td className="py-2 px-2">{o.phone || "—"}</td>
                      <td className="py-2 px-2">{o.product || "—"}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className={r.color}>{r.emoji} {r.label}</Badge>
                      </td>
                      <td className="py-2 px-2 text-xs max-w-[200px] truncate">{o.cs_note || "—"}</td>
                      <td className="py-2 px-2 text-xs">{o.cs_id ? (csNames[o.cs_id] || "—") : "—"}</td>
                      <td className="py-2 px-2 text-xs">{o.cs_call_done_at ? new Date(o.cs_call_done_at).toLocaleDateString("bn-BD") : "—"}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">কোনো feedback নেই</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
