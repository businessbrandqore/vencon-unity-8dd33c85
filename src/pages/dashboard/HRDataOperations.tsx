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
import { Plus, Save, Settings2, Activity, X, ChevronDown, ChevronUp, ArrowRight, Columns3, FileText } from "lucide-react";
import { sidebarMenus } from "@/lib/sidebarConfig";
import { translations } from "@/i18n/translations";

/* ─── Types ─── */
type AppPanel = "sa" | "hr" | "tl" | "employee";

interface RouteDestination {
  id: string;
  next_role: string;
  next_panel: AppPanel | "";
  next_location: string;
}

interface ColumnOption {
  id: string;
  value: string;
  label: string;
  label_bn: string;
  color?: string;
  next_panel?: AppPanel | "";
  next_location?: string;
  next_role?: string;
  routes?: RouteDestination[];
  note?: string;
  is_spam?: boolean;
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

// All roles with their panel mapping
const ALL_ROLES_WITH_PANEL: { value: string; label: string; panel: AppPanel }[] = [
  { value: "telesales_executive", label: "টেলিসেলস এক্সিকিউটিভ", panel: "employee" },
  { value: "cso", label: "CSO (Customer Security Officer)", panel: "employee" },
  { value: "cs_executive", label: "CS Executive", panel: "employee" },
  { value: "warehouse_assistant", label: "Warehouse Assistant", panel: "employee" },
  { value: "warehouse_supervisor", label: "Warehouse Supervisor", panel: "employee" },
  { value: "inventory_manager", label: "Inventory Manager", panel: "employee" },
  { value: "delivery_coordinator", label: "Delivery Coordinator", panel: "employee" },
  { value: "maintenance_officer", label: "Maintenance Officer", panel: "employee" },
  { value: "office_assistant", label: "Office Assistant", panel: "employee" },
  { value: "group_leader", label: "Group Leader", panel: "employee" },
  { value: "team_leader", label: "Team Leader", panel: "tl" },
  { value: "assistant_team_leader", label: "Assistant Team Leader (ATL)", panel: "tl" },
  { value: "Business Development And Marketing Manager", label: "BDO (বিডিও)", panel: "tl" },
  { value: "hr_manager", label: "HR Manager", panel: "hr" },
  { value: "hr_executive", label: "HR Executive", panel: "hr" },
  { value: "super_admin", label: "Super Admin", panel: "sa" },
];

const getRolePanelMap = (): Record<string, AppPanel> => {
  const map: Record<string, AppPanel> = {};
  ALL_ROLES_WITH_PANEL.forEach((r) => { map[r.value] = r.panel; });
  return map;
};
const ROLE_PANEL_MAP = getRolePanelMap();

// Dynamically build panel destinations from sidebarConfig
const PANEL_DESTINATIONS: Record<AppPanel, Array<{ value: string; label: string }>> = (() => {
  const result: Record<AppPanel, Array<{ value: string; label: string }>> = {
    sa: [], hr: [], tl: [], employee: [],
  };
  for (const panel of Object.keys(sidebarMenus) as AppPanel[]) {
    const seen = new Set<string>();
    result[panel] = sidebarMenus[panel]
      .map((item) => {
        // Extract the last segment of the path as the value
        const segments = item.path.split("/").filter(Boolean);
        const value = segments.slice(1).join("/") || segments[segments.length - 1];
        if (seen.has(value)) return null;
        seen.add(value);
        // Use translation label if available, else titleKey
        const t = translations[item.titleKey];
        const label = t ? t.bn : item.titleKey;
        return { value, label };
      })
      .filter(Boolean) as Array<{ value: string; label: string }>;
  }
  return result;
})();

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
                const nr = s.next_role || "";
                const np = nr ? (ROLE_PANEL_MAP[nr] || "") : (panelSet.has(s.next_panel) ? s.next_panel : "");
                const vl = np ? (PANEL_DESTINATIONS[np] || []) : [];
                // Parse routes array
                const parsedRoutes: RouteDestination[] = Array.isArray(s.routes)
                  ? s.routes.map((rt: any) => {
                      const rtRole = rt.next_role || "";
                      const rtPanel = rtRole ? (ROLE_PANEL_MAP[rtRole] || "") : "";
                      return {
                        id: rt.id || crypto.randomUUID?.() || `rt_${Date.now()}`,
                        next_role: rtRole,
                        next_panel: rtPanel,
                        next_location: rt.next_location || "",
                      };
                    })
                  : nr
                    ? [{ id: crypto.randomUUID?.() || `rt_${Date.now()}`, next_role: nr, next_panel: np, next_location: vl.some((l: any) => l.value === s.next_location) ? s.next_location : "" }]
                    : [];
                return {
                  id: s.id || crypto.randomUUID?.() || `opt_${Date.now()}`,
                  value: s.value || "",
                  label: s.label || "",
                  label_bn: s.label_bn || "",
                  color: s.color || "gray",
                  next_role: nr,
                  next_panel: np,
                  next_location: vl.some((l: any) => l.value === s.next_location) ? s.next_location : "",
                  routes: parsedRoutes,
                  note: s.note || "",
                  is_spam: !!s.is_spam,
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
  
  // Use routes array, fallback to single next_role for backward compat
  const routes: RouteDestination[] = option.routes?.length
    ? option.routes
    : option.next_role
      ? [{ id: crypto.randomUUID?.() || `rt_${Date.now()}`, next_role: option.next_role, next_panel: (option.next_panel || "") as AppPanel | "", next_location: option.next_location || "" }]
      : [];

  const hasRoutes = routes.some(r => r.next_role);

  const addRoute = () => {
    const newRoute: RouteDestination = { id: crypto.randomUUID?.() || `rt_${Date.now()}`, next_role: "", next_panel: "", next_location: "" };
    const updatedRoutes = [...routes, newRoute];
    onUpdate({ routes: updatedRoutes, next_role: updatedRoutes[0]?.next_role || "", next_panel: (updatedRoutes[0]?.next_panel || "") as AppPanel | "", next_location: updatedRoutes[0]?.next_location || "" });
  };

  const updateRoute = (idx: number, updates: Partial<RouteDestination>) => {
    const updatedRoutes = routes.map((r, i) => i === idx ? { ...r, ...updates } : r);
    // Keep first route synced with legacy fields
    onUpdate({ routes: updatedRoutes, next_role: updatedRoutes[0]?.next_role || "", next_panel: (updatedRoutes[0]?.next_panel || "") as AppPanel | "", next_location: updatedRoutes[0]?.next_location || "" });
  };

  const removeRoute = (idx: number) => {
    const updatedRoutes = routes.filter((_, i) => i !== idx);
    onUpdate({ routes: updatedRoutes, next_role: updatedRoutes[0]?.next_role || "", next_panel: (updatedRoutes[0]?.next_panel || "") as AppPanel | "", next_location: updatedRoutes[0]?.next_location || "" });
  };

  return (
    <div className={`border rounded-md overflow-hidden ${colorInfo.bg}`}>
      <div className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none" onClick={onToggle}>
        <span className={`w-2.5 h-2.5 rounded-full border flex-shrink-0 ${colorInfo.bg}`} style={{ borderColor: 'currentColor' }} />
        <span className={`text-xs font-medium flex-1 truncate ${colorInfo.text}`}>
          {option.label_bn || option.label || option.value || "নতুন অপশন"}
        </span>
        {hasRoutes && (
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

          {/* Routes (multiple destinations) */}
          <div className="border rounded-md p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground font-medium">কোথায় কোথায় যাবে</Label>
              <Button variant="outline" size="sm" className="h-5 text-[10px] px-2" onClick={addRoute}>
                <Plus className="h-2.5 w-2.5 mr-0.5" /> রুট যোগ
              </Button>
            </div>
            {routes.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-1">কোনো রুট নেই — এখানেই থাকবে</p>
            )}
            {routes.map((route, rIdx) => {
              const routePanel = route.next_role ? (ROLE_PANEL_MAP[route.next_role] || null) : null;
              const routeLocations = routePanel ? (PANEL_DESTINATIONS[routePanel] || []) : [];
              return (
                <div key={route.id} className="flex items-center gap-1.5 bg-muted/30 rounded px-1.5 py-1">
                  <span className="text-[10px] text-muted-foreground w-4 flex-shrink-0">{rIdx + 1}.</span>
                  <Select
                    value={route.next_role || NO_OPTION}
                    onValueChange={(v) => {
                      const role = v === NO_OPTION ? "" : v;
                      const panel = role ? (ROLE_PANEL_MAP[role] || "") : "";
                      updateRoute(rIdx, { next_role: role, next_panel: panel as AppPanel | "", next_location: "" });
                    }}
                  >
                    <SelectTrigger className="h-6 text-[10px] flex-1">
                      <SelectValue placeholder="পদ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_OPTION}>— নেই —</SelectItem>
                      {ALL_ROLES_WITH_PANEL.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={route.next_location || NO_OPTION}
                    onValueChange={(v) => updateRoute(rIdx, { next_location: v === NO_OPTION ? "" : v })}
                    disabled={!routePanel}
                  >
                    <SelectTrigger className="h-6 text-[10px] flex-1">
                      <SelectValue placeholder={routePanel ? "লোকেশন" : "—"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_OPTION}>— নেই —</SelectItem>
                      {routeLocations.map((loc) => (
                        <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0 text-destructive" onClick={() => removeRoute(rIdx)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground">নোট (ঐচ্ছিক)</Label>
              <Textarea
                value={option.note || ""}
                onChange={(e) => onUpdate({ note: e.target.value })}
                placeholder="নির্দেশনা..."
                className="mt-0.5 text-xs min-h-[40px]"
                rows={1}
              />
            </div>
            <div className="flex items-center gap-1.5 pt-3">
              <input
                type="checkbox"
                id={`spam-${option.id}`}
                checked={!!option.is_spam}
                onChange={(e) => onUpdate({ is_spam: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-muted-foreground"
              />
              <Label htmlFor={`spam-${option.id}`} className="text-[10px] text-destructive font-medium cursor-pointer whitespace-nowrap">
                স্প্যাম
              </Label>
            </div>
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
          {column.type === "note" ? (
            <FileText className="h-4 w-4 text-orange-500 flex-shrink-0" />
          ) : (
            <Columns3 className="h-4 w-4 text-primary flex-shrink-0" />
          )}
          <div className="flex-1 space-y-1">
            <div className="flex gap-1.5">
              <Input
                value={column.name}
                onChange={(e) => onUpdateColumn({ name: e.target.value })}
                placeholder="কলামের নাম (EN)"
                className="h-7 text-xs font-semibold flex-1"
              />
              <Select value={column.type} onValueChange={(v) => onUpdateColumn({ type: v as ColumnType })}>
                <SelectTrigger className="h-7 w-[100px] text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dropdown">ড্রপডাউন</SelectItem>
                  <SelectItem value="note">নোট</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          {column.type === "note" ? (
            /* ─── Note type: just a preview ─── */
            <div className="border border-dashed rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span className="text-xs">কর্মী এখানে ফ্রি-টেক্সট নোট লিখতে পারবে</span>
              </div>
              <div className="bg-muted/50 rounded-md p-2">
                <p className="text-[10px] text-muted-foreground mb-1">প্রিভিউ:</p>
                <div className="border rounded-md bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
                  {column.name_bn || column.name || "নোট"} লিখুন...
                </div>
              </div>
            </div>
          ) : (
            /* ─── Dropdown type: multiple options ─── */
            <>
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
            </>
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
    updateRoleColumns([...currentColumns, { id, name: "", name_bn: "", type: "dropdown", options: [] }]);
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
                              {col.type === "note" ? "📝" : "📋"} {col.name_bn || col.name || "কলাম"}
                              {col.type === "note" && <span className="ml-1 text-[10px] opacity-60">(নোট)</span>}
                            </p>
                            {col.type === "note" ? (
                              <p className="text-[10px] text-muted-foreground ml-3">ফ্রি-টেক্সট ইনপুট</p>
                            ) : (
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
                            )}
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
