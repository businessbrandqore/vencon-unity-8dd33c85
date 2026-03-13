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
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Save, Settings2, Activity, X, GripVertical, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";

/* ─── Types ─── */
type AppPanel = "sa" | "hr" | "tl" | "employee";

interface StatusOption {
  id: string;
  value: string;
  label: string;
  label_bn: string;
  color?: string;
  next_panel?: AppPanel | "";
  next_location?: string;
  note?: string;
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

const STATUS_COLORS: { value: string; label: string; bg: string; text: string }[] = [
  { value: "red", label: "লাল", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" },
  { value: "green", label: "সবুজ", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
  { value: "blue", label: "নীল", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  { value: "yellow", label: "হলুদ", bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300" },
  { value: "purple", label: "বেগুনি", bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  { value: "orange", label: "কমলা", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  { value: "gray", label: "ধূসর", bg: "bg-muted", text: "text-muted-foreground" },
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

const getColorInfo = (color: string) => STATUS_COLORS.find((c) => c.value === color) || STATUS_COLORS[6];

/* ─── Helpers ─── */
const panelSet = new Set<AppPanel>(["sa", "hr", "tl", "employee"]);

const parseRoleConfigs = (raw: unknown): RoleStatusConfig[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any, ri: number) => ({
    role: item.role || "",
    statuses: Array.isArray(item.statuses)
      ? item.statuses.map((s: any, si: number) => {
          const np = panelSet.has(s.next_panel) ? s.next_panel : "";
          const vl = np ? (PANEL_DESTINATIONS[np] || []) : [];
          return {
            id: s.id || `${item.role}_${ri}_${si}`,
            value: s.value || "",
            label: s.label || "",
            label_bn: s.label_bn || "",
            color: s.color || "gray",
            next_panel: np,
            next_location: vl.some((l: any) => l.value === s.next_location) ? s.next_location : "",
            note: s.note || "",
          };
        })
      : [],
  }));
};

/* ─── Status Card Component ─── */
function StatusCard({
  status,
  index,
  onUpdate,
  onRemove,
  expanded,
  onToggle,
}: {
  status: StatusOption;
  index: number;
  onUpdate: (updates: Partial<StatusOption>) => void;
  onRemove: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colorInfo = getColorInfo(status.color || "gray");
  const panelLocations = status.next_panel ? (PANEL_DESTINATIONS[status.next_panel] || []) : [];
  const panelLabel = PANEL_OPTIONS.find((p) => p.value === status.next_panel)?.label;
  const locationLabel = panelLocations.find((l) => l.value === status.next_location)?.label;

  return (
    <div className={`border rounded-lg overflow-hidden ${colorInfo.bg}`}>
      {/* Header - always visible */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
        onClick={onToggle}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
        <span className={`font-semibold text-sm flex-1 ${colorInfo.text}`}>
          {status.label_bn || status.label || status.value || `স্ট্যাটাস #${index + 1}`}
        </span>
        {status.next_panel && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            {panelLabel}{locationLabel ? ` / ${locationLabel}` : ""}
          </span>
        )}
        {status.note && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">নোট</Badge>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-background/80 border-t space-y-3">
          {/* Row 1: Names */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Value (key)</Label>
              <Input
                value={status.value}
                onChange={(e) => onUpdate({ value: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder="order_confirm"
                className="h-8 text-sm font-mono mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Label (EN)</Label>
              <Input
                value={status.label}
                onChange={(e) => {
                  const updates: Partial<StatusOption> = { label: e.target.value };
                  if (!status.value) updates.value = e.target.value.toLowerCase().replace(/\s+/g, "_");
                  onUpdate(updates);
                }}
                placeholder="Order Confirm"
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Label (বাংলা)</Label>
              <Input
                value={status.label_bn}
                onChange={(e) => onUpdate({ label_bn: e.target.value })}
                placeholder="অর্ডার কনফার্ম"
                className="h-8 text-sm mt-1"
              />
            </div>
          </div>

          {/* Row 2: Color + Routing */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">রঙ</Label>
              <Select value={status.color || "gray"} onValueChange={(v) => onUpdate({ color: v })}>
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${c.bg} border`} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">ডাটা কোন প্যানেলে যাবে</Label>
              <Select
                value={status.next_panel || NO_OPTION}
                onValueChange={(v) => {
                  const panel = v === NO_OPTION ? "" : (v as AppPanel);
                  onUpdate({ next_panel: panel, next_location: "" });
                }}
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue placeholder="সিলেক্ট করুন" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_OPTION}>— নির্বাচন করুন —</SelectItem>
                  {PANEL_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">প্যানেলের কোথায় যাবে</Label>
              <Select
                value={status.next_location || NO_OPTION}
                onValueChange={(v) => onUpdate({ next_location: v === NO_OPTION ? "" : v })}
                disabled={!status.next_panel}
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue placeholder={status.next_panel ? "সিলেক্ট করুন" : "আগে প্যানেল সিলেক্ট করুন"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_OPTION}>— নির্বাচন করুন —</SelectItem>
                  {panelLocations.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Note */}
          <div>
            <Label className="text-xs text-muted-foreground">নোট (ঐচ্ছিক)</Label>
            <Textarea
              value={status.note || ""}
              onChange={(e) => onUpdate({ note: e.target.value })}
              placeholder="এই স্ট্যাটাসের বিশেষ নির্দেশনা..."
              className="mt-1 text-sm min-h-[60px]"
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export default function HRDataOperations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedMode, setSelectedMode] = useState("lead");
  const [selectedRole, setSelectedRole] = useState(SALES_ROLES[0].value);
  const [activeTab, setActiveTab] = useState("config");
  const [roleConfigs, setRoleConfigs] = useState<RoleStatusConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    queryKey: ["hr-live-ops", selectedCampaign],
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

  // ─── Config sync ───
  const normalizedConfig = useMemo(() => parseRoleConfigs(existingConfig?.fields_config), [existingConfig?.fields_config]);
  const configFP = useMemo(() => JSON.stringify(normalizedConfig), [normalizedConfig]);
  const lastAppliedRef = useRef("");

  useEffect(() => {
    setHasChanges(false);
    lastAppliedRef.current = "";
  }, [selectedCampaign, selectedMode]);

  useEffect(() => {
    if (!selectedCampaign) { setRoleConfigs([]); return; }
    if (hasChanges) return;
    if (lastAppliedRef.current === configFP) return;
    setRoleConfigs(normalizedConfig);
    lastAppliedRef.current = configFP;
  }, [selectedCampaign, normalizedConfig, configFP, hasChanges]);

  // ─── Current role ───
  const currentRoleConfig = useMemo(() => roleConfigs.find((rc) => rc.role === selectedRole), [roleConfigs, selectedRole]);
  const currentStatuses = currentRoleConfig?.statuses || [];

  // ─── Mutations ───
  const updateRoleStatuses = (statuses: StatusOption[]) => {
    setRoleConfigs((prev) => {
      const exists = prev.find((rc) => rc.role === selectedRole);
      if (exists) return prev.map((rc) => rc.role === selectedRole ? { ...rc, statuses } : rc);
      return [...prev, { role: selectedRole, statuses }];
    });
    setHasChanges(true);
  };

  const addStatus = () => {
    const id = crypto.randomUUID?.() || `s_${Date.now()}`;
    updateRoleStatuses([
      ...currentStatuses,
      { id, value: "", label: "", label_bn: "", color: "gray", next_panel: "", next_location: "", note: "" },
    ]);
    setExpandedCards((prev) => new Set(prev).add(id));
  };

  const updateStatus = (idx: number, updates: Partial<StatusOption>) => {
    const updated = [...currentStatuses];
    updated[idx] = { ...updated[idx], ...updates };
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
        const { data, error } = await supabase.from("campaign_data_operations").update(payload).eq("id", existingConfig.id).select("*").single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("campaign_data_operations").insert(payload).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (saved) => {
      toast.success("কনফিগারেশন সেভ হয়েছে!");
      setHasChanges(false);
      queryClient.setQueryData(["data-operations-config", selectedCampaign, selectedMode], saved);
      lastAppliedRef.current = JSON.stringify(parseRoleConfigs(saved?.fields_config));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Live tab helpers ───
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    liveLeads.forEach((l) => { const s = l.status || "unknown"; map[s] = (map[s] || 0) + 1; });
    return map;
  }, [liveLeads]);

  const getStatusColor = (sv: string) => {
    for (const rc of roleConfigs) {
      const f = rc.statuses.find((s) => s.value === sv);
      if (f?.color) return f.color;
    }
    return "gray";
  };

  const getColorClasses = (color: string) => {
    const c = getColorInfo(color);
    return `${c.bg} ${c.text}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            ডাটা অপারেশন
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            কর্মীদের লিডের স্ট্যাটাস অপশন ও রাউটিং নির্ধারণ করুন
          </p>
        </div>
        {hasChanges && (
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1.5" />
            {saveMutation.isPending ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">ক্যাম্পেইন</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="সিলেক্ট করুন..." /></SelectTrigger>
                <SelectContent>
                  {campaigns?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">ডাটা মোড</Label>
              <Select value={selectedMode} onValueChange={setSelectedMode}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">লিড</SelectItem>
                  <SelectItem value="processing">প্রসেসিং</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">পদ</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SALES_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {configLoading && <p className="text-xs text-muted-foreground mt-2">লোড হচ্ছে...</p>}
        </CardContent>
      </Card>

      {/* Main Tabs */}
      {selectedCampaign && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList>
            <TabsTrigger value="config">
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              স্ট্যাটাস কনফিগ ({currentStatuses.length})
            </TabsTrigger>
            <TabsTrigger value="overview">সব পদের সারাংশ</TabsTrigger>
            <TabsTrigger value="live">
              <Activity className="h-3.5 w-3.5 mr-1" />
              লাইভ
            </TabsTrigger>
          </TabsList>

          {/* ─── Config Tab ─── */}
          <TabsContent value="config" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {SALES_ROLES.find((r) => r.value === selectedRole)?.label} — স্ট্যাটাস তালিকা
              </h3>
              <Button size="sm" variant="outline" onClick={addStatus}>
                <Plus className="h-4 w-4 mr-1" /> নতুন স্ট্যাটাস
              </Button>
            </div>

            {currentStatuses.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <p className="text-sm">এই পদের জন্য কোনো স্ট্যাটাস নেই</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={addStatus}>
                    <Plus className="h-4 w-4 mr-1" /> প্রথম স্ট্যাটাস যোগ করুন
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {currentStatuses.map((status, idx) => (
                  <StatusCard
                    key={status.id}
                    status={status}
                    index={idx}
                    onUpdate={(updates) => updateStatus(idx, updates)}
                    onRemove={() => removeStatus(idx)}
                    expanded={expandedCards.has(status.id)}
                    onToggle={() => toggleCard(status.id)}
                  />
                ))}
              </div>
            )}

            {/* Quick summary chips */}
            {currentStatuses.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">কর্মী এই অপশনগুলো দেখবে:</p>
                <div className="flex flex-wrap gap-1.5">
                  {currentStatuses.filter((s) => s.value).map((s) => (
                    <span
                      key={s.id}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getColorClasses(s.color || "gray")}`}
                    >
                      {s.label_bn || s.label || s.value}
                      {s.next_panel && (
                        <span className="ml-1 opacity-60 text-[10px]">
                          → {PANEL_OPTIONS.find((p) => p.value === s.next_panel)?.label || s.next_panel}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Overview Tab ─── */}
          <TabsContent value="overview" className="space-y-3">
            {roleConfigs.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  কোনো পদের জন্য স্ট্যাটাস কনফিগার করা হয়নি
                </CardContent>
              </Card>
            ) : (
              roleConfigs.map((rc) => {
                const roleInfo = SALES_ROLES.find((r) => r.value === rc.role);
                if (rc.statuses.length === 0) return null;
                return (
                  <Card key={rc.role}>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm">{roleInfo?.label || rc.role}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {rc.statuses.map((s) => (
                          <span
                            key={s.id}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getColorClasses(s.color || "gray")}`}
                          >
                            {s.label_bn || s.label || s.value}
                            {s.next_panel && (
                              <span className="ml-1 opacity-60 text-[10px]">
                                → {(s.next_panel).toUpperCase()}/{s.next_location || "—"}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ─── Live Tab ─── */}
          <TabsContent value="live" className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(statusCounts).map(([s, c]) => (
                <Badge key={s} className={`text-xs ${getColorClasses(getStatusColor(s))}`}>
                  {s}: {c}
                </Badge>
              ))}
              <Badge variant="outline" className="text-xs">মোট: {liveLeads.length}</Badge>
            </div>
            <Card>
              <CardContent className="pt-3 pb-2">
                {liveLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">লোড হচ্ছে...</p>
                ) : liveLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">কোনো ডাটা নেই</p>
                ) : (
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>নাম</TableHead>
                          <TableHead>ফোন</TableHead>
                          <TableHead>স্ট্যাটাস</TableHead>
                          <TableHead>টায়ার</TableHead>
                          <TableHead>সময়</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {liveLeads.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium text-sm">{lead.name || "—"}</TableCell>
                            <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getColorClasses(getStatusColor(lead.status || ""))}`}>
                                {lead.status || "—"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{lead.agent_type || "—"}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {lead.updated_at ? new Date(lead.updated_at).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }) : "—"}
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
