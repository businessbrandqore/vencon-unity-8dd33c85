import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Save, GripVertical, ArrowRight, Settings2 } from "lucide-react";

interface FieldConfig {
  key: string;
  label: string;
  label_bn: string;
  type: "text" | "number" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  visible_to?: string[]; // roles that can see this field
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

export default function HRDataOperations() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<string>("lead");
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch campaigns
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
  });

  // Fetch existing config
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
  });

  // Load config when fetched
  useEffect(() => {
    if (existingConfig) {
      setFields((existingConfig.fields_config as unknown as FieldConfig[]) || []);
      setRules((existingConfig.routing_rules as unknown as RoutingRule[]) || []);
    } else {
      setFields([]);
      setRules([]);
    }
    setHasChanges(false);
  }, [existingConfig]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign || !user) throw new Error("Missing data");

      const payload = {
        campaign_id: selectedCampaign,
        data_mode: selectedMode,
        fields_config: fields as unknown as Record<string, unknown>[],
        routing_rules: rules as unknown as Record<string, unknown>[],
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
      queryClient.invalidateQueries({ queryKey: ["data-operations-config"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Field management
  const addField = () => {
    setFields([...fields, {
      key: `field_${Date.now()}`,
      label: "",
      label_bn: "",
      type: "text",
      options: [],
      required: false,
      visible_to: [],
    }]);
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

  // Rule management
  const addRule = () => {
    setRules([...rules, {
      id: `rule_${Date.now()}`,
      field: "",
      value: "",
      action: "set_status",
      target_status: "",
      target_role: "",
      description: "",
    }]);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            ডাটা অপারেশন কনফিগারেশন
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            ক্যাম্পেইন অনুযায়ী এজেন্টদের ডাটা ফিল্ড এবং রাউটিং রুল কনফিগার করুন
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ক্যাম্পেইন নির্বাচন করুন</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="ক্যাম্পেইন সিলেক্ট করুন..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
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
          </div>
        </CardContent>
      </Card>

      {selectedCampaign && (
        <Tabs defaultValue="fields" className="space-y-4">
          <TabsList>
            <TabsTrigger value="fields">
              কাস্টম ফিল্ড ({fields.length})
            </TabsTrigger>
            <TabsTrigger value="routing">
              রাউটিং রুল ({rules.length})
            </TabsTrigger>
          </TabsList>

          {/* Fields Tab */}
          <TabsContent value="fields" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                এজেন্টদের কাজের ইন্টারফেসে অতিরিক্ত ফিল্ড যোগ করুন। ওয়েবসাইটের আসল ডাটা অক্ষত থাকবে।
              </p>
              <Button variant="outline" size="sm" onClick={addField}>
                <Plus className="h-4 w-4 mr-1" /> ফিল্ড যোগ করুন
              </Button>
            </div>

            {fields.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  কোনো কাস্টম ফিল্ড নেই। "ফিল্ড যোগ করুন" বাটনে ক্লিক করুন।
                </CardContent>
              </Card>
            )}

            {fields.map((field, idx) => (
              <Card key={field.key} className="relative">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">ফিল্ড নাম (EN)</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(idx, { label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                          placeholder="e.g. Product"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ফিল্ড নাম (বাংলা)</Label>
                        <Input
                          value={field.label_bn}
                          onChange={(e) => updateField(idx, { label_bn: e.target.value })}
                          placeholder="e.g. প্রোডাক্ট"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ফিল্ড টাইপ</Label>
                        <Select
                          value={field.type}
                          onValueChange={(v) => updateField(idx, { type: v as FieldConfig["type"] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((ft) => (
                              <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">দৃশ্যমান (রোল)</Label>
                        <Select
                          value={field.visible_to?.[0] || "all"}
                          onValueChange={(v) => updateField(idx, { visible_to: v === "all" ? [] : [v] })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="সবাই" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">সবাই</SelectItem>
                            {SALES_ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Select options */}
                      {field.type === "select" && (
                        <div className="col-span-full space-y-1">
                          <Label className="text-xs">অপশনসমূহ (কমা দিয়ে আলাদা করুন)</Label>
                          <Input
                            value={field.options?.join(", ") || ""}
                            onChange={(e) => updateField(idx, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                            placeholder="e.g. Product A, Product B, Product C"
                          />
                          <div className="flex flex-wrap gap-1 mt-1">
                            {field.options?.map((opt, oi) => (
                              <Badge key={oi} variant="secondary" className="text-xs">{opt}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeField(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Routing Rules Tab */}
          <TabsContent value="routing" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                এজেন্ট কোনো ভ্যালু সিলেক্ট করলে ডাটা কোথায় যাবে তা নির্ধারণ করুন।
              </p>
              <Button variant="outline" size="sm" onClick={addRule}>
                <Plus className="h-4 w-4 mr-1" /> রুল যোগ করুন
              </Button>
            </div>

            {rules.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  কোনো রাউটিং রুল নেই। "রুল যোগ করুন" বাটনে ক্লিক করুন।
                </CardContent>
              </Card>
            )}

            {rules.map((rule, idx) => (
              <Card key={rule.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">কোন ফিল্ডে</Label>
                          <Select
                            value={rule.field}
                            onValueChange={(v) => updateRule(idx, { field: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="ফিল্ড সিলেক্ট..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="status">স্ট্যাটাস (Lead Status)</SelectItem>
                              {fields.filter(f => f.type === "select").map((f) => (
                                <SelectItem key={f.key} value={f.key}>{f.label || f.key}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">কোন ভ্যালু হলে</Label>
                          <Input
                            value={rule.value}
                            onChange={(e) => updateRule(idx, { value: e.target.value })}
                            placeholder="e.g. confirmed"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">কী হবে</Label>
                          <Select
                            value={rule.action}
                            onValueChange={(v) => updateRule(idx, { action: v as RoutingRule["action"] })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTION_TYPES.map((a) => (
                                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
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
                              onChange={(e) => updateRule(idx, { target_status: e.target.value })}
                              placeholder="e.g. pending_cso"
                            />
                          </div>
                        )}
                        {(rule.action === "notify" || rule.action === "create_order") && (
                          <div className="space-y-1">
                            <Label className="text-xs">টার্গেট রোল</Label>
                            <Select
                              value={rule.target_role || ""}
                              onValueChange={(v) => updateRule(idx, { target_role: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="রোল..." />
                              </SelectTrigger>
                              <SelectContent>
                                {SALES_ROLES.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">বিবরণ</Label>
                          <Input
                            value={rule.description}
                            onChange={(e) => updateRule(idx, { description: e.target.value })}
                            placeholder="এই রুলটি কী করে..."
                          />
                        </div>
                      </div>

                      {/* Visual flow */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                        <Badge variant="outline" className="text-xs">{rule.field || "?"}</Badge>
                        <span>=</span>
                        <Badge variant="outline" className="text-xs">{rule.value || "?"}</Badge>
                        <ArrowRight className="h-3 w-3" />
                        <Badge className="text-xs bg-primary/10 text-primary border-0">
                          {ACTION_TYPES.find(a => a.value === rule.action)?.label}
                        </Badge>
                        {rule.target_status && (
                          <>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="secondary" className="text-xs">{rule.target_status}</Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeRule(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
