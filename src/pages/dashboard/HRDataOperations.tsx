import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Save, GripVertical, ArrowRight, Settings2, Activity } from "lucide-react";

interface FieldConfig {
  id: string;
  key: string;
  label: string;
  label_bn: string;
  type: "text" | "number" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  visible_to?: string[];
}

interface RoutingRule {
  id: string;
  field: string;
  value: string;
  action: "set_status" | "create_order" | "archive" | "notify";
  target_status?: string;
  target_role?: string;
  description: string;
}

interface LiveLeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  status: string | null;
  agent_type: string | null;
  updated_at: string | null;
}

interface LiveOperationEvent {
  id: string;
  leadId: string;
  eventType: string;
  status: string;
  position: string;
  happenedAt: string;
}

const SALES_ROLES = [
  { value: "telesales_executive", label: "Telesales Executive (Bronze)" },
  { value: "silver_agent", label: "Silver Agent" },
  { value: "golden_agent", label: "Golden Agent" },
  { value: "cso", label: "CSO" },
  { value: "cs_executive", label: "CS Executive" },
  { value: "warehouse_assistant", label: "Warehouse Assistant" },
  { value: "warehouse_supervisor", label: "Warehouse Supervisor" },
  { value: "delivery_coordinator", label: "Delivery Coordinator" },
];

const FIELD_TYPES = [
  { value: "text", label: "টেক্সট" },
  { value: "number", label: "নম্বর" },
  { value: "select", label: "সিলেক্ট (ড্রপডাউন)" },
  { value: "textarea", label: "বড় টেক্সট" },
];

const ACTION_TYPES = [
  { value: "set_status", label: "স্ট্যাটাস পরিবর্তন" },
  { value: "create_order", label: "অর্ডার তৈরি" },
  { value: "archive", label: "আর্কাইভ" },
  { value: "notify", label: "নোটিফিকেশন পাঠাও" },
];

const NO_TARGET_ROLE = "__none__";

const normalizeFields = (raw: unknown): FieldConfig[] => {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const field = (item ?? {}) as Partial<FieldConfig>;
    const safeKey = field.key?.trim() || `field_${index + 1}`;

    return {
      id: field.id || `${safeKey}_${index}`,
      key: safeKey,
      label: field.label || "",
      label_bn: field.label_bn || "",
      type:
        field.type === "number" ||
        field.type === "select" ||
        field.type === "textarea" ||
        field.type === "text"
          ? field.type
          : "text",
      options: Array.isArray(field.options) ? field.options.filter(Boolean) : [],
      required: Boolean(field.required),
      visible_to: Array.isArray(field.visible_to) ? field.visible_to.filter(Boolean) : [],
    };
  });
};

const normalizeRules = (raw: unknown): RoutingRule[] => {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const rule = (item ?? {}) as Partial<RoutingRule>;

    return {
      id: rule.id || `rule_${index + 1}`,
      field: rule.field || "status",
      value: rule.value || "",
      action:
        rule.action === "create_order" ||
        rule.action === "archive" ||
        rule.action === "notify" ||
        rule.action === "set_status"
          ? rule.action
          : "set_status",
      target_status: rule.target_status || "",
      target_role: rule.target_role || "",
      description: rule.description || "",
    };
  });
};

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
};

export default function HRDataOperations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<string>("lead");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("fields");
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveOperationEvent[]>([]);

  const liveTabActive = activeTab === "live";
  const lastEventAtRef = useRef(0);

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-for-ops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status, data_mode")
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
    refetchOnWindowFocus: false,
  });

  const { data: liveLeads = [], isLoading: liveLoading } = useQuery({
    queryKey: ["hr-live-operations-data", selectedCampaign, selectedMode],
    queryFn: async () => {
      if (!selectedCampaign) return [] as LiveLeadRow[];

      let leadsQuery = supabase
        .from("leads")
        .select("id, name, phone, status, agent_type, updated_at")
        .eq("campaign_id", selectedCampaign)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (selectedMode === "lead") {
        leadsQuery = leadsQuery.eq("status", "fresh");
      } else {
        leadsQuery = leadsQuery.neq("status", "fresh");
      }

      const { data, error } = await leadsQuery;
      if (error) throw error;
      return (data || []) as LiveLeadRow[];
    },
    enabled: !!selectedCampaign && liveTabActive,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (existingConfig) {
      setFields(normalizeFields(existingConfig.fields_config));
      setRules(normalizeRules(existingConfig.routing_rules));
    } else {
      setFields([]);
      setRules([]);
    }
    setHasChanges(false);
  }, [existingConfig]);

  useEffect(() => {
    setLiveEvents([]);
  }, [selectedCampaign, selectedMode]);

  useEffect(() => {
    if (!selectedCampaign || !liveTabActive) return;

    const channel = supabase
      .channel(`hr-data-operations-live-${selectedCampaign}-${selectedMode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `campaign_id=eq.${selectedCampaign}`,
        },
        (payload) => {
          const row = ((payload.new as Partial<LiveLeadRow>) ||
            (payload.old as Partial<LiveLeadRow>) || {}) as Partial<LiveLeadRow>;

          const rowStatus = row.status || "";
          const isLeadModeRow = rowStatus === "fresh";

          if (selectedMode === "lead" && !isLeadModeRow) return;
          if (selectedMode === "processing" && isLeadModeRow) return;

          const now = Date.now();
          if (now - lastEventAtRef.current < 200) return;
          lastEventAtRef.current = now;

          setLiveEvents((prev) => [
            {
              id: `${payload.eventType}-${row.id || "unknown"}-${now}`,
              leadId: row.id || "unknown",
              eventType: payload.eventType,
              status: row.status || "—",
              position: row.agent_type || "—",
              happenedAt: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 30));

          queryClient.setQueryData<LiveLeadRow[]>(
            ["hr-live-operations-data", selectedCampaign, selectedMode],
            (previous = []) => {
              const listWithoutCurrent = previous.filter((item) => item.id !== row.id);
              const shouldKeep = row.id && payload.eventType !== "DELETE";

              if (!shouldKeep) return listWithoutCurrent.slice(0, 50);

              const nextRow: LiveLeadRow = {
                id: row.id || "",
                name: row.name || null,
                phone: row.phone || null,
                status: row.status || null,
                agent_type: row.agent_type || null,
                updated_at: row.updated_at || new Date().toISOString(),
              };

              return [nextRow, ...listWithoutCurrent].slice(0, 50);
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveTabActive, queryClient, selectedCampaign, selectedMode]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign || !user) throw new Error("Missing data");

      const payload = {
        campaign_id: selectedCampaign,
        data_mode: selectedMode,
        fields_config: JSON.parse(JSON.stringify(fields)),
        routing_rules: JSON.parse(JSON.stringify(rules)),
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (existingConfig?.id) {
        const { error } = await supabase
          .from("campaign_data_operations")
          .update(payload)
          .eq("id", existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("campaign_data_operations")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("কনফিগারেশন সেভ হয়েছে!");
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["data-operations-config", selectedCampaign, selectedMode] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const visibleFieldRows = useMemo(
    () =>
      fields
        .map((field, index) => ({ field, index }))
        .filter(({ field }) =>
          selectedRole === "all"
            ? true
            : !field.visible_to?.length || field.visible_to.includes(selectedRole)
        ),
    [fields, selectedRole]
  );

  const visibleRuleRows = useMemo(
    () =>
      rules
        .map((rule, index) => ({ rule, index }))
        .filter(({ rule }) =>
          selectedRole === "all" ? true : !rule.target_role || rule.target_role === selectedRole
        ),
    [rules, selectedRole]
  );

  const selectableFields = useMemo(
    () =>
      fields.filter(
        (field) =>
          field.type === "select" &&
          (selectedRole === "all" || !field.visible_to?.length || field.visible_to.includes(selectedRole))
      ),
    [fields, selectedRole]
  );

  const addField = () => {
    const id = `field_${Date.now()}`;
    setFields([
      ...fields,
      {
        id,
        key: id,
        label: "",
        label_bn: "",
        type: "text",
        options: [],
        required: false,
        visible_to: selectedRole === "all" ? [] : [selectedRole],
      },
    ]);
    setHasChanges(true);
  };

  const updateField = (index: number, updates: Partial<FieldConfig>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    setFields(updated);
    setHasChanges(true);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const addRule = () => {
    setRules([
      ...rules,
      {
        id: `rule_${Date.now()}`,
        field: "status",
        value: "",
        action: "set_status",
        target_status: "",
        target_role: selectedRole === "all" ? "" : selectedRole,
        description: "",
      },
    ]);
    setHasChanges(true);
  };

  const updateRule = (index: number, updates: Partial<RoutingRule>) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], ...updates };
    setRules(updated);
    setHasChanges(true);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            ডাটা অপারেশন কনফিগারেশন
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            ক্যাম্পেইন অনুযায়ী ফিল্ড, রাউটিং রুল এবং লাইভ অপারেশন মনিটর করুন
          </p>
        </div>
        {hasChanges && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>ক্যাম্পেইন নির্বাচন করুন</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="ক্যাম্পেইন সিলেক্ট করুন..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns?.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ডাটা মোড</Label>
              <Select value={selectedMode} onValueChange={setSelectedMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">লিড</SelectItem>
                  <SelectItem value="processing">প্রসেসিং</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>পদ/রোল</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব পদ</SelectItem>
                  {SALES_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {configLoading && (
            <p className="text-xs text-muted-foreground mt-3">কনফিগারেশন লোড হচ্ছে...</p>
          )}
        </CardContent>
      </Card>

      {selectedCampaign && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="fields">কাস্টম ফিল্ড ({visibleFieldRows.length})</TabsTrigger>
            <TabsTrigger value="routing">রাউটিং রুল ({visibleRuleRows.length})</TabsTrigger>
            <TabsTrigger value="live" className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              লাইভ ({liveEvents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                এজেন্টদের কাজের ইন্টারফেসে অতিরিক্ত ফিল্ড যোগ করুন (মূল ওয়েবসাইট ডাটা অক্ষত থাকবে)
              </p>
              <Button variant="outline" size="sm" onClick={addField}>
                <Plus className="h-4 w-4 mr-1" /> ফিল্ড যোগ করুন
              </Button>
            </div>

            {visibleFieldRows.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  এই পদের জন্য কোনো কাস্টম ফিল্ড নেই। "ফিল্ড যোগ করুন" বাটনে ক্লিক করুন।
                </CardContent>
              </Card>
            )}

            {visibleFieldRows.map(({ field, index }) => (
              <Card key={field.id} className="relative">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">ফিল্ড নাম (EN)</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(index, { label: e.target.value })}
                          placeholder="e.g. Product"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ফিল্ড নাম (বাংলা)</Label>
                        <Input
                          value={field.label_bn}
                          onChange={(e) => updateField(index, { label_bn: e.target.value })}
                          placeholder="e.g. প্রোডাক্ট"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ফিল্ড টাইপ</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) => updateField(index, { type: value as FieldConfig["type"] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((fieldType) => (
                              <SelectItem key={fieldType.value} value={fieldType.value}>
                                {fieldType.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">দৃশ্যমান (রোল)</Label>
                        <Select
                          value={field.visible_to?.[0] || "all"}
                          onValueChange={(value) =>
                            updateField(index, { visible_to: value === "all" ? [] : [value] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="সবাই" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">সবাই</SelectItem>
                            {SALES_ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {field.type === "select" && (
                        <div className="col-span-full space-y-1">
                          <Label className="text-xs">অপশনসমূহ (কমা দিয়ে আলাদা করুন)</Label>
                          <Input
                            value={field.options?.join(", ") || ""}
                            onChange={(e) =>
                              updateField(index, {
                                options: e.target.value
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="e.g. Product A, Product B, Product C"
                          />
                          <div className="flex flex-wrap gap-1 mt-1">
                            {field.options?.map((option, optionIndex) => (
                              <Badge key={optionIndex} variant="secondary" className="text-xs">
                                {option}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeField(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                ভ্যালু-ভিত্তিক রাউটিং কনফিগার করুন (পদ সিলেক্ট করে দ্রুত পরিবর্তন করা যাবে)
              </p>
              <Button variant="outline" size="sm" onClick={addRule}>
                <Plus className="h-4 w-4 mr-1" /> রুল যোগ করুন
              </Button>
            </div>

            {visibleRuleRows.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  এই পদের জন্য কোনো রাউটিং রুল নেই। "রুল যোগ করুন" বাটনে ক্লিক করুন।
                </CardContent>
              </Card>
            )}

            {visibleRuleRows.map(({ rule, index }) => (
              <Card key={rule.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">কোন ফিল্ডে</Label>
                          <Select value={rule.field} onValueChange={(value) => updateRule(index, { field: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="ফিল্ড সিলেক্ট..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="status">স্ট্যাটাস (Lead Status)</SelectItem>
                              {selectableFields.map((field) => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label || field.key}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">কোন ভ্যালু হলে</Label>
                          <Input
                            value={rule.value}
                            onChange={(e) => updateRule(index, { value: e.target.value })}
                            placeholder="e.g. confirmed"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">কী হবে</Label>
                          <Select
                            value={rule.action}
                            onValueChange={(value) => updateRule(index, { action: value as RoutingRule["action"] })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTION_TYPES.map((action) => (
                                <SelectItem key={action.value} value={action.value}>
                                  {action.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {(rule.action === "set_status" || rule.action === "create_order") && (
                          <div className="space-y-1">
                            <Label className="text-xs">টার্গেট স্ট্যাটাস</Label>
                            <Input
                              value={rule.target_status || ""}
                              onChange={(e) => updateRule(index, { target_status: e.target.value })}
                              placeholder="e.g. pending_cso"
                            />
                          </div>
                        )}
                        {(rule.action === "notify" || rule.action === "create_order") && (
                          <div className="space-y-1">
                            <Label className="text-xs">টার্গেট পদ</Label>
                            <Select
                              value={rule.target_role || ""}
                              onValueChange={(value) => updateRule(index, { target_role: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="পদ সিলেক্ট করুন..." />
                              </SelectTrigger>
                              <SelectContent>
                                {SALES_ROLES.map((role) => (
                                  <SelectItem key={role.value} value={role.value}>
                                    {role.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">বিবরণ</Label>
                          <Input
                            value={rule.description}
                            onChange={(e) => updateRule(index, { description: e.target.value })}
                            placeholder="এই রুলটি কী করে..."
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {rule.field || "?"}
                        </Badge>
                        <span>=</span>
                        <Badge variant="outline" className="text-xs">
                          {rule.value || "?"}
                        </Badge>
                        <ArrowRight className="h-3 w-3" />
                        <Badge className="text-xs bg-primary/10 text-primary border-0">
                          {ACTION_TYPES.find((action) => action.value === rule.action)?.label}
                        </Badge>
                        {rule.target_status && (
                          <>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="secondary" className="text-xs">
                              {rule.target_status}
                            </Badge>
                          </>
                        )}
                        {rule.target_role && (
                          <>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="secondary" className="text-xs">
                              {SALES_ROLES.find((role) => role.value === rule.target_role)?.label || rule.target_role}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeRule(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="live" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-muted-foreground">
                    এখানে সিলেক্ট করা ক্যাম্পেইনের ডাটা এবং চলমান অপারেশন লাইভ দেখা যাবে
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">ডাটা: {liveLeads.length}</Badge>
                    <Badge variant="outline">লাইভ ইভেন্ট: {liveEvents.length}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3">
                        {selectedMode === "lead" ? "লাইভ লিড ডাটা" : "লাইভ প্রসেসিং ডাটা"}
                      </h3>
                      {liveLoading ? (
                        <p className="text-sm text-muted-foreground">ডাটা লোড হচ্ছে...</p>
                      ) : liveLeads.length === 0 ? (
                        <p className="text-sm text-muted-foreground">এই ফিল্টারে কোনো ডাটা নেই।</p>
                      ) : (
                        <div className="max-h-[360px] overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>নাম</TableHead>
                                <TableHead>ফোন</TableHead>
                                <TableHead>স্ট্যাটাস</TableHead>
                                <TableHead>পদ</TableHead>
                                <TableHead>আপডেট</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {liveLeads.map((lead) => (
                                <TableRow key={lead.id}>
                                  <TableCell className="font-mono text-xs">{lead.id.slice(0, 8)}</TableCell>
                                  <TableCell>{lead.name || "—"}</TableCell>
                                  <TableCell>{lead.phone || "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="text-xs">
                                      {lead.status || "—"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{lead.agent_type || "—"}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {formatDateTime(lead.updated_at)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3">লাইভ অপারেশন লগ</h3>
                      {liveEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          এখনো কোনো লাইভ অপারেশন ধরা পড়েনি। ডাটা আপডেট হলে এখানে দেখা যাবে।
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[360px] overflow-auto">
                          {liveEvents.map((event) => (
                            <div
                              key={event.id}
                              className="rounded-md border border-border bg-card px-3 py-2 flex items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    {event.eventType}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {event.leadId.slice(0, 8)}
                                  </span>
                                  <Badge variant="secondary" className="text-xs">
                                    {event.status}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {event.position}
                                  </Badge>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDateTime(event.happenedAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
