import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Database, CheckCircle, XCircle, RefreshCw, Inbox, Clock, Filter } from "lucide-react";

interface DataRequest {
  id: string;
  requested_by: string;
  tl_id: string;
  campaign_id: string | null;
  status: string;
  message: string | null;
  response_note: string | null;
  created_at: string;
  responded_at: string | null;
  requester_name?: string;
  requester_role?: string;
}

export default function TLDataRequests() {
  const { user } = useAuth();
  const { roleName } = useLanguage();
  const isBn = true;

  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const loadDataRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("data_requests")
      .select("*")
      .eq("tl_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      const requesterIds = [...new Set(data.map((r: any) => r.requested_by))];
      const { data: users } = requesterIds.length > 0
        ? await supabase.from("users").select("id, name, role").in("id", requesterIds)
        : { data: [] };
      const userMap = new Map((users || []).map((u: any) => [u.id, u]));

      const enriched: DataRequest[] = data.map((r: any) => ({
        ...r,
        requester_name: userMap.get(r.requested_by)?.name || "Unknown",
        requester_role: userMap.get(r.requested_by)?.role || "",
      }));
      setDataRequests(enriched);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadDataRequests();

    const channel = supabase
      .channel('data-requests-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'data_requests' }, () => {
        loadDataRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadDataRequests]);

  const handleFulfillRequest = async (requestId: string) => {
    await supabase.from("data_requests").update({ status: "fulfilled", responded_at: new Date().toISOString() }).eq("id", requestId);
    toast.success(isBn ? "রিকোয়েস্ট পূরণ হিসেবে মার্ক করা হয়েছে" : "Request marked as fulfilled");
    loadDataRequests();
  };

  const handleRejectRequest = async (requestId: string) => {
    await supabase.from("data_requests").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("id", requestId);
    toast.success(isBn ? "রিকোয়েস্ট প্রত্যাখ্যান করা হয়েছে" : "Request rejected");
    loadDataRequests();
  };

  const filtered = statusFilter === "all" ? dataRequests : dataRequests.filter(r => r.status === statusFilter);
  const pendingCount = dataRequests.filter(r => r.status === "pending").length;
  const fulfilledCount = dataRequests.filter(r => r.status === "fulfilled").length;
  const rejectedCount = dataRequests.filter(r => r.status === "rejected").length;

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {isBn ? "ডাটা রিকোয়েস্ট" : "Data Requests"}
          </h2>
          <p className="text-sm text-muted-foreground">{isBn ? "এজেন্টদের ডাটার আবেদন পরিচালনা করুন" : "Manage agent data requests"}</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadDataRequests} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">{isBn ? "পেন্ডিং" : "Pending"}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{fulfilledCount}</p>
            <p className="text-xs text-muted-foreground">{isBn ? "পূরণ হয়েছে" : "Fulfilled"}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4 text-center">
            <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{rejectedCount}</p>
            <p className="text-xs text-muted-foreground">{isBn ? "প্রত্যাখ্যাত" : "Rejected"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">{isBn ? "সব" : "All"} ({dataRequests.length})</TabsTrigger>
          <TabsTrigger value="pending">{isBn ? "পেন্ডিং" : "Pending"} ({pendingCount})</TabsTrigger>
          <TabsTrigger value="fulfilled">{isBn ? "পূরণ" : "Fulfilled"} ({fulfilledCount})</TabsTrigger>
          <TabsTrigger value="rejected">{isBn ? "বাতিল" : "Rejected"} ({rejectedCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Request list */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">{isBn ? "কোনো রিকোয়েস্ট নেই" : "No requests"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(req => (
                <div
                  key={req.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    req.status === 'pending'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : req.status === 'fulfilled'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">{req.requester_name}</span>
                        <Badge variant="secondary" className="text-[10px]">{roleName(req.requester_role || "")}</Badge>
                        <Badge
                          variant={req.status === 'pending' ? 'outline' : req.status === 'fulfilled' ? 'default' : 'destructive'}
                          className="text-[10px]"
                        >
                          {req.status === 'pending' ? (isBn ? 'পেন্ডিং' : 'Pending') :
                           req.status === 'fulfilled' ? (isBn ? 'পূরণ হয়েছে' : 'Fulfilled') :
                           (isBn ? 'প্রত্যাখ্যান' : 'Rejected')}
                        </Badge>
                      </div>
                      {req.message && <p className="text-sm text-muted-foreground">{req.message}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(req.created_at).toLocaleString("bn-BD")}
                        {req.responded_at && (
                          <span className="ml-2">• {isBn ? "উত্তর:" : "Response:"} {new Date(req.responded_at).toLocaleString("bn-BD")}</span>
                        )}
                      </p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleFulfillRequest(req.id)} className="gap-1 text-emerald-600 border-emerald-500/50 hover:bg-emerald-500/10">
                          <CheckCircle className="h-3.5 w-3.5" /> {isBn ? "পূরণ" : "Fulfill"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req.id)} className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10">
                          <XCircle className="h-3.5 w-3.5" /> {isBn ? "বাতিল" : "Reject"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
