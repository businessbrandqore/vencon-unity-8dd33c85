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
import { Plus, Save, Settings2, Activity, X, ChevronDown, ChevronUp, ArrowRight, Columns3 } from "lucide-react";

/* ─── Types ─── */
type AppPanel = "sa" | "hr" | "tl" | "employee";

interface ColumnOption {
  id: string;
  value: string;
  label: string;
  label_bn: string;
  color?: string;
  next_panel?: AppPanel | "";
  next_location?: string;
  note?: string;
}

type ColumnType = "dropdown" | "note";

interface StatusColumn {
  id: string;
  name: string;
  name_bn: string;
  type: ColumnType;
  options: ColumnOption[];
}

interface RoleColumnConfig {
  role: string;
  columns: StatusColumn[];
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

const parseRoleConfigs = (raw: unknown): RoleColumnConfig[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => {
    // Support new column-based format
    if (Array.isArray(item.columns)) {
      return {
        role: item.role || "",
        columns: item.columns.map((col: any) => ({
          id: col.id || crypto.randomUUID?.() || `col_${Date.now()}`,
          name: col.name || "",
          name_bn: col.name_bn || "",
          type: (col.type === "note" ? "note" : "dropdown") as ColumnType,
          options: Array.isArray(col.options)
            ? col.options.map((s: any) => {
                const np = panelSet.has(s.next_panel) ? s.next_panel : "";
                const vl = np ? (PANEL_DESTINATIONS[np] || []) : [];
                return {
                  id: s.id || crypto.randomUUID?.() || `opt_${Date.now()}`,
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
        })),
      };
    }
    // Migrate old flat statuses format → single column
    if (Array.isArray(item.statuses) && item.statuses.length > 0) {
      return {
        role: item.role || "",
        columns: [{
          id: crypto.randomUUID?.() || `col_migrated`,
          name: "Call Status",
          name_bn: "কল স্ট্যাটাস",
          type: "dropdown" as ColumnType,
          options: item.statuses.map((s: any) => ({
            id: s.id || crypto.randomUUID?.() || `opt_${Date.now()}`,
            value: s.value || "",
            label: s.label || "",
            label_bn: s.label_bn || "",
            color: s.color || "gray",
            next_panel: panelSet.has(s.next_panel) ? s.next_panel : "",
            next_location: s.next_location || "",
            note: s.note || "",
          })),
        }],
      };
    }
    return { role: item.role || "", columns: [] };
  });
};

const getColorClasses = (color: string) => {
  const c = getColorInfo(color);
  return `${c.bg} ${c.text}`;
};

/* ─── Option Row Component ─── */
function OptionRow({
  option,
  onUpdate,
  onRemove,
  expanded,
  onToggle,
}: {
  option: ColumnOption;
  onUpdate: (updates: Partial<ColumnOption>) => void;
  onRemove: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colorInfo = getColorInfo(option.color || "gray");
  const panelLocations = option.next_panel ? (PANEL_DESTINATIONS[option.next_panel] || []) : [];

  return (
    <div className={`border rounded-md overflow-hidden ${colorInfo.bg}`}>
      <div className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none" onClick={onToggle}>
        <span className={`w-2.5 h-2.5 rounded-full border flex-shrink-0 ${colorInfo.bg}`} style={{ borderColor: 'currentColor' }} />
        <span className={`text-xs font-medium flex-1 truncate ${colorInfo.text}`}>
          {option.label_bn || option.label || option.value || "নতুন অপশন"}
        </span>
        {option.next_panel && (
          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        )}
        <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 pt-1 bg-background/80 border-t space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <Label className="text-[10px] text-muted-foreground">Value (key)</Label>
              <Input
                value={option.value}
                onChange={(e) => onUpdate({ value: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder="order_confirm"
                className="h-7 text-xs font-mono mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Label (EN)</Label>
              <Input
                value={option.label}
                onChange={(e) => {
                  const updates: Partial<ColumnOption> = { label: e.target.value };
                  if (!option.value) updates.value = e.target.value.toLowerCase().replace(/\s+/g, "_");
                  onUpdate(updates);
                }}
                placeholder="Order Confirm"
                className="h-7 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Label (বাংলা)</Label>
              <Input
                value={option.label_bn}
                onChange={(e) => onUpdate({ label_bn: e.target.value })}
                placeholder="অর্ডার কনফার্ম"
                className="h-7 text-xs mt-0.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <Label className="text-[10px] text-muted-foreground">রঙ</Label>
              <Select value={option.color || "gray"} onValueChange={(v) => onUpdate({ color: v })}>
                <SelectTrigger className="h-7 mt-0.5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${c.bg} border`} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">ডাটা কোন প্যানেলে</Label>
              <Select
                value={option.next_panel || NO_OPTION}
                onValueChange={(v) => onUpdate({ next_panel: v === NO_OPTION ? "" : (v as AppPanel), next_location: "" })}
              >
                <SelectTrigger className="h-7 mt-0.5 text-xs">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_OPTION}>— নেই —</SelectItem>
                  {PANEL_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">কোথায় যাবে</Label>
              <Select
                value={option.next_location || NO_OPTION}
                onValueChange={(v) => onUpdate({ next_location: v === NO_OPTION ? "" : v })}
                disabled={!option.next_panel}
              >
                <SelectTrigger className="h-7 mt-0.5 text-xs">
                  <SelectValue placeholder={option.next_panel ? "—" : "আগে প্যানেল দিন"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_OPTION}>— নেই —</SelectItem>
                  {panelLocations.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground">নোট (ঐচ্ছিক)</Label>
            <Textarea
              value={option.note || ""}
              onChange={(e) => onUpdate({ note: e.target.value })}
              placeholder="নির্দেশনা..."
              className="mt-0.5 text-xs min-h-[40px]"
              rows={1}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Column Card Component ─── */
function ColumnCard({
  column,
  onUpdateColumn,
  onRemoveColumn,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  expandedOptions,
  onToggleOption,
}: {
  column: StatusColumn;
  onUpdateColumn: (updates: Partial<StatusColumn>) => void;
  onRemoveColumn: () => void;
  onAddOption: () => void;
  onUpdateOption: (optIdx: number, updates: Partial<ColumnOption>) => void;
  onRemoveOption: (optIdx: number) => void;
  expandedOptions: Set<string>;
  onToggleOption: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Card className="flex-1 min-w-[280px] max-w-[400px]">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-2">
          <Columns3 className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <Input
              value={column.name}
              onChange={(e) => onUpdateColumn({ name: e.target.value })}
              placeholder="কলামের নাম (EN)"
              className="h-7 text-xs font-semibold"
            />
            <Input
              value={column.name_bn}
              onChange={(e) => onUpdateColumn({ name_bn: e.target.value })}
              placeholder="কলামের নাম (বাংলা)"
              className="h-7 text-xs"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onRemoveColumn}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="px-3 pb-3 space-y-1.5">
          {column.options.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-md">
              কোনো ভ্যালু নেই
            </p>
          )}
          {column.options.map((opt, optIdx) => (
            <OptionRow
              key={opt.id}
              option={opt}
              onUpdate={(updates) => onUpdateOption(optIdx, updates)}
              onRemove={() => onRemoveOption(optIdx)}
              expanded={expandedOptions.has(opt.id)}
              onToggle={() => onToggleOption(opt.id)}
            />
          ))}
          <Button variant="outline" size="sm" className="w-full h-7 text-xs mt-1" onClick={onAddOption}>
            <Plus className="h-3 w-3 mr-1" /> ভ্যালু যোগ করুন
          </Button>

          {/* Preview chips */}
          {column.options.filter(o => o.value).length > 0 && (
            <div className="pt-1.5 border-t mt-2">
              <p className="text-[10px] text-muted-foreground mb-1">প্রিভিউ:</p>
              <div className="flex flex-wrap gap-1">
                {column.options.filter(o => o.value).map(o => (
                  <span key={o.id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getColorClasses(o.color || "gray")}`}>
                    {o.label_bn || o.label || o.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
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
  const [roleConfigs, setRoleConfigs] = useState<RoleColumnConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());

  const toggleOption = (id: string) => {
    setExpandedOptions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Queries ───
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-for-ops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("id, name, status").eq("status", "active").order("name");
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
        .from("campaign_data_operations").select("*")
        .eq("campaign_id", selectedCampaign).eq("data_mode", selectedMode).maybeSingle();
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
        .from("leads").select("id, name, phone, status, agent_type, assigned_to, updated_at")
        .eq("campaign_id", selectedCampaign).order("updated_at", { ascending: false }).limit(100);
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

  useEffect(() => { setHasChanges(false); lastAppliedRef.current = ""; }, [selectedCampaign, selectedMode]);

  useEffect(() => {
    if (!selectedCampaign) { setRoleConfigs([]); return; }
    if (hasChanges) return;
    if (lastAppliedRef.current === configFP) return;
    setRoleConfigs(normalizedConfig);
    lastAppliedRef.current = configFP;
  }, [selectedCampaign, normalizedConfig, configFP, hasChanges]);

  // ─── Current role ───
  const currentRoleConfig = useMemo(() => roleConfigs.find(rc => rc.role === selectedRole), [roleConfigs, selectedRole]);
  const currentColumns = currentRoleConfig?.columns || [];

  // ─── Column mutations ───
  const updateRoleColumns = (columns: StatusColumn[]) => {
    setRoleConfigs(prev => {
      const exists = prev.find(rc => rc.role === selectedRole);
      if (exists) return prev.map(rc => rc.role === selectedRole ? { ...rc, columns } : rc);
      return [...prev, { role: selectedRole, columns }];
    });
    setHasChanges(true);
  };

  const addColumn = () => {
    const id = crypto.randomUUID?.() || `col_${Date.now()}`;
    updateRoleColumns([...currentColumns, { id, name: "", name_bn: "", options: [] }]);
  };

  const updateColumn = (colIdx: number, updates: Partial<StatusColumn>) => {
    const updated = [...currentColumns];
    updated[colIdx] = { ...updated[colIdx], ...updates };
    updateRoleColumns(updated);
  };

  const removeColumn = (colIdx: number) => {
    updateRoleColumns(currentColumns.filter((_, i) => i !== colIdx));
  };

  const addOptionToColumn = (colIdx: number) => {
    const id = crypto.randomUUID?.() || `opt_${Date.now()}`;
    const updated = [...currentColumns];
    updated[colIdx] = {
      ...updated[colIdx],
      options: [...updated[colIdx].options, { id, value: "", label: "", label_bn: "", color: "gray", next_panel: "", next_location: "", note: "" }],
    };
    updateRoleColumns(updated);
    setExpandedOptions(prev => new Set(prev).add(id));
  };

  const updateOptionInColumn = (colIdx: number, optIdx: number, updates: Partial<ColumnOption>) => {
    const updated = [...currentColumns];
    const opts = [...updated[colIdx].options];
    opts[optIdx] = { ...opts[optIdx], ...updates };
    updated[colIdx] = { ...updated[colIdx], options: opts };
    updateRoleColumns(updated);
  };

  const removeOptionFromColumn = (colIdx: number, optIdx: number) => {
    const updated = [...currentColumns];
    updated[colIdx] = { ...updated[colIdx], options: updated[colIdx].options.filter((_, i) => i !== optIdx) };
    updateRoleColumns(updated);
  };

  // ─── Save ───
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

  // ─── Live helpers ───
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    liveLeads.forEach(l => { const s = l.status || "unknown"; map[s] = (map[s] || 0) + 1; });
    return map;
  }, [liveLeads]);

  const getStatusColor = (sv: string) => {
    for (const rc of roleConfigs) {
      for (const col of rc.columns) {
        const f = col.options.find(o => o.value === sv);
        if (f?.color) return f.color;
      }
    }
    return "gray";
  };

  // ─── Total options count ───
  const totalOptions = currentColumns.reduce((sum, col) => sum + col.options.length, 0);

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
            কলাম তৈরি করুন, প্রতিটি কলামে মাল্টিপল ভ্যালু/অপশন যোগ করুন
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
                  {campaigns?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
                  {SALES_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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
              <Columns3 className="h-3.5 w-3.5 mr-1" />
              কলাম কনফিগ ({currentColumns.length} কলাম, {totalOptions} ভ্যালু)
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
                {SALES_ROLES.find(r => r.value === selectedRole)?.label} — কলাম তালিকা
              </h3>
              <Button size="sm" variant="outline" onClick={addColumn}>
                <Plus className="h-4 w-4 mr-1" /> নতুন কলাম
              </Button>
            </div>

            {currentColumns.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Columns3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">এই পদের জন্য কোনো কলাম নেই</p>
                  <p className="text-xs mt-1">একটি কলাম তৈরি করুন, তারপর ভেতরে ভ্যালু যোগ করুন</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={addColumn}>
                    <Plus className="h-4 w-4 mr-1" /> প্রথম কলাম যোগ করুন
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-wrap gap-3">
                {currentColumns.map((col, colIdx) => (
                  <ColumnCard
                    key={col.id}
                    column={col}
                    onUpdateColumn={(updates) => updateColumn(colIdx, updates)}
                    onRemoveColumn={() => removeColumn(colIdx)}
                    onAddOption={() => addOptionToColumn(colIdx)}
                    onUpdateOption={(optIdx, updates) => updateOptionInColumn(colIdx, optIdx, updates)}
                    onRemoveOption={(optIdx) => removeOptionFromColumn(colIdx, optIdx)}
                    expandedOptions={expandedOptions}
                    onToggleOption={toggleOption}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Overview Tab ─── */}
          <TabsContent value="overview" className="space-y-3">
            {roleConfigs.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  কোনো পদের জন্য কনফিগারেশন নেই
                </CardContent>
              </Card>
            ) : (
              roleConfigs.map(rc => {
                const roleInfo = SALES_ROLES.find(r => r.value === rc.role);
                if (rc.columns.length === 0) return null;
                return (
                  <Card key={rc.role}>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm">{roleInfo?.label || rc.role}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="space-y-2">
                        {rc.columns.map(col => (
                          <div key={col.id}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              📋 {col.name_bn || col.name || "কলাম"}
                            </p>
                            <div className="flex flex-wrap gap-1.5 ml-3">
                              {col.options.map(o => (
                                <span key={o.id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getColorClasses(o.color || "gray")}`}>
                                  {o.label_bn || o.label || o.value}
                                  {o.next_panel && (
                                    <span className="ml-1 opacity-60">→ {o.next_panel.toUpperCase()}</span>
                                  )}
                                </span>
                              ))}
                              {col.options.length === 0 && <span className="text-[10px] text-muted-foreground">কোনো ভ্যালু নেই</span>}
                            </div>
                          </div>
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
                        {liveLeads.map(lead => (
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
