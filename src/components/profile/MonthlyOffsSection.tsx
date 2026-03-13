import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarOff, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { bn } from "date-fns/locale";

interface Props {
  userId: string;
}

interface OffDay {
  id: string;
  off_date: string;
  month: number;
  year: number;
}

interface Appeal {
  id: string;
  off_id: string;
  requested_date: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function MonthlyOffsSection({ userId }: Props) {
  const [offs, setOffs] = useState<OffDay[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [appealOffId, setAppealOffId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    const [offsRes, appealsRes] = await Promise.all([
      supabase
        .from("employee_monthly_offs")
        .select("id, off_date, month, year")
        .eq("user_id", userId)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .order("off_date"),
      supabase
        .from("off_day_appeals" as any)
        .select("id, off_id, requested_date, reason, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    setOffs((offsRes.data as any) || []);
    setAppeals((appealsRes.data as any) || []);
    setLoading(false);
  };

  const handleSubmitAppeal = async () => {
    if (!appealOffId || !newDate || !reason.trim()) {
      toast.error("সব তথ্য পূরণ করুন");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("off_day_appeals" as any).insert({
      user_id: userId,
      off_id: appealOffId,
      requested_date: newDate,
      reason: reason.trim(),
    } as any);
    if (error) {
      toast.error("আপিল জমা দিতে সমস্যা হয়েছে");
    } else {
      toast.success("আপিল সফলভাবে জমা হয়েছে ✓");
      setAppealOffId(null);
      setNewDate("");
      setReason("");
      fetchData();
    }
    setSubmitting(false);
  };

  const getAppealForOff = (offId: string) => appeals.find((a) => a.off_id === offId);

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-600 text-white">অনুমোদিত</Badge>;
    if (status === "rejected") return <Badge variant="destructive">প্রত্যাখ্যাত</Badge>;
    return <Badge variant="secondary">অপেক্ষমান</Badge>;
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-primary" />
          এই মাসের ছুটি ({currentMonth}/{currentYear})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {offs.length === 0 ? (
          <p className="text-sm text-muted-foreground">এই মাসে কোনো ছুটি নির্ধারণ করা হয়নি</p>
        ) : (
          <div className="space-y-3">
            {offs.map((off) => {
              const appeal = getAppealForOff(off.id);
              return (
                <div key={off.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="font-medium text-sm">
                      {format(new Date(off.off_date), "dd MMMM, yyyy", { locale: bn })}
                    </p>
                    {appeal && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">আপিল:</span>
                        {statusBadge(appeal.status)}
                        <span className="text-xs text-muted-foreground">
                          → {format(new Date(appeal.requested_date), "dd MMM", { locale: bn })}
                        </span>
                      </div>
                    )}
                  </div>
                  {!appeal && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAppealOffId(off.id)}
                          className="text-xs"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          তারিখ পরিবর্তন
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>ছুটির তারিখ পরিবর্তনের আপিল</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-2">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">বর্তমান তারিখ</p>
                            <p className="font-medium">{format(new Date(off.off_date), "dd MMMM, yyyy", { locale: bn })}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">নতুন তারিখ</p>
                            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">কারণ</p>
                            <Textarea
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="তারিখ পরিবর্তনের কারণ লিখুন..."
                              rows={3}
                            />
                          </div>
                          <Button onClick={handleSubmitAppeal} disabled={submitting} className="w-full">
                            {submitting ? "জমা হচ্ছে..." : "আপিল জমা দিন"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
