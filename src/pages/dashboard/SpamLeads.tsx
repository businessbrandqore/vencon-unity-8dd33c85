import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ShieldBan, RotateCcw, Trash2 } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface SpamLead {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  status: string | null;
  agent_type: string | null;
  created_at: string | null;
}

export default function SpamLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<SpamLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadSpamLeads = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, phone, address, status, agent_type, created_at")
      .eq("assigned_to", user.id)
      .eq("is_spam", true)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("স্প্যাম লিড লোড করা যায়নি");
    }
    setLeads((data as SpamLead[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSpamLeads();
  }, [loadSpamLeads]);

  const handleRestore = async (leadId: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ is_spam: false, status: "fresh" } as any)
      .eq("id", leadId);
    if (error) {
      toast.error("রিস্টোর করা যায়নি");
      console.error(error);
      return;
    }
    toast.success("লিড রিস্টোর হয়েছে ✓");
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("leads").delete().eq("id", deleteId);
    if (error) {
      toast.error("ডিলিট করা যায়নি");
      console.error(error);
    } else {
      toast.success("লিড ডিলিট হয়েছে");
      setLeads((prev) => prev.filter((l) => l.id !== deleteId));
    }
    setDeleteId(null);
  };

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldBan className="h-5 w-5 text-destructive" />
        <h2 className="font-heading text-xl font-bold text-foreground">স্প্যাম</h2>
        <span className="text-sm text-muted-foreground">({leads.length})</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <EmptyState icon={<ShieldBan className="h-10 w-10" />} message="স্প্যাম হিসেবে চিহ্নিত লিডগুলো এখানে দেখাবে" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>নাম</TableHead>
                    <TableHead>ফোন</TableHead>
                    <TableHead>ঠিকানা</TableHead>
                    <TableHead>স্ট্যাটাস</TableHead>
                    <TableHead>তারিখ</TableHead>
                    <TableHead className="text-right">অ্যাকশন</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                      <TableCell>{lead.phone || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{lead.address || "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{lead.status || "—"}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString("bn-BD") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRestore(lead.id)}>
                            <RotateCcw className="h-3 w-3 mr-1" /> রিস্টোর
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setDeleteId(lead.id)}>
                            <Trash2 className="h-3 w-3 mr-1" /> ডিলিট
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="লিড ডিলিট করুন"
        description="এই লিডটি চিরতরে মুছে ফেলা হবে। আপনি কি নিশ্চিত?"
        onConfirm={handleDelete}
        confirmLabel="ডিলিট"
        destructive
      />
    </div>
  );
}
