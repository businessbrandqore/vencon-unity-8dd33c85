import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { format } from "date-fns";

interface ATLApproval {
  id: string;
  atl_id: string;
  tl_id: string;
  action_type: string;
  action_data: any;
  status: string;
  rejection_reason: string | null;
  decided_at: string | null;
  created_at: string;
  atl_user?: { name: string };
}

const actionTypeLabels: Record<string, { bn: string; en: string }> = {
  lead_assign: { bn: "লিড অ্যাসাইন", en: "Lead Assignment" },
  data_distribute: { bn: "ডাটা ডিস্ট্রিবিউশন", en: "Data Distribution" },
  group_create: { bn: "গ্রুপ তৈরি", en: "Group Creation" },
  order_action: { bn: "অর্ডার অ্যাকশন", en: "Order Action" },
  data_request_respond: { bn: "ডাটা রিকোয়েস্ট রেসপন্স", en: "Data Request Response" },
  lead_delete: { bn: "লিড ডিলিট", en: "Lead Delete" },
  lead_requeue: { bn: "লিড রিকিউ", en: "Lead Requeue" },
  group_member_change: { bn: "গ্রুপ মেম্বার পরিবর্তন", en: "Group Member Change" },
  general: { bn: "সাধারণ অপারেশন", en: "General Operation" },
};

const TLATLApprovals = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";
  const isATL = user?.role === "Assistant Team Leader";

  const [approvals, setApprovals] = useState<ATLApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ATLApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [tab, setTab] = useState("pending");

  const fetchApprovals = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("atl_approvals" as any)
      .select("*, atl_user:users!atl_approvals_atl_id_fkey(name)")
      .order("created_at", { ascending: false });

    if (isATL) {
      query = query.eq("atl_id", user.id);
    } else {
      query = query.eq("tl_id", user.id);
    }

    const { data, error } = await query;
    if (!error && data) {
      setApprovals(data as any);
    }
    setLoading(false);
  }, [user, isATL]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("atl-approvals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "atl_approvals" }, () => fetchApprovals())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchApprovals]);

  const handleApprove = async (approval: ATLApproval) => {
    const { error } = await supabase
      .from("atl_approvals" as any)
      .update({ status: "approved", decided_at: new Date().toISOString() } as any)
      .eq("id", approval.id);

    if (error) {
      toast.error("এপ্রোভ করতে সমস্যা হয়েছে");
      return;
    }

    // Notify ATL
    await supabase.rpc("notify_user", {
      _user_id: approval.atl_id,
      _title: "এপ্রোভাল গৃহীত ✅",
      _message: `আপনার "${actionTypeLabels[approval.action_type]?.bn || approval.action_type}" রিকোয়েস্ট এপ্রোভ হয়েছে। এখন আপনি অপারেশনটি সম্পন্ন করতে পারবেন।`,
      _type: "approval",
    });

    toast.success("এপ্রোভ করা হয়েছে");
    fetchApprovals();
  };

  const handleReject = async () => {
    if (!selectedApproval) return;

    const { error } = await supabase
      .from("atl_approvals" as any)
      .update({
        status: "rejected",
        rejection_reason: rejectionReason || null,
        decided_at: new Date().toISOString(),
      } as any)
      .eq("id", selectedApproval.id);

    if (error) {
      toast.error("রিজেক্ট করতে সমস্যা হয়েছে");
      return;
    }

    // Notify ATL
    await supabase.rpc("notify_user", {
      _user_id: selectedApproval.atl_id,
      _title: "এপ্রোভাল প্রত্যাখ্যাত ❌",
      _message: `আপনার "${actionTypeLabels[selectedApproval.action_type]?.bn || selectedApproval.action_type}" রিকোয়েস্ট প্রত্যাখ্যাত হয়েছে।${rejectionReason ? ` কারণ: ${rejectionReason}` : ""}`,
      _type: "approval",
    });

    toast.success("রিজেক্ট করা হয়েছে");
    setShowRejectDialog(false);
    setRejectionReason("");
    setSelectedApproval(null);
    fetchApprovals();
  };

  const filteredApprovals = approvals.filter((a) => {
    if (tab === "pending") return a.status === "pending";
    if (tab === "decided") return a.status !== "pending";
    return true;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="h-3 w-3 mr-1" />{isBn ? "অপেক্ষমাণ" : "Pending"}</Badge>;
      case "approved":
        return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle className="h-3 w-3 mr-1" />{isBn ? "এপ্রোভড" : "Approved"}</Badge>;
      case "rejected":
        return <Badge variant="outline" className="text-red-500 border-red-500"><XCircle className="h-3 w-3 mr-1" />{isBn ? "প্রত্যাখ্যাত" : "Rejected"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isATL ? (isBn ? "আমার এপ্রোভাল রিকোয়েস্ট" : "My Approval Requests") : (isBn ? "ATL এপ্রোভাল" : "ATL Approvals")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isATL
            ? (isBn ? "আপনার পাঠানো এপ্রোভাল রিকোয়েস্টের স্ট্যাটাস দেখুন" : "View status of your approval requests")
            : (isBn ? "ATL এর পাঠানো অপারেশন এপ্রোভাল রিকোয়েস্ট ম্যানেজ করুন" : "Manage ATL operation approval requests")}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">
            {isBn ? "অপেক্ষমাণ" : "Pending"}
            {approvals.filter((a) => a.status === "pending").length > 0 && (
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-500">{approvals.filter((a) => a.status === "pending").length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="decided">{isBn ? "সিদ্ধান্ত নেওয়া" : "Decided"}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">{isBn ? "লোড হচ্ছে..." : "Loading..."}</div>
              ) : filteredApprovals.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {tab === "pending" ? (isBn ? "কোনো অপেক্ষমাণ রিকোয়েস্ট নেই" : "No pending requests") : (isBn ? "কোনো রেকর্ড নেই" : "No records")}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {!isATL && <TableHead>{isBn ? "ATL নাম" : "ATL Name"}</TableHead>}
                      <TableHead>{isBn ? "অপারেশন" : "Operation"}</TableHead>
                      <TableHead>{isBn ? "বিবরণ" : "Description"}</TableHead>
                      <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                      <TableHead>{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                      <TableHead>{isBn ? "অ্যাকশন" : "Action"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApprovals.map((approval) => (
                      <TableRow key={approval.id}>
                        {!isATL && <TableCell className="font-medium">{(approval as any).atl_user?.name || "—"}</TableCell>}
                        <TableCell>
                          <Badge variant="secondary">
                            {isBn ? (actionTypeLabels[approval.action_type]?.bn || approval.action_type) : (actionTypeLabels[approval.action_type]?.en || approval.action_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {approval.action_data?.description || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(approval.created_at), "dd MMM, HH:mm")}</TableCell>
                        <TableCell>{statusBadge(approval.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setSelectedApproval(approval); setShowDetailDialog(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!isATL && approval.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-500 border-green-500 hover:bg-green-500/10"
                                  onClick={() => handleApprove(approval)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />{isBn ? "এপ্রোভ" : "Approve"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-500 border-red-500 hover:bg-red-500/10"
                                  onClick={() => { setSelectedApproval(approval); setShowRejectDialog(true); }}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />{isBn ? "রিজেক্ট" : "Reject"}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isBn ? "রিকোয়েস্ট বিস্তারিত" : "Request Details"}</DialogTitle>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-3 text-sm">
              {!isATL && (
                <div>
                  <span className="text-muted-foreground">{isBn ? "ATL:" : "ATL:"}</span>{" "}
                  <span className="font-medium">{(selectedApproval as any).atl_user?.name || "—"}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">{isBn ? "অপারেশন:" : "Operation:"}</span>{" "}
                <Badge variant="secondary">
                  {isBn ? (actionTypeLabels[selectedApproval.action_type]?.bn || selectedApproval.action_type) : (actionTypeLabels[selectedApproval.action_type]?.en || selectedApproval.action_type)}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">{isBn ? "বিবরণ:" : "Description:"}</span>{" "}
                <span>{selectedApproval.action_data?.description || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{isBn ? "তারিখ:" : "Date:"}</span>{" "}
                <span>{format(new Date(selectedApproval.created_at), "dd MMM yyyy, HH:mm")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{isBn ? "স্ট্যাটাস:" : "Status:"}</span>{" "}
                {statusBadge(selectedApproval.status)}
              </div>
              {selectedApproval.rejection_reason && (
                <div>
                  <span className="text-muted-foreground">{isBn ? "প্রত্যাখ্যানের কারণ:" : "Rejection reason:"}</span>{" "}
                  <span className="text-red-400">{selectedApproval.rejection_reason}</span>
                </div>
              )}
              {selectedApproval.action_data && (
                <div>
                  <span className="text-muted-foreground">{isBn ? "ডাটা:" : "Data:"}</span>
                  <pre className="mt-1 p-2 bg-secondary rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedApproval.action_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isBn ? "রিজেক্ট করুন" : "Reject Request"}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={isBn ? "প্রত্যাখ্যানের কারণ (ঐচ্ছিক)" : "Rejection reason (optional)"}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>{isBn ? "বাতিল" : "Cancel"}</Button>
            <Button variant="destructive" onClick={handleReject}>{isBn ? "রিজেক্ট করুন" : "Reject"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TLATLApprovals;
