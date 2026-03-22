import { useState, useEffect, useCallback } from "react";
import SalaryCard from "@/components/SalaryCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, CheckCircle, XCircle, Clock, Target, RefreshCw } from "lucide-react";

export default function CSODashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const loadStats = useCallback(async () => {
    if (!user) return;

    const [p, a, r] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_cso"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "send_today").eq("cso_id", user.id).gte("cso_approved_at", todayStart.toISOString()),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "rejected").eq("cso_id", user.id).gte("cso_approved_at", todayStart.toISOString()),
    ]);

    setPendingCount(p.count || 0);
    setApprovedCount(a.count || 0);
    setRejectedCount(r.count || 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    const channel = supabase
      .channel("cso-dash-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadStats())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadStats]);

  if (loading) return <LoadingSpinner text="লোড হচ্ছে..." />;

  return (
    <div className="space-y-6">
      <SalaryCard />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-xl flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Customer Security Officer — ড্যাশবোর্ড
        </h1>
        <Button variant="outline" size="sm" onClick={loadStats}>
          <RefreshCw className="h-4 w-4 mr-1" /> রিফ্রেশ
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className="border-amber-500/30 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate("/employee/leads")}
        >
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-heading">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">আজ Approved</p>
              <p className="text-2xl font-heading">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-6 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">আজ Rejected</p>
              <p className="text-2xl font-heading">{rejectedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card
        className="cursor-pointer hover:bg-muted/30 transition-colors border-primary/30"
        onClick={() => navigate("/employee/leads")}
      >
        <CardContent className="pt-6 flex items-center gap-3">
          <Target className="h-6 w-6 text-primary" />
          <div>
            <p className="font-heading text-sm">লিড ও অর্ডার যাচাই</p>
            <p className="text-xs text-muted-foreground">এজেন্ট কনফার্ম করা অর্ডার দেখুন, Approve/Reject করুন এবং TL এর কাছে ডাটা রিকোয়েস্ট পাঠান</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
