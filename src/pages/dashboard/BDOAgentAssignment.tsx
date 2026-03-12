import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, UserPlus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Campaign { id: string; name: string; }
interface TL { id: string; name: string; }
interface Employee { id: string; name: string; role: string; }
interface AgentRole { id: string; agent_id: string; tl_id: string; is_bronze: boolean; is_silver: boolean; agent_name: string; tl_name: string; }

const BDOAgentAssignment = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [tls, setTLs] = useState<TL[]>([]);
  const [selectedTL, setSelectedTL] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignedAgents, setAssignedAgents] = useState<AgentRole[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [assignAsBronze, setAssignAsBronze] = useState(true);
  const [assignAsSilver, setAssignAsSilver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Load campaigns
  useEffect(() => {
    if (!user) return;
    const fetchCampaigns = async () => {
      const { data } = await supabase.from("campaigns").select("id, name").eq("status", "active").order("name");
      if (data) setCampaigns(data);
    };
    fetchCampaigns();
  }, [user]);

  // Load TLs for selected campaign
  useEffect(() => {
    if (!selectedCampaign) { setTLs([]); setSelectedTL(""); return; }
    const fetchTLs = async () => {
      const { data } = await supabase
        .from("campaign_tls")
        .select("tl_id, users!campaign_tls_tl_id_fkey(id, name)")
        .eq("campaign_id", selectedCampaign);
      if (data) {
        const tlList = data.map((d: any) => ({ id: d.users.id, name: d.users.name }));
        setTLs(tlList);
        if (tlList.length > 0) setSelectedTL(tlList[0].id);
      }
    };
    fetchTLs();
  }, [selectedCampaign]);

  // Load assigned agents for campaign
  const loadAssignedAgents = useCallback(async () => {
    if (!selectedCampaign) return;
    const { data } = await supabase
      .from("campaign_agent_roles")
      .select("id, agent_id, tl_id, is_bronze, is_silver, users!campaign_agent_roles_agent_id_fkey(name), tl:users!campaign_agent_roles_tl_id_fkey(name)")
      .eq("campaign_id", selectedCampaign);
    if (data) {
      setAssignedAgents(data.map((d: any) => ({
        id: d.id,
        agent_id: d.agent_id,
        tl_id: d.tl_id,
        is_bronze: d.is_bronze,
        is_silver: d.is_silver,
        agent_name: d.users?.name || "Unknown",
        tl_name: d.tl?.name || "Unknown",
      })));
    }
  }, [selectedCampaign]);

  // Load all employee panel users (potential agents)
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from("users")
        .select("id, name, role")
        .eq("panel", "employee")
        .eq("is_active", true)
        .in("role", ["telesales_executive", "assistant_team_leader", "group_leader"])
        .order("name");
      if (data) setEmployees(data);
    };
    fetchEmployees();
  }, []);

  useEffect(() => { loadAssignedAgents(); }, [loadAssignedAgents]);

  const assignedIds = new Set(assignedAgents.filter(a => a.tl_id === selectedTL).map(a => a.agent_id));

  const filteredEmployees = employees.filter(e =>
    !assignedIds.has(e.id) &&
    (searchQuery === "" || e.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const assignAgents = async () => {
    if (!selectedCampaign || !selectedTL || selectedEmployees.size === 0) return;
    setSaving(true);
    const rows = Array.from(selectedEmployees).map(agentId => ({
      campaign_id: selectedCampaign,
      tl_id: selectedTL,
      agent_id: agentId,
      is_bronze: assignAsBronze,
      is_silver: assignAsSilver,
    }));
    const { error } = await supabase.from("campaign_agent_roles").insert(rows);
    if (error) {
      toast.error(isBn ? "এজেন্ট অ্যাসাইন করতে ব্যর্থ" : "Failed to assign agents");
    } else {
      toast.success(isBn ? `${rows.length}জন এজেন্ট অ্যাসাইন হয়েছে` : `${rows.length} agents assigned`);
      setSelectedEmployees(new Set());
      loadAssignedAgents();
    }
    setSaving(false);
  };

  const removeAgent = async (roleId: string) => {
    const { error } = await supabase.from("campaign_agent_roles").delete().eq("id", roleId);
    if (error) {
      toast.error(isBn ? "রিমুভ করতে ব্যর্থ" : "Failed to remove");
    } else {
      toast.success(isBn ? "এজেন্ট রিমুভ হয়েছে" : "Agent removed");
      loadAssignedAgents();
    }
  };

  const toggleRole = async (roleId: string, field: "is_bronze" | "is_silver", value: boolean) => {
    const { error } = await supabase.from("campaign_agent_roles").update({ [field]: value }).eq("id", roleId);
    if (error) {
      toast.error(isBn ? "আপডেট করতে ব্যর্থ" : "Failed to update");
    } else {
      loadAssignedAgents();
    }
  };

  const roleLabel = (role: string) => {
    const key = `role_${role}` as any;
    return t(key) || role;
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "এজেন্ট অ্যাসাইনমেন্ট" : "Agent Assignment"}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {isBn ? "ক্যাম্পেইনে এজেন্টদের Bronze/Silver হিসেবে অ্যাসাইন করুন" : "Assign agents as Bronze/Silver to campaigns"}
        </p>
      </div>

      {/* Campaign & TL Selection */}
      <div className="flex flex-wrap gap-4">
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-64 border-primary/30">
            <SelectValue placeholder={isBn ? "ক্যাম্পেইন নির্বাচন করুন" : "Select Campaign"} />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedTL} onValueChange={setSelectedTL} disabled={tls.length === 0}>
          <SelectTrigger className="w-64 border-primary/30">
            <SelectValue placeholder={isBn ? "TL নির্বাচন করুন" : "Select TL"} />
          </SelectTrigger>
          <SelectContent>
            {tls.map(tl => (
              <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCampaign && selectedTL && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available Employees */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                {isBn ? "উপলব্ধ কর্মী" : "Available Employees"} ({filteredEmployees.length})
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isBn ? "নাম দিয়ে খুঁজুন..." : "Search by name..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={assignAsBronze} onCheckedChange={(v) => setAssignAsBronze(!!v)} />
                  <span className="text-orange-600 font-medium">🥉 Bronze</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={assignAsSilver} onCheckedChange={(v) => setAssignAsSilver(!!v)} />
                  <span className="text-gray-600 font-medium">🥈 Silver</span>
                </label>
              </div>

              <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead>{isBn ? "রোল" : "Role"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          {isBn ? "কোনো কর্মী পাওয়া যায়নি" : "No employees found"}
                        </TableCell>
                      </TableRow>
                    ) : filteredEmployees.map(emp => (
                      <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleEmployee(emp.id)}>
                        <TableCell>
                          <Checkbox checked={selectedEmployees.has(emp.id)} />
                        </TableCell>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{roleLabel(emp.role)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedEmployees.size > 0 && (
                <Button onClick={assignAgents} disabled={saving} className="mt-3 w-full">
                  {saving
                    ? (isBn ? "অ্যাসাইন হচ্ছে..." : "Assigning...")
                    : (isBn ? `${selectedEmployees.size}জন এজেন্ট অ্যাসাইন করুন` : `Assign ${selectedEmployees.size} Agents`)}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Currently Assigned Agents */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {isBn ? "অ্যাসাইনকৃত এজেন্ট" : "Assigned Agents"} ({assignedAgents.filter(a => a.tl_id === selectedTL).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isBn ? "নাম" : "Name"}</TableHead>
                      <TableHead>Bronze</TableHead>
                      <TableHead>Silver</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedAgents.filter(a => a.tl_id === selectedTL).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          {isBn ? "এই TL-এর অধীনে কোনো এজেন্ট নেই" : "No agents under this TL"}
                        </TableCell>
                      </TableRow>
                    ) : assignedAgents.filter(a => a.tl_id === selectedTL).map(agent => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium">{agent.agent_name}</TableCell>
                        <TableCell>
                          <Checkbox
                            checked={agent.is_bronze}
                            onCheckedChange={(v) => toggleRole(agent.id, "is_bronze", !!v)}
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={agent.is_silver}
                            onCheckedChange={(v) => toggleRole(agent.id, "is_silver", !!v)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="destructive" onClick={() => removeAgent(agent.id)}>
                            {isBn ? "রিমুভ" : "Remove"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* All TLs summary */}
              {tls.length > 1 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{isBn ? "সকল TL সারাংশ:" : "All TLs Summary:"}</p>
                  {tls.map(tl => {
                    const count = assignedAgents.filter(a => a.tl_id === tl.id).length;
                    return (
                      <div key={tl.id} className="flex items-center justify-between text-sm px-2 py-1 bg-muted/50 rounded">
                        <span className={tl.id === selectedTL ? "font-bold text-primary" : ""}>{tl.name}</span>
                        <Badge variant="secondary">{count} {isBn ? "জন" : "agents"}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedCampaign && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>{isBn ? "উপরে একটি ক্যাম্পেইন নির্বাচন করুন" : "Select a campaign above to manage agent assignments"}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BDOAgentAssignment;
