import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { bn } from "date-fns/locale";
import WarningLights from "@/components/profile/WarningLights";

interface Complaint {
  id: string;
  complainant_id: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function HRComplaints() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase
      .from("employee_complaints" as any)
      .select("*")
      .order("created_at", { ascending: false });
    const c = (data as any) || [];
    setComplaints(c);

    const ids = [...new Set([...c.map((x: any) => x.complainant_id), ...c.map((x: any) => x.target_id)])];
    if (ids.length > 0) {
      const { data: users } = await supabase.from("users").select("id, name").in("id", ids as string[]);
      const map: Record<string, string> = {};
      (users || []).forEach((u: any) => { map[u.id] = u.name; });
      setNames(map);
    }
    setLoading(false);
  };

  const handleDecision = async (id: string, status: "approved" | "rejected") => {
    if (!user) return;
    const { error } = await supabase
      .from("employee_complaints" as any)
      .update({ status, decided_by: user.id, decided_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast.error("সমস্যা হয়েছে");
    } else {
      toast.success(status === "approved" ? "অভিযোগ গৃহীত ✓" : "অভিযোগ প্রত্যাখ্যাত ✓");
      fetchData();
    }
  };

  const filtered = filter === "all" ? complaints : complaints.filter((c) => c.status === filter);

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-600 text-white">গৃহীত</Badge>;
    if (status === "rejected") return <Badge variant="destructive">প্রত্যাখ্যাত</Badge>;
    return <Badge variant="secondary">অপেক্ষমান</Badge>;
  };

  // Get unique target ids with approved complaints for warning lights
  const targetIds = [...new Set(complaints.filter(c => c.status === "approved").map(c => c.target_id))];

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" /> অভিযোগ ব্যবস্থাপনা
        </h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">অপেক্ষমান</SelectItem>
            <SelectItem value="approved">গৃহীত</SelectItem>
            <SelectItem value="rejected">প্রত্যাখ্যাত</SelectItem>
            <SelectItem value="all">সকল</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">কোনো অভিযোগ নেই</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">{names[c.complainant_id] || "..."}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="font-medium">{names[c.target_id] || "..."}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(c.created_at), "dd MMM yyyy, hh:mm a", { locale: bn })}
                        </p>
                      </div>
                      <WarningLights targetUserId={c.target_id} canView={true} />
                      {statusBadge(c.status)}
                    </div>
                    <p className="text-sm bg-muted/50 p-3 rounded-lg">{c.reason}</p>
                  </div>
                  {c.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => handleDecision(c.id, "approved")} className="bg-green-600 hover:bg-green-700 text-white">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDecision(c.id, "rejected")}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
