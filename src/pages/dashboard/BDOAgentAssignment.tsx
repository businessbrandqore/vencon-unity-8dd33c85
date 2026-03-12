import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Eye, ShieldCheck, Users, Target, Crown } from "lucide-react";
import { format } from "date-fns";

const BDOAgentAssignment = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchApprovals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("sa_approvals")
      .select("*, requester:users!sa_approvals_requested_by_fkey(name, role)")
      .in("type", ["group_creation", "gl_campaign_assignment"])
      .order("created_at", { ascending: false });
    setApprovals(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("bdo-approvals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sa_approvals" }, () => fetchApprovals())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchApprovals]);

  const handleApproveGroup = async (approval: any) => {
    const details = approval.details as any;
    if (!details?.group_leader_id || !details?.member_ids) return;

    const inserts = details.member_ids.map((agentId: string) => ({
      group_leader_id: details.group_leader_id,
      agent_id: agentId,
    }));
    const { error: insertErr } = await supabase.from("group_members").insert(inserts);
    if (insertErr) { toast.error("গ্রুপ তৈরি ব্যর্থ: " + insertErr.message); return; }

    await supabase.from("sa_approvals").update({ status: "approved", decided_by: user?.id }).eq("id", approval.id);

    // Notify TL
    if (details.tl_id) {
      await supabase.rpc("notify_user", {
        _user_id: details.tl_id,
        _title: "গ্রুপ অনুমোদিত ✅",
        _message: `আপনার গ্রুপ (লিডার: ${details.group_leader_name}) অনুমোদিত হয়েছে।`,
        _type: "approval",
      });
    }

    toast.success("গ্রুপ অনুমোদন হয়েছে");
    fetchApprovals();
  };

  const handleApproveGLAssign = async (approval: any) => {
    const details = approval.details as any;
    if (!details?.group_leader_id || !details?.campaign_id || !details?.tl_id) return;

    const { error } = await supabase.from("campaign_agent_roles").insert({
      agent_id: details.group_leader_id,
      campaign_id: details.campaign_id,
      tl_id: details.tl_id,
      is_bronze: false,
      is_silver: false,
    });
    if (error) { toast.error("ক্যাম্পেইন অ্যাসাইনমেন্ট ব্যর্থ: " + error.message); return; }

    await supabase.from("sa_approvals").update({ status: "approved", decided_by: user?.id }).eq("id", approval.id);

    // Notify TL
    if (details.tl_id) {
      await supabase.rpc("notify_user", {
        _user_id: details.tl_id,
        _title: "GL ক্যাম্পেইন অ্যাসাইনমেন্ট অনুমোদিত ✅",
        _message: `${details.group_leader_name} কে ${details.campaign_name} ক্যাম্পেইনে অ্যাসাইন অনুমোদিত হয়েছে।`,
        _type: "approval",
      });
    }

    toast.success("গ্রুপ লিডার ক্যাম্পেইনে অ্যাসাইন হয়েছে");
    fetchApprovals();
  };

  const handleApprove = async (approval: any) => {
    if (approval.type === "group_creation") {
      await handleApproveGroup(approval);
    } else if (approval.type === "gl_campaign_assignment") {
      await handleApproveGLAssign(approval);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    await supabase.from("sa_approvals").update({
      status: "rejected",
      decided_by: user?.id,
      rejection_reason: rejectionReason || null,
    }).eq("id", selectedApproval.id);

    const details = selectedApproval.details as any;
    if (details?.tl_id) {
      const typeLabel = selectedApproval.type === "group_creation" ? "গ্রুপ তৈরি" : "GL ক্যাম্পেইন অ্যাসাইনমেন্ট";
      await supabase.rpc("notify_user", {
        _user_id: details.tl_id,
        _title: `${typeLabel} প্রত্যাখ্যাত ❌`,
        _message: `আপনার অনুরোধ প্রত্যাখ্যাত হয়েছে।${rejectionReason ? ` কারণ: ${rejectionReason}` : ""}`,
        _type: "approval",
      });
    }

    toast.success("প্রত্যাখ্যান করা হয়েছে");
    setShowRejectDialog(false);
    setRejectionReason("");
    setSelectedApproval(null);
    fetchApprovals();
  };

  const filtered = approvals.filter(a => {
    if (tab === "pending") return a.status === "pending";
    return a.status !== "pending";
  });

  const pendingCount = approvals.filter(a => a.status === "pending").length;

  const getTypeIcon = (type: string) => {
    if (type === "group_creation") return <Users className="h-4 w-4 text-amber-500" />;
    return <Target className="h-4 w-4 text-primary" />;
  };

  const getTypeLabel = (type: string) => {
    if (type === "group_creation") return isBn ? "গ্রুপ তৈরি" : "Group Creation";
    if (type === "gl_campaign_assignment") return isBn ? "GL ক্যাম্পেইন অ্যাসাইনমেন্ট" : "GL Campaign Assignment";
    return type;
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {isBn ? "TL অনুরোধ অনুমোদন" : "TL Request Approvals"}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {isBn ? "টিম লিডারদের পাঠানো গ্রুপ তৈরি এবং ক্যাম্পেইন অ্যাসাইনমেন্ট অনুরোধ পরিচালনা করুন" : "Manage group creation and campaign assignment requests from Team Leaders"}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">
            {isBn ? "অপেক্ষমাণ" : "Pending"}
            {pendingCount > 0 && (
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-500">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="decided">{isBn ? "সিদ্ধান্ত নেওয়া" : "Decided"}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">{isBn ? "লোড হচ্ছে..." : "Loading..."}</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>{tab === "pending" ? (isBn ? "কোনো অপেক্ষমাণ অনুরোধ নেই" : "No pending requests") : (isBn ? "কোনো রেকর্ড নেই" : "No records")}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isBn ? "ধরন" : "Type"}</TableHead>
                      <TableHead>{isBn ? "অনুরোধকারী (TL)" : "Requester (TL)"}</TableHead>
                      <TableHead>{isBn ? "বিস্তারিত" : "Details"}</TableHead>
                      <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                      <TableHead>{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                      <TableHead>{isBn ? "অ্যাকশন" : "Action"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(a => {
                      const d = a.details as any;
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(a.type)}
                              <span className="text-sm font-medium">{getTypeLabel(a.type)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{d?.tl_name || a.requester?.name || "—"}</TableCell>
                          <TableCell className="max-w-[250px]">
                            {a.type === "group_creation" ? (
                              <div className="text-sm">
                                <span className="text-muted-foreground">{isBn ? "লিডার:" : "Leader:"} </span>
                                <span className="font-medium">{d?.group_leader_name}</span>
                                <span className="text-muted-foreground ml-2">({(d?.member_names || []).length} {isBn ? "জন" : "members"})</span>
                              </div>
                            ) : (
                              <div className="text-sm">
                                <span className="text-muted-foreground">{isBn ? "GL:" : "GL:"} </span>
                                <span className="font-medium">{d?.group_leader_name}</span>
                                <span className="text-muted-foreground ml-1">→ {d?.campaign_name}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{format(new Date(a.created_at), "dd MMM, HH:mm")}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                a.status === "pending" ? "text-yellow-500 border-yellow-500" :
                                a.status === "approved" ? "text-green-500 border-green-500" :
                                "text-red-500 border-red-500"
                              }
                            >
                              {a.status === "pending" ? <Clock className="h-3 w-3 mr-1" /> :
                               a.status === "approved" ? <CheckCircle className="h-3 w-3 mr-1" /> :
                               <XCircle className="h-3 w-3 mr-1" />}
                              {a.status === "pending" ? (isBn ? "অপেক্ষমাণ" : "Pending") :
                               a.status === "approved" ? (isBn ? "অনুমোদিত" : "Approved") :
                               (isBn ? "প্রত্যাখ্যাত" : "Rejected")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedApproval(a); setShowDetailDialog(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {a.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-500 border-green-500 hover:bg-green-500/10"
                                    onClick={() => handleApprove(a)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />{isBn ? "অনুমোদন" : "Approve"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-500 border-red-500 hover:bg-red-500/10"
                                    onClick={() => { setSelectedApproval(a); setShowRejectDialog(true); }}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />{isBn ? "বাতিল" : "Reject"}
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
            <DialogTitle>{isBn ? "অনুরোধের বিস্তারিত" : "Request Details"}</DialogTitle>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">{isBn ? "ধরন:" : "Type:"}</span>{" "}
                <Badge variant="secondary">{getTypeLabel(selectedApproval.type)}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">{isBn ? "অনুরোধকারী:" : "Requester:"}</span>{" "}
                <span className="font-medium">{selectedApproval.details?.tl_name || "—"}</span>
              </div>
              {selectedApproval.type === "group_creation" && (
                <>
                  <div>
                    <span className="text-muted-foreground">{isBn ? "গ্রুপ লিডার:" : "Group Leader:"}</span>{" "}
                    <span className="font-medium flex items-center gap-1 inline-flex">
                      <Crown className="h-3 w-3 text-amber-500" />
                      {selectedApproval.details?.group_leader_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{isBn ? "মেম্বার:" : "Members:"}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(selectedApproval.details?.member_names || []).map((name: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {selectedApproval.type === "gl_campaign_assignment" && (
                <>
                  <div>
                    <span className="text-muted-foreground">{isBn ? "গ্রুপ লিডার:" : "Group Leader:"}</span>{" "}
                    <span className="font-medium">{selectedApproval.details?.group_leader_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{isBn ? "ক্যাম্পেইন:" : "Campaign:"}</span>{" "}
                    <span className="font-medium">{selectedApproval.details?.campaign_name}</span>
                  </div>
                </>
              )}
              <div>
                <span className="text-muted-foreground">{isBn ? "তারিখ:" : "Date:"}</span>{" "}
                <span>{format(new Date(selectedApproval.created_at), "dd MMM yyyy, HH:mm")}</span>
              </div>
              {selectedApproval.rejection_reason && (
                <div>
                  <span className="text-muted-foreground">{isBn ? "প্রত্যাখ্যানের কারণ:" : "Rejection reason:"}</span>{" "}
                  <span className="text-red-400">{selectedApproval.rejection_reason}</span>
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
            <DialogTitle>{isBn ? "প্রত্যাখ্যান করুন" : "Reject Request"}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={isBn ? "প্রত্যাখ্যানের কারণ (ঐচ্ছিক)" : "Rejection reason (optional)"}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>{isBn ? "বাতিল" : "Cancel"}</Button>
            <Button variant="destructive" onClick={handleReject}>{isBn ? "প্রত্যাখ্যান করুন" : "Reject"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BDOAgentAssignment;
