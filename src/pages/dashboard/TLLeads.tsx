import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Agent { id: string; name: string; }
interface Lead { id: string; name: string | null; phone: string | null; address: string | null; created_at: string | null; status: string | null; requeue_count: number | null; updated_at: string | null; }
interface Order { id: string; customer_name: string | null; phone: string | null; product: string | null; agent_id: string | null; created_at: string | null; status: string | null; cs_note: string | null; cs_rating: string | null; agent?: { name: string }; }
interface PreOrder { id: string; lead_id: string | null; scheduled_date: string | null; agent_id: string | null; note: string | null; status: string | null; lead?: { name: string | null; phone: string | null; }; agent?: { name: string; }; }

const TLLeads = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [campaigns, setCampaigns] = useState<{ id: string; name: string; data_mode: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [campaignMode, setCampaignMode] = useState<string>("lead");
  const [bronzeAgents, setBronzeAgents] = useState<Agent[]>([]);
  const [silverAgents, setSilverAgents] = useState<Agent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);

  const [freshLeads, setFreshLeads] = useState<Lead[]>([]);
  const [csoOrders, setCsoOrders] = useState<Order[]>([]);
  const [callDoneOrders, setCallDoneOrders] = useState<Order[]>([]);
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [deleteSheetLeads, setDeleteSheetLeads] = useState<Lead[]>([]);
  // Processing mode data
  const [processingLeads, setProcessingLeads] = useState<Lead[]>([]);

  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [silverAssignments, setSilverAssignments] = useState<Record<string, string>>({});
  const [processingAssignments, setProcessingAssignments] = useState<Record<string, string>>({});
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkAgent, setBulkAgent] = useState("");
  const [selectedDeleteLeads, setSelectedDeleteLeads] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase.from("campaign_tls").select("campaign_id, campaigns(id, name, data_mode)").eq("tl_id", user.id);
      if (data) {
        const list = data.map((d: any) => d.campaigns).filter(Boolean).map((c: any) => ({ id: c.id, name: c.name, data_mode: c.data_mode || "lead" }));
        setCampaigns(list);
        if (list.length > 0 && !selectedCampaign) {
          setSelectedCampaign(list[0].id);
          setCampaignMode(list[0].data_mode);
        }
      }
    };
    fetch();
  }, [user]);

  useEffect(() => {
    const c = campaigns.find((x) => x.id === selectedCampaign);
    if (c) setCampaignMode(c.data_mode);
  }, [selectedCampaign, campaigns]);

  const loadAgents = useCallback(async () => {
    if (!user || !selectedCampaign) return;
    const { data: roles } = await supabase
      .from("campaign_agent_roles")
      .select("agent_id, is_bronze, is_silver, users!campaign_agent_roles_agent_id_fkey(id, name)")
      .eq("campaign_id", selectedCampaign).eq("tl_id", user.id);
    if (roles) {
      const bronze: Agent[] = [], silver: Agent[] = [], all: Agent[] = [];
      roles.forEach((r: any) => {
        const agent = { id: r.users.id, name: r.users.name };
        all.push(agent);
        if (r.is_bronze) bronze.push(agent);
        if (r.is_silver) silver.push(agent);
      });
      setBronzeAgents(bronze); setSilverAgents(silver); setAllAgents(all);
    }
  }, [user, selectedCampaign]);

  const loadData = useCallback(async () => {
    if (!user || !selectedCampaign) return;

    const { data: fresh } = await supabase.from("leads").select("*")
      .eq("campaign_id", selectedCampaign).eq("tl_id", user.id)
      .is("assigned_to", null).eq("status", "fresh").order("created_at", { ascending: false });
    setFreshLeads(fresh || []);

    const { data: cso } = await supabase.from("orders").select("*, agent:users!orders_agent_id_fkey(name)")
      .eq("tl_id", user.id).eq("status", "pending_cso").order("created_at", { ascending: false });
    setCsoOrders(cso || []);

    const { data: callDone } = await supabase.from("orders").select("*, agent:users!orders_agent_id_fkey(name)")
      .eq("tl_id", user.id).eq("status", "call_done").order("created_at", { ascending: false });
    setCallDoneOrders(callDone || []);

    const { data: pre } = await supabase.from("pre_orders").select("*, lead:leads(name, phone), agent:users!pre_orders_agent_id_fkey(name)")
      .eq("tl_id", user.id).eq("status", "pending").order("created_at", { ascending: false });
    setPreOrders(pre || []);

    const { data: del } = await supabase.from("leads").select("*")
      .eq("campaign_id", selectedCampaign).eq("tl_id", user.id)
      .gte("requeue_count", 5).order("updated_at", { ascending: false });
    setDeleteSheetLeads(del || []);

    // Processing leads (status = 'processing' or data_mode campaigns)
    if (campaignMode === "processing") {
      const { data: proc } = await supabase.from("leads").select("*")
        .eq("campaign_id", selectedCampaign).eq("tl_id", user.id)
        .is("assigned_to", null).order("created_at", { ascending: false });
      setProcessingLeads(proc || []);
    }
  }, [user, selectedCampaign, campaignMode]);

  useEffect(() => { loadAgents(); loadData(); }, [loadAgents, loadData]);

  const assignLead = async (leadId: string, agentId: string) => {
    await supabase.from("leads").update({ assigned_to: agentId, status: "assigned", agent_type: "bronze" }).eq("id", leadId);
    toast.success(isBn ? "Lead assign করা হয়েছে" : "Lead assigned"); loadData();
  };

  const bulkAssign = async () => {
    if (!bulkAgent || selectedLeads.size === 0) return;
    const ids = Array.from(selectedLeads);
    for (const id of ids) {
      await supabase.from("leads").update({ assigned_to: bulkAgent, status: "assigned", agent_type: "bronze" }).eq("id", id);
    }
    toast.success(isBn ? `${ids.length}টি lead assign হয়েছে` : `${ids.length} leads assigned`);
    setSelectedLeads(new Set()); setBulkAgent(""); loadData();
  };

  const assignSilver = async (orderId: string, agentId: string) => {
    await supabase.from("orders").update({ status: "silver_assigned", agent_id: agentId }).eq("id", orderId);
    toast.success(isBn ? "Silver agent assign হয়েছে" : "Silver agent assigned"); loadData();
  };

  // Processing: assign to any agent for direct handling
  const assignProcessing = async (leadId: string, agentId: string) => {
    await supabase.from("leads").update({ assigned_to: agentId, status: "processing_assigned" }).eq("id", leadId);
    toast.success(isBn ? "Processing data assign হয়েছে" : "Processing data assigned"); loadData();
  };

  const convertPreOrder = async (po: PreOrder) => {
    if (!po.lead_id) return;
    await supabase.from("pre_orders").update({ status: "converted" }).eq("id", po.id);
    toast.success(isBn ? "Regular order-এ convert হয়েছে" : "Converted"); loadData();
  };

  const deletePreOrder = async (id: string) => {
    await supabase.from("pre_orders").update({ status: "deleted" }).eq("id", id);
    toast.success(isBn ? "Pre-order delete হয়েছে" : "Pre-order deleted"); loadData();
  };

  const confirmDeleteLead = async () => {
    if (deleteTarget) {
      await supabase.from("leads").delete().eq("id", deleteTarget);
      toast.success(isBn ? "Lead delete হয়েছে" : "Lead deleted");
    }
    setDeleteTarget(null); setDeleteConfirmOpen(false); loadData();
  };

  const bulkDeleteLeads = async () => {
    const ids = Array.from(selectedDeleteLeads);
    for (const id of ids) { await supabase.from("leads").delete().eq("id", id); }
    toast.success(isBn ? `${ids.length}টি lead delete হয়েছে` : `${ids.length} leads deleted`);
    setSelectedDeleteLeads(new Set()); loadData();
  };

  const reassignLead = async (leadId: string, agentId: string) => {
    await supabase.from("leads").update({ assigned_to: agentId, status: "assigned", requeue_count: 0 }).eq("id", leadId);
    toast.success(isBn ? "Lead reassign হয়েছে" : "Lead reassigned"); loadData();
  };

  if (!user) return null;

  const isProcessing = campaignMode === "processing";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {isBn ? "Lead Management" : "Lead Management"}
          </h2>
          {isProcessing && (
            <Badge variant="outline" className="mt-1 border-primary/30 text-primary">
              {isBn ? "⚙️ প্রসেসিং মোড — Agent ছাড়া সরাসরি অপারেশন" : "⚙️ Processing Mode — Direct operation without Agent"}
            </Badge>
          )}
        </div>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-64 border-primary/30">
            <SelectValue placeholder={isBn ? "Campaign নির্বাচন করুন" : "Select Campaign"} />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} {c.data_mode === "processing" ? "⚙️" : "🎯"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Flow Visualization */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-body">
            {isProcessing ? (
              <>
                {["WordPress", "TL", "CSO", "Warehouse", "Steadfast", "Delivery", "CS"].map((step, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="px-2 py-1 rounded-md bg-card border border-border text-foreground font-medium">{step}</span>
                    {i < 6 && <span className="text-primary font-bold">→</span>}
                  </span>
                ))}
                <span className="text-primary ml-1">🔄</span>
              </>
            ) : (
              <>
                {["WordPress", "TL", "Bronze", "CSO", "Warehouse", "Steadfast", "Delivery", "CS", "Silver"].map((step, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="px-2 py-1 rounded-md bg-card border border-border text-foreground font-medium">{step}</span>
                    {i < 8 && <span className="text-primary font-bold">→</span>}
                  </span>
                ))}
                <span className="text-primary ml-1">🔄</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={isProcessing ? "processing" : "assign"} className="space-y-4">
        <TabsList className="bg-card border border-border flex-wrap h-auto gap-1 p-1">
          {isProcessing ? (
            <TabsTrigger value="processing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {isBn ? "প্রসেসিং ডাটা" : "Processing Data"} ({processingLeads.length})
            </TabsTrigger>
          ) : (
            <TabsTrigger value="assign" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {isBn ? "Lead Assign" : "Assign Leads"} ({freshLeads.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="cso" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            CSO Pending ({csoOrders.length})
          </TabsTrigger>
          <TabsTrigger value="calldone" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Call Done ({callDoneOrders.length})
          </TabsTrigger>
          {!isProcessing && (
            <>
              <TabsTrigger value="preorders" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Pre-Orders ({preOrders.length})
              </TabsTrigger>
              <TabsTrigger value="deletesheet" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Delete Sheet ({deleteSheetLeads.length})
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Processing Tab */}
        {isProcessing && (
          <TabsContent value="processing">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-heading">
                  {isBn ? "প্রসেসিং ডাটা — যেকোনো Agent-কে assign করুন" : "Processing Data — Assign to any Agent"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead>{isBn ? "ঠিকানা" : "Address"}</TableHead>
                      <TableHead>{isBn ? "Assign To" : "Assign To"}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processingLeads.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{isBn ? "কোনো প্রসেসিং ডাটা নেই" : "No processing data"}</TableCell></TableRow>
                    ) : processingLeads.map((lead, i) => (
                      <TableRow key={lead.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                        <TableCell>{lead.phone || "—"}</TableCell>
                        <TableCell>{lead.address || "—"}</TableCell>
                        <TableCell>
                          <Select value={processingAssignments[lead.id] || ""} onValueChange={(v) => setProcessingAssignments(p => ({ ...p, [lead.id]: v }))}>
                            <SelectTrigger className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>{allAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" disabled={!processingAssignments[lead.id]} onClick={() => assignProcessing(lead.id, processingAssignments[lead.id])} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            {isBn ? "সেভ" : "Save"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Lead Assign Tab */}
        {!isProcessing && (
          <TabsContent value="assign">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-heading">{isBn ? "Bronze Agent-এ Lead Assign করুন" : "Assign Leads to Bronze Agents"}</CardTitle>
                {selectedLeads.size > 0 && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-sm text-muted-foreground">{selectedLeads.size} {isBn ? "টি নির্বাচিত" : "selected"}</span>
                    <Select value={bulkAgent} onValueChange={setBulkAgent}>
                      <SelectTrigger className="w-48"><SelectValue placeholder={isBn ? "Agent নির্বাচন" : "Select Agent"} /></SelectTrigger>
                      <SelectContent>{bronzeAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button onClick={bulkAssign} disabled={!bulkAgent} className="bg-primary text-primary-foreground">Apply</Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={selectedLeads.size === freshLeads.length && freshLeads.length > 0}
                          onCheckedChange={(v) => setSelectedLeads(v ? new Set(freshLeads.map(l => l.id)) : new Set())} />
                      </TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead>{isBn ? "শহর" : "City"}</TableHead>
                      <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                      <TableHead>Assign To</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freshLeads.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{isBn ? "কোনো নতুন lead নেই" : "No new leads"}</TableCell></TableRow>
                    ) : freshLeads.map((lead, i) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Checkbox checked={selectedLeads.has(lead.id)}
                            onCheckedChange={(v) => { const next = new Set(selectedLeads); v ? next.add(lead.id) : next.delete(lead.id); setSelectedLeads(next); }} />
                        </TableCell>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                        <TableCell>{lead.phone || "—"}</TableCell>
                        <TableCell>{lead.address || "—"}</TableCell>
                        <TableCell>{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>
                          <Select value={assignments[lead.id] || ""} onValueChange={(v) => setAssignments(p => ({ ...p, [lead.id]: v }))}>
                            <SelectTrigger className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>{bronzeAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" disabled={!assignments[lead.id]} onClick={() => assignLead(lead.id, assignments[lead.id])} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            {isBn ? "সেভ" : "Save"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* CSO Pending */}
        <TabsContent value="cso">
          <Card>
            <CardHeader><CardTitle className="text-lg font-heading">CSO Pending</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>{isBn ? "গ্রাহক" : "Customer"}</TableHead>
                    <TableHead>{isBn ? "পণ্য" : "Product"}</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>{isBn ? "সময়" : "Time"}</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csoOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{isBn ? "কোনো pending order নেই" : "No pending orders"}</TableCell></TableRow>
                  ) : csoOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                      <TableCell>{o.customer_name || "—"}</TableCell>
                      <TableCell>{o.product || "—"}</TableCell>
                      <TableCell>{(o as any).agent?.name || "—"}</TableCell>
                      <TableCell>{o.created_at ? new Date(o.created_at).toLocaleString() : "—"}</TableCell>
                      <TableCell><Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pending CSO</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Call Done */}
        <TabsContent value="calldone">
          <Card>
            <CardHeader><CardTitle className="text-lg font-heading">Call Done Queue</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>{isBn ? "গ্রাহক" : "Customer"}</TableHead>
                    <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                    <TableHead>{isBn ? "পণ্য" : "Product"}</TableHead>
                    <TableHead>CS Note</TableHead>
                    <TableHead>CS Rating</TableHead>
                    {!isProcessing && <TableHead>Silver Agent</TableHead>}
                    {!isProcessing && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callDoneOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={isProcessing ? 6 : 8} className="text-center text-muted-foreground py-8">{isBn ? "কোনো call done order নেই" : "No call done orders"}</TableCell></TableRow>
                  ) : callDoneOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                      <TableCell>{o.customer_name || "—"}</TableCell>
                      <TableCell>{o.phone || "—"}</TableCell>
                      <TableCell>{o.product || "—"}</TableCell>
                      <TableCell>{o.cs_note || "—"}</TableCell>
                      <TableCell>{o.cs_rating || "—"}</TableCell>
                      {!isProcessing && (
                        <>
                          <TableCell>
                            <Select value={silverAssignments[o.id] || ""} onValueChange={(v) => setSilverAssignments(p => ({ ...p, [o.id]: v }))}>
                              <SelectTrigger className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>{silverAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" disabled={!silverAssignments[o.id]} onClick={() => assignSilver(o.id, silverAssignments[o.id])} className="bg-primary text-primary-foreground hover:bg-primary/90">
                              {isBn ? "সেভ" : "Save"}
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pre-Orders */}
        {!isProcessing && (
          <TabsContent value="preorders">
            <Card>
              <CardHeader><CardTitle className="text-lg font-heading">Pre-Orders</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isBn ? "গ্রাহক" : "Customer"}</TableHead>
                      <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>{isBn ? "নোট" : "Note"}</TableHead>
                      <TableHead>{isBn ? "অ্যাকশন" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{isBn ? "কোনো pre-order নেই" : "No pre-orders"}</TableCell></TableRow>
                    ) : preOrders.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell>{(po as any).lead?.name || "—"}</TableCell>
                        <TableCell>{(po as any).lead?.phone || "—"}</TableCell>
                        <TableCell>{po.scheduled_date || "—"}</TableCell>
                        <TableCell>{(po as any).agent?.name || "—"}</TableCell>
                        <TableCell className="max-w-48 truncate">{po.note || "—"}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => convertPreOrder(po)} className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10">Convert</Button>
                          <Button size="sm" variant="outline" onClick={() => deletePreOrder(po.id)} className="border-destructive text-destructive hover:bg-destructive/10">Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Delete Sheet */}
        {!isProcessing && (
          <TabsContent value="deletesheet">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-heading">TL Delete Sheet</CardTitle>
                {selectedDeleteLeads.size > 0 && (
                  <Button size="sm" variant="destructive" onClick={bulkDeleteLeads} className="mt-2 w-fit">
                    {isBn ? `Delete (${selectedDeleteLeads.size})` : `Delete all (${selectedDeleteLeads.size})`}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={selectedDeleteLeads.size === deleteSheetLeads.length && deleteSheetLeads.length > 0}
                          onCheckedChange={(v) => setSelectedDeleteLeads(v ? new Set(deleteSheetLeads.map(l => l.id)) : new Set())} />
                      </TableHead>
                      <TableHead>{isBn ? "গ্রাহক" : "Customer"}</TableHead>
                      <TableHead>{isBn ? "ফোন" : "Phone"}</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requeue</TableHead>
                      <TableHead>{isBn ? "শেষ Activity" : "Last Activity"}</TableHead>
                      <TableHead>{isBn ? "অ্যাকশন" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deleteSheetLeads.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{isBn ? "কোনো delete sheet lead নেই" : "No delete sheet leads"}</TableCell></TableRow>
                    ) : deleteSheetLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Checkbox checked={selectedDeleteLeads.has(lead.id)}
                            onCheckedChange={(v) => { const next = new Set(selectedDeleteLeads); v ? next.add(lead.id) : next.delete(lead.id); setSelectedDeleteLeads(next); }} />
                        </TableCell>
                        <TableCell>{lead.name || "—"}</TableCell>
                        <TableCell>{lead.phone || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{lead.status}</Badge></TableCell>
                        <TableCell className="text-center">{lead.requeue_count}</TableCell>
                        <TableCell>{lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="space-x-2">
                          <Select onValueChange={(agentId) => reassignLead(lead.id, agentId)}>
                            <SelectTrigger className="w-36 inline-flex"><SelectValue placeholder="Reassign" /></SelectTrigger>
                            <SelectContent>{allAgents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button size="sm" variant="destructive" onClick={() => { setDeleteTarget(lead.id); setDeleteConfirmOpen(true); }}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{isBn ? "নিশ্চিত করুন" : "Confirm Delete"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{isBn ? "এই lead স্থায়ীভাবে delete হবে। আপনি কি নিশ্চিত?" : "This lead will be permanently deleted. Are you sure?"}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>{isBn ? "বাতিল" : "Cancel"}</Button>
            <Button variant="destructive" onClick={confirmDeleteLead}>{isBn ? "Delete" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TLLeads;
