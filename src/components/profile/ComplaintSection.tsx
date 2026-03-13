import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { bn } from "date-fns/locale";

interface Props {
  userId: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface Complaint {
  id: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function ComplaintSection({ userId }: Props) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [targetNames, setTargetNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    const [complaintsRes, employeesRes] = await Promise.all([
      supabase
        .from("employee_complaints" as any)
        .select("id, target_id, reason, status, created_at")
        .eq("complainant_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("users").select("id, name, role").eq("is_active", true).neq("id", userId),
    ]);
    const c = (complaintsRes.data as any) || [];
    setComplaints(c);
    setEmployees((employeesRes.data as any) || []);

    // Get target names
    if (c.length > 0) {
      const ids = [...new Set(c.map((x: any) => x.target_id))];
      const { data: names } = await supabase.from("users").select("id, name").in("id", ids as string[]);
      const map: Record<string, string> = {};
      (names || []).forEach((n: any) => { map[n.id] = n.name; });
      setTargetNames(map);
    }
  };

  const handleSubmit = async () => {
    if (!targetId || !reason.trim()) {
      toast.error("সব তথ্য পূরণ করুন");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("employee_complaints" as any).insert({
      complainant_id: userId,
      target_id: targetId,
      reason: reason.trim(),
    } as any);
    if (error) {
      toast.error("অভিযোগ জমা দিতে সমস্যা হয়েছে");
    } else {
      toast.success("অভিযোগ জমা হয়েছে ✓");
      setOpen(false);
      setTargetId("");
      setReason("");
      fetchData();
    }
    setSubmitting(false);
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-600 text-white">গৃহীত</Badge>;
    if (status === "rejected") return <Badge variant="destructive">প্রত্যাখ্যাত</Badge>;
    return <Badge variant="secondary">অপেক্ষমান</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          অভিযোগ
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-xs">
              <Send className="h-3 w-3 mr-1" /> অভিযোগ দিন
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>অভিযোগ দাখিল করুন</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <p className="text-sm text-muted-foreground mb-1">কার বিরুদ্ধে</p>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger><SelectValue placeholder="কর্মী নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name} ({e.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">অভিযোগের কারণ</p>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="বিস্তারিত লিখুন..."
                  rows={4}
                />
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                {submitting ? "জমা হচ্ছে..." : "অভিযোগ জমা দিন"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {complaints.length === 0 ? (
          <p className="text-sm text-muted-foreground">কোনো অভিযোগ নেই</p>
        ) : (
          <div className="space-y-2">
            {complaints.slice(0, 5).map((c) => (
              <div key={c.id} className="p-3 rounded-lg border bg-muted/30 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{targetNames[c.target_id] || "..."}</span>
                  {statusBadge(c.status)}
                </div>
                <p className="text-muted-foreground text-xs line-clamp-2">{c.reason}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(c.created_at), "dd MMM yyyy", { locale: bn })}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
