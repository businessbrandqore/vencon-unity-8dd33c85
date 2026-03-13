import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Save, Settings2, Activity, X } from "lucide-react";

/* ─── Types ─── */
type AppPanel = "sa" | "hr" | "tl" | "employee";

interface StatusOption {
  id: string;
  value: string;
  label: string;
  label_bn: string;
  color?: string;
  next_status?: string;
  next_panel?: AppPanel | "";
  next_location?: string;
}

interface RoleStatusConfig {
  role: string;
  statuses: StatusOption[];
}

interface LiveLeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  status: string | null;
  agent_type: string | null;
  assigned_to: string | null;
  updated_at: string | null;
}

/* ─── Constants ─── */
const NO_OPTION = "__none__";

const SALES_ROLES = [
  { value: "telesales_executive", label: "টেলিসেলস (Bronze)" },
  { value: "silver_agent", label: "সিলভার এজেন্ট" },
  { value: "golden_agent", label: "গোল্ডেন এজেন্ট" },
  { value: "assistant_team_leader", label: "ATL" },
  { value: "cso", label: "CSO" },
  { value: "cs_executive", label: "CS Executive" },
  { value: "warehouse_assistant", label: "Warehouse Assistant" },
  { value: "delivery_coordinator", label: "Delivery Coordinator" },
];

const STATUS_COLORS = [
  { value: "blue", label: "নীল" },
  { value: "green", label: "সবুজ" },
  { value: "yellow", label: "হলুদ" },
  { value: "red", label: "লাল" },
  { value: "purple", label: "বেগুনি" },
  { value: "orange", label: "কমলা" },
  { value: "gray", label: "ধূসর" },
];

const PANEL_OPTIONS: { value: AppPanel; label: string }[] = [
  { value: "employee", label: "Employee Panel" },
  { value: "tl", label: "TL Panel" },
  { value: "hr", label: "HR Panel" },
  { value: "sa", label: "SA Panel" },
];

const PANEL_DESTINATIONS: Record<AppPanel, Array<{ value: string; label: string }>> = {
  employee: [
    { value: "leads", label: "Leads" },
    { value: "cs-leads", label: "CS Leads" },
    { value: "my-orders", label: "My Orders" },
    { value: "dispatch", label: "Dispatch" },
    { value: "steadfast", label: "Steadfast Monitoring" },
  ],
  tl: [
    { value: "leads", label: "TL Leads" },
    { value: "my-leads", label: "My Leads" },
    { value: "data-requests", label: "Data Requests" },
    { value: "my-team", label: "Team" },
  ],
  hr: [
    { value: "data-monitor", label: "Data Monitor" },
    { value: "data-tracker", label: "Data Tracker" },
    { value: "approvals", label: "Approvals" },
  ],
  sa: [
    { value: "all-data", label: "All Data" },
    { value: "data-tracker", label: "Data Tracker" },
    { value: "approvals", label: "Approvals" },
  ],
};

const colorClasses: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  gray: "bg-muted text-muted-foreground",
};

/* ─── Helpers ─── */
const panelSet = new Set<AppPanel>(["sa", "hr", "tl", "employee"]);

const parseRoleConfigs = (raw: unknown): RoleStatusConfig[] => {
  if (!Array.isArray(raw)) return [];

  return raw.map((item: any, roleIndex: number) => ({
    role: item.role || "",
    statuses: Array.isArray(item.statuses)
      ? item.statuses.map((s: any, statusIndex: number) => {
          const nextPanel = panelSet.has(s.next_panel) ? s.next_panel : "";
          const validLocations = nextPanel ? PANEL_DESTINATIONS[nextPanel] : [];
          const nextLocation = validLocations.some((loc) => loc.value === s.next_location)
            ? s.next_location
            : "";

          return {
            id: s.id || `${item.role || "role"}_${roleIndex}_${statusIndex}_${s.value || "status"}`,
            value: s.value || "",
            label: s.label || "",
            label_bn: s.label_bn || "",
            color: s.color || "gray",
            next_status: s.next_status || "",
            next_panel: nextPanel,
            next_location: nextLocation,
          };
        })
      : [],
  }));
};

export default function HRDataOperations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedMode, setSelectedMode] = useState("lead");
  const [selectedRole, setSelectedRole] = useState(SALES_ROLES[0].value);
  const [activeTab, setActiveTab] = useState("config");
  const [roleConfigs, setRoleConfigs] = useState<RoleStatusConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // ─── Queries ───
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-for-ops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: existingConfig, isLoading: configLoading } = useQuery({
    queryKey: ["data-operations-config", selectedCampaign, selectedMode],
    queryFn: async () => {
      if (!selectedCampaign) return null;
      const { data, error } = await supabase
        .from("campaign_data_operations")
        .select("*")
        .eq("campaign_id", selectedCampaign)
        .eq("data_mode", selectedMode)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCampaign,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: liveLeads = [], isLoading: liveLoading } = useQuery({
    queryKey: ["hr-live-ops", selectedCampaign, selectedMode],
    queryFn: async () => {
      if (!selectedCampaign) return [] as LiveLeadRow[];
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, status, agent_type, assigned_to, updated_at")
        .eq("campaign_id", selectedCampaign)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as LiveLeadRow[];
    },
    enabled: !!selectedCampaign && activeTab === "live",
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const normalizedConfig = useMemo(
    () => parseRoleConfigs(existingConfig?.fields_config),
    [existingConfig?.fields_config],
  );
  const configFingerprint = useMemo(
    () => JSON.stringify(normalizedConfig),
    [normalizedConfig],
  );
  const lastAppliedConfigRef = useRef("");

  // ─── Sync config → state (without clobbering active edits) ───
  useEffect(() => {
    setHasChanges(false);
    lastAppliedConfigRef.current = "";
  }, [selectedCampaign, selectedMode]);

  useEffect(() => {
    if (!selectedCampaign) {
      setRoleConfigs([]);
      return;
    }

    if (hasChanges) return;
    if (lastAppliedConfigRef.current === configFingerprint) return;

    setRoleConfigs(normalizedConfig);
    lastAppliedConfigRef.current = configFingerprint;
  }, [selectedCampaign, normalizedConfig, configFingerprint, hasChanges]);

  // ─── Current role config ───
  const currentRoleConfig = useMemo(
    () => roleConfigs.find((rc) => rc.role === selectedRole),
    [roleConfigs, selectedRole],
  );

  const currentStatuses = currentRoleConfig?.statuses || [];

  // ─── All unique statuses across all roles (for "next_status" dropdown) ───
  const allStatusValues = useMemo(() => {
    const set = new Set<string>();
    roleConfigs.forEach((rc) => rc.statuses.forEach((s) => { if (s.value) set.add(s.value); }));
    return Array.from(set);
  }, [roleConfigs]);

  const getPanelLocations = (panel?: AppPanel | "") => {
    if (!panel) return [];
    return PANEL_DESTINATIONS[panel] || [];
  };

  // ─── Mutations ───
  const updateRoleStatuses = (statuses: StatusOption[]) => {
    setRoleConfigs((prev) => {
      const exists = prev.find((rc) => rc.role === selectedRole);
      if (exists) {
        return prev.map((rc) => rc.role === selectedRole ? { ...rc, statuses } : rc);
      }
      return [...prev, { role: selectedRole, statuses }];
    });
    setHasChanges(true);
  };

  const addStatus = () => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `status_${Date.now()}`;

    updateRoleStatuses([
      ...currentStatuses,
      {
        id,
        value: "",
        label: "",
        label_bn: "",
        color: "gray",
        next_status: "",
        next_panel: "",
        next_location: "",
      },
    ]);
  };

  const updateStatus = (idx: number, updates: Partial<StatusOption>) => {
    const updated = [...currentStatuses];
    const current = updated[idx];
    const merged = { ...current, ...updates };

    if (updates.label && !current.value) {
      merged.value = updates.label.toLowerCase().replace(/\s+/g, "_");
    }

    if (Object.prototype.hasOwnProperty.call(updates, "next_panel")) {
      const panel = updates.next_panel || "";
      const validLocations = panel ? getPanelLocations(panel) : [];
      if (!validLocations.some((loc) => loc.value === merged.next_location)) {
        merged.next_location = "";
      }
    }

    updated[idx] = merged;
    updateRoleStatuses(updated);
  };

  const removeStatus = (idx: number) => {
    updateRoleStatuses(currentStatuses.filter((_, i) => i !== idx));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign || !user) throw new Error("Missing data");

      const payload = {
        campaign_id: selectedCampaign,
        data_mode: selectedMode,
        fields_config: JSON.parse(JSON.stringify(roleConfigs)),
        routing_rules: existingConfig?.routing_rules || [],
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (existingConfig?.id) {
        const { data, error } = await supabase
          .from("campaign_data_operations")
          .update(payload)
          .eq("id", existingConfig.id)
          .select("*")
          .single();

        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("campaign_data_operations")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (savedConfig) => {
      toast.success("কনফিগারেশন সেভ হয়েছে!");
      setHasChanges(false);
      queryClient.setQueryData(
        ["data-operations-config", selectedCampaign, selectedMode],
        savedConfig,
      );
      lastAppliedConfigRef.current = JSON.stringify(parseRoleConfigs(savedConfig?.fields_config));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Live tab: count by status ───
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    liveLeads.forEach((l) => {
      const s = l.status || "unknown";
      map[s] = (map[s] || 0) + 1;
    });
    return map;
  }, [liveLeads]);

  // Find color for a status value
  const getStatusColor = (statusValue: string) => {
    for (const rc of roleConfigs) {
      const found = rc.statuses.find((s) => s.value === statusValue);
      if (found?.color) return found.color;
    }
    return "gray";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            ডাটা অপারেশন
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            প্রতিটি পদের জন্য লিডের স্ট্যাটাস অপশন নির্ধারণ করুন
          </p>
        </div>
        {hasChanges && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>ক্যাম্পেইন</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger><SelectValue placeholder="সিলেক্ট করুন..." /></SelectTrigger>
                <SelectContent>
                  {campaigns?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ডাটা মোড</Label>
              <Select value={selectedMode} onValueChange={setSelectedMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">লিড</SelectItem>
                  <SelectItem value="processing">প্রসেসিং</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>পদ সিলেক্ট করুন</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SALES_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {configLoading && <p className="text-xs text-muted-foreground mt-3">লোড হচ্ছে...</p>}
        </CardContent>
      </Card>

      {/* Main content */}
      {selectedCampaign && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="config">
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              স্ট্যাটাস কনফিগ ({currentStatuses.length})
            </TabsTrigger>
            <TabsTrigger value="overview">
              সব পদের সারাংশ
            </TabsTrigger>
            <TabsTrigger value="live">
              <Activity className="h-3.5 w-3.5 mr-1" />
              লাইভ ডাটা
            </TabsTrigger>
          </TabsList>

          {/* ─── Config Tab ─── */}
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {SALES_ROLES.find((r) => r.value === selectedRole)?.label} — স্ট্যাটাস অপশন
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addStatus}>
                    <Plus className="h-4 w-4 mr-1" /> স্ট্যাটাস যোগ করুন
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-0">
                {currentStatuses.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg">
                    এই পদের জন্য কোনো স্ট্যাটাস অপশন নেই।<br />
                    <Button variant="outline" size="sm" className="mt-3" onClick={addStatus}>
                      <Plus className="h-4 w-4 mr-1" /> প্রথম স্ট্যাটাস যোগ করুন
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>ভ্যালু (key)</TableHead>
                          <TableHead>লেবেল (EN)</TableHead>
                          <TableHead>লেবেল (বাংলা)</TableHead>
                          <TableHead>রঙ</TableHead>
                          <TableHead>পরবর্তী স্ট্যাটাস</TableHead>
                          <TableHead>পরবর্তী প্যানেল</TableHead>
                          <TableHead>প্যানেলের ভেতরে কোথায় যাবে</TableHead>
                          <TableHead>প্রিভিউ</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentStatuses.map((status, idx) => {
                          const panelLocations = getPanelLocations(status.next_panel);

                          return (
                            <TableRow key={status.id}>
                              <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                              <TableCell>
                                <Input
                                  value={status.value}
                                  onChange={(e) => updateStatus(idx, { value: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                                  placeholder="order_confirm"
                                  className="h-8 text-sm font-mono"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={status.label}
                                  onChange={(e) => updateStatus(idx, { label: e.target.value })}
                                  placeholder="Order Confirm"
                                  className="h-8 text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={status.label_bn}
                                  onChange={(e) => updateStatus(idx, { label_bn: e.target.value })}
                                  placeholder="অর্ডার কনফার্ম"
                                  className="h-8 text-sm"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={status.color || "gray"}
                                  onValueChange={(v) => updateStatus(idx, { color: v })}
                                >
                                  <SelectTrigger className="h-8 w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_COLORS.map((c) => (
                                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={status.next_status || NO_OPTION}
                                  onValueChange={(v) => updateStatus(idx, { next_status: v === NO_OPTION ? "" : v })}
                                >
                                  <SelectTrigger className="h-8 w-36">
                                    <SelectValue placeholder="নেই" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NO_OPTION}>নেই</SelectItem>
                                    {allStatusValues
                                      .filter((sv) => sv !== status.value)
                                      .map((sv) => (
                                        <SelectItem key={sv} value={sv}>{sv}</SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={status.next_panel || NO_OPTION}
                                  onValueChange={(v) => updateStatus(idx, { next_panel: v === NO_OPTION ? "" : (v as AppPanel) })}
                                >
                                  <SelectTrigger className="h-8 w-36">
                                    <SelectValue placeholder="প্যানেল" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NO_OPTION}>নির্বাচন করুন</SelectItem>
                                    {PANEL_OPTIONS.map((panel) => (
                                      <SelectItem key={panel.value} value={panel.value}>{panel.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={status.next_location || NO_OPTION}
                                  onValueChange={(v) => updateStatus(idx, { next_location: v === NO_OPTION ? "" : v })}
                                  disabled={!status.next_panel}
                                >
                                  <SelectTrigger className="h-8 w-44">
                                    <SelectValue placeholder="সেকশন" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NO_OPTION}>নির্বাচন করুন</SelectItem>
                                    {panelLocations.map((location) => (
                                      <SelectItem key={location.value} value={location.value}>{location.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {status.value && (
                                  <div className="space-y-1">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[status.color || "gray"] || colorClasses.gray}`}>
                                      {status.label_bn || status.label || status.value}
                                    </span>
                                    {(status.next_panel || status.next_location) && (
                                      <p className="text-[11px] text-muted-foreground">
                                        {(status.next_panel || "—").toUpperCase()} / {status.next_location || "—"}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => removeStatus(idx)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick preview of all statuses for this role */}
            {currentStatuses.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    এই পদের কর্মী যে স্ট্যাটাসগুলো দেখতে পাবে (এবং কোন প্যানেলে রাউট হবে):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentStatuses.map((s) => (
                      <span
                        key={s.id}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClasses[s.color || "gray"] || colorClasses.gray}`}
                      >
                        {s.label_bn || s.label || s.value}
                        {s.next_status && (
                          <span className="ml-1 opacity-60 text-xs">→ {s.next_status}</span>
                        )}
                        {(s.next_panel || s.next_location) && (
                          <span className="ml-1 opacity-70 text-xs">({(s.next_panel || "—").toUpperCase()}/{s.next_location || "—"})</span>
                        )}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── Overview Tab ─── */}
          <TabsContent value="overview" className="space-y-4">
            {roleConfigs.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  কোনো পদের জন্য স্ট্যাটাস কনফিগার করা হয়নি।
                </CardContent>
              </Card>
            ) : (
              roleConfigs.map((rc) => {
                const roleInfo = SALES_ROLES.find((r) => r.value === rc.role);
                return (
                  <Card key={rc.role}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">
                        {roleInfo?.label || rc.role}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {rc.statuses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">কোনো স্ট্যাটাস নেই</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {rc.statuses.map((s) => (
                            <span
                              key={s.id}
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorClasses[s.color || "gray"] || colorClasses.gray}`}
                            >
                              {s.label_bn || s.label || s.value}
                              {(s.next_panel || s.next_location) && (
                                <span className="ml-1 opacity-70">({(s.next_panel || "—").toUpperCase()}/{s.next_location || "—"})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ─── Live Tab ─── */}
          <TabsContent value="live" className="space-y-4">
            {/* Status counts */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <Badge
                  key={status}
                  className={`text-xs ${colorClasses[getStatusColor(status)] || colorClasses.gray}`}
                >
                  {status}: {count}
                </Badge>
              ))}
              <Badge variant="outline" className="text-xs">মোট: {liveLeads.length}</Badge>
            </div>

            <Card>
              <CardContent className="pt-4">
                {liveLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">ডাটা লোড হচ্ছে...</p>
                ) : liveLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">কোনো ডাটা নেই</p>
                ) : (
                  <div className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>নাম</TableHead>
                          <TableHead>ফোন</TableHead>
                          <TableHead>স্ট্যাটাস</TableHead>
                          <TableHead>টায়ার</TableHead>
                          <TableHead>আপডেট</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {liveLeads.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                            <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[getStatusColor(lead.status || "")] || colorClasses.gray}`}>
                                {lead.status || "—"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {lead.agent_type || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {lead.updated_at
                                ? new Date(lead.updated_at).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
