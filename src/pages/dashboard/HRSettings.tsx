import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Settings, FileText, Plug, Bell, Clock, ShoppingBag, MessageCircle, Trash2, Cake } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const BLUE = "#1D4ED8";

interface Settings {
  company_logo?: string;
  favicon?: string;
  primary_color?: string;
  font?: string;
  invoice_layout?: string;
  invoice_language?: string;
  company_address?: string;
  company_phone?: string;
  whatsapp_sender?: string;
  whatsapp_api_key?: string;
  steadfast_api_key?: string;
  steadfast_secret_key?: string;
  ai_provider?: string;
  ai_api_key?: string;
  notification_sound?: string;
  cloudinary_cloud_name?: string;
  cloudinary_upload_preset?: string;
  cloudinary_api_key?: string;
  // Fraud checker courier credentials
  fc_steadfast_api_key?: string;
  fc_steadfast_secret_key?: string;
  fc_pathao_username?: string;
  fc_pathao_password?: string;
  fc_redx_access_token?: string;
}

interface DeductionTier {
  min_minutes: number;
  max_minutes: number;
  amount: number;
}

interface DeductionSettings {
  late_tiers: DeductionTier[];
  early_tiers: DeductionTier[];
}

const DEFAULT_DEDUCTION: DeductionSettings = {
  late_tiers: [
    { min_minutes: 1, max_minutes: 15, amount: 20 },
    { min_minutes: 16, max_minutes: 30, amount: 33 },
    { min_minutes: 31, max_minutes: 60, amount: 50 },
    { min_minutes: 61, max_minutes: 9999, amount: 100 },
  ],
  early_tiers: [
    { min_minutes: 1, max_minutes: 15, amount: 20 },
    { min_minutes: 16, max_minutes: 30, amount: 33 },
    { min_minutes: 31, max_minutes: 60, amount: 50 },
    { min_minutes: 61, max_minutes: 9999, amount: 100 },
  ],
};

const HRSettings = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const isBn = t("vencon") === "VENCON";

  const [settings, setSettings] = useState<Settings>({});
  const [deduction, setDeduction] = useState<DeductionSettings>(DEFAULT_DEDUCTION);
  const [giftNames, setGiftNames] = useState<string[]>([]);
  const [newGiftName, setNewGiftName] = useState("");
  const [productNames, setProductNames] = useState<string[]>([]);
  const [newProductName, setNewProductName] = useState("");
  const [cardNames, setCardNames] = useState<string[]>([]);
  const [newCardName, setNewCardName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [birthdayMessage, setBirthdayMessage] = useState("");
  const [birthdayMessageBn, setBirthdayMessageBn] = useState("");

  // Appeal reason options
  const [attendanceReasons, setAttendanceReasons] = useState<string[]>([]);
  const [newAttendanceReason, setNewAttendanceReason] = useState("");
  const [leaveReasons, setLeaveReasons] = useState<string[]>([]);
  const [newLeaveReason, setNewLeaveReason] = useState("");

  // WhatsApp template states
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [showWaModal, setShowWaModal] = useState(false);
  const [waName, setWaName] = useState("");
  const [waBody, setWaBody] = useState("");
  const [waImageUrl, setWaImageUrl] = useState("");
  const [waEditId, setWaEditId] = useState<string | null>(null);
  const waImageRef = useRef<HTMLInputElement>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const soundRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchSettings();
    fetchWaTemplates();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["ui_config", "invoice_config", "api_config", "notification_config", "attendance_deduction_config", "cloudinary_config", "gift_names", "product_names", "card_names", "fraud_checker_config", "appeal_reason_options", "birthday_config"]);

    const merged: Settings = {};
    (data || []).forEach((row) => {
      if (row.key === "gift_names") {
        if (row.value && Array.isArray(row.value)) setGiftNames(row.value as string[]);
      } else if (row.key === "product_names") {
        if (row.value && Array.isArray(row.value)) setProductNames(row.value as string[]);
      } else if (row.key === "card_names") {
        if (row.value && Array.isArray(row.value)) setCardNames(row.value as string[]);
      } else if (row.key === "appeal_reason_options") {
        const val = row.value as any;
        if (val?.attendance_reasons) setAttendanceReasons(val.attendance_reasons);
        if (val?.leave_reasons) setLeaveReasons(val.leave_reasons);
      } else if (row.key === "attendance_deduction_config") {
        const val = row.value as any;
        if (val?.late_tiers && val?.early_tiers) {
          setDeduction(val);
        } else if (val?.late_checkin_amount) {
          setDeduction({
            late_tiers: [{ min_minutes: 1, max_minutes: 9999, amount: Number(val.late_checkin_amount) || 33 }],
            early_tiers: [{ min_minutes: 1, max_minutes: 9999, amount: Number(val.early_checkout_amount) || 33 }],
          });
        }
      } else if (row.key === "cloudinary_config") {
        const val = row.value as Record<string, string>;
        Object.assign(merged, {
          cloudinary_cloud_name: val.cloud_name,
          cloudinary_upload_preset: val.upload_preset,
          cloudinary_api_key: val.api_key,
        });
      } else if (row.key === "fraud_checker_config") {
        const val = row.value as Record<string, string>;
        Object.assign(merged, {
          fc_steadfast_api_key: val.steadfast_api_key,
          fc_steadfast_secret_key: val.steadfast_secret_key,
          fc_pathao_username: val.pathao_username,
          fc_pathao_password: val.pathao_password,
          fc_redx_access_token: val.redx_access_token,
        });
      } else {
        const val = row.value as Record<string, string>;
        Object.assign(merged, val);
      }
    });
    setSettings(merged);
    setLoading(false);
  };

  const fetchWaTemplates = async () => {
    const { data } = await supabase.from("whatsapp_templates").select("*").order("created_at", { ascending: false });
    if (data) setWaTemplates(data);
  };

  const handleWaTemplateSave = async () => {
    if (!user || !waName.trim() || !waBody.trim()) return;
    setSaving(true);
    if (waEditId) {
      await supabase.from("whatsapp_templates").update({ name: waName, body: waBody, image_url: waImageUrl || null }).eq("id", waEditId);
    } else {
      await supabase.from("whatsapp_templates").insert({ name: waName, body: waBody, image_url: waImageUrl || null, created_by: user.id });
    }
    toast({ title: isBn ? "টেমপ্লেট সংরক্ষিত ✓" : "Template saved ✓" });
    setSaving(false);
    setShowWaModal(false);
    setWaName(""); setWaBody(""); setWaImageUrl(""); setWaEditId(null);
    fetchWaTemplates();
  };

  const handleWaTemplateDelete = async (id: string) => {
    await supabase.from("whatsapp_templates").delete().eq("id", id);
    toast({ title: isBn ? "মুছে ফেলা হয়েছে" : "Deleted" });
    fetchWaTemplates();
  };

  const handleWaImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = await uploadFile(file, "whatsapp-templates");
    if (url) setWaImageUrl(url);
  };

  const saveGroup = async (key: string, values: any) => {
    if (!user) return;
    setSaving(true);
    const { data: existing } = await supabase.from("app_settings").select("id").eq("key", key).maybeSingle();
    if (existing) {
      await supabase.from("app_settings").update({ value: values, updated_by: user.id, updated_at: new Date().toISOString() }).eq("key", key);
    } else {
      await supabase.from("app_settings").insert({ key, value: values as any, updated_by: user.id });
    }
    toast({ title: isBn ? "সংরক্ষিত ✓" : "Saved ✓" });
    setSaving(false);
  };

  const uploadToCloudinary = async (file: File, folder: string): Promise<string | null> => {
    const cloudName = settings.cloudinary_cloud_name;
    const uploadPreset = settings.cloudinary_upload_preset;
    if (!cloudName || !uploadPreset) {
      toast({ title: isBn ? "Cloudinary কনফিগারেশন সেট করুন (API ট্যাবে)" : "Set Cloudinary config in API tab", variant: "destructive" });
      return null;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", folder);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.secure_url) return data.secure_url;
      toast({ title: data.error?.message || "Upload failed", variant: "destructive" });
      return null;
    } catch (err: any) {
      toast({ title: err.message || "Upload failed", variant: "destructive" });
      return null;
    }
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    // Use Cloudinary if configured
    if (settings.cloudinary_cloud_name && settings.cloudinary_upload_preset) {
      return uploadToCloudinary(file, folder);
    }
    // Fallback to Supabase storage
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("app-assets").upload(path, file);
    if (error) { toast({ title: error.message, variant: "destructive" }); return null; }
    const { data } = supabase.storage.from("app-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = await uploadFile(file, "logos");
    if (url) { setSettings({ ...settings, company_logo: url }); saveGroup("ui_config", { ...settings, company_logo: url }); }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = await uploadFile(file, "favicons");
    if (url) { setSettings({ ...settings, favicon: url }); saveGroup("ui_config", { ...settings, favicon: url }); }
  };

  const handleSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 1024 * 1024) { toast({ title: isBn ? "ফাইল ১MB-এর বেশি" : "File exceeds 1MB", variant: "destructive" }); return; }
    const url = await uploadFile(file, "sounds");
    if (url) { setSettings({ ...settings, notification_sound: url }); saveGroup("notification_config", { notification_sound: url }); }
  };

  const playSound = () => {
    if (settings.notification_sound && audioRef.current) { audioRef.current.src = settings.notification_sound; audioRef.current.play(); }
  };

  const [testingService, setTestingService] = useState<string | null>(null);

  const testConnection = async (service: string) => {
    // Basic field validation first
    let valid = false;
    switch (service) {
      case "whatsapp": valid = !!(settings.whatsapp_sender && settings.whatsapp_api_key); break;
      case "steadfast": valid = !!(settings.steadfast_api_key && settings.steadfast_secret_key); break;
      case "ai": valid = !!(settings.ai_provider && settings.ai_api_key); break;
    }
    if (!valid) {
      toast({ title: isBn ? "সব ফিল্ড পূরণ করুন" : "Fill all fields", variant: "destructive" });
      return;
    }

    setTestingService(service);

    try {
      if (service === "steadfast") {
        const { data, error } = await supabase.functions.invoke("send-to-steadfast", {
          body: { test_connection: true, api_key: settings.steadfast_api_key, secret_key: settings.steadfast_secret_key },
        });
        if (error || !data?.success) {
          toast({ title: isBn ? "❌ SteadFast সংযোগ ব্যর্থ" : "❌ SteadFast connection failed", description: data?.error || error?.message || "Unknown error", variant: "destructive" });
        } else {
          toast({ title: isBn ? "✅ SteadFast সংযুক্ত!" : "✅ SteadFast connected!", description: isBn ? `ব্যালেন্স: ৳${data.balance || "N/A"}` : `Balance: ৳${data.balance || "N/A"}` });
        }
      } else {
        toast({ title: isBn ? "কনফিগারেশন সংরক্ষিত ✓" : "Configuration saved ✓" });
      }
    } catch (e) {
      toast({ title: isBn ? "পরীক্ষা ব্যর্থ" : "Test failed", variant: "destructive" });
    }
    setTestingService(null);
  };

  const set = (key: keyof Settings, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  // Deduction tier management
  const updateTier = (type: "late_tiers" | "early_tiers", index: number, field: keyof DeductionTier, value: number) => {
    setDeduction(prev => {
      const tiers = [...prev[type]];
      tiers[index] = { ...tiers[index], [field]: value };
      return { ...prev, [type]: tiers };
    });
  };

  const addTier = (type: "late_tiers" | "early_tiers") => {
    setDeduction(prev => {
      const tiers = [...prev[type]];
      const lastMax = tiers.length > 0 ? tiers[tiers.length - 1].max_minutes + 1 : 1;
      tiers.push({ min_minutes: lastMax, max_minutes: lastMax + 30, amount: 50 });
      return { ...prev, [type]: tiers };
    });
  };

  const removeTier = (type: "late_tiers" | "early_tiers", index: number) => {
    setDeduction(prev => {
      const tiers = prev[type].filter((_, i) => i !== index);
      return { ...prev, [type]: tiers };
    });
  };

  const saveDeduction = () => saveGroup("attendance_deduction_config", deduction);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">{isBn ? "লোড হচ্ছে..." : "Loading..."}</div>;
  }

  const fieldClass = "bg-background border-border text-foreground";

  const renderTierTable = (type: "late_tiers" | "early_tiers", title: string) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-body text-xs font-bold text-foreground">{title}</h4>
        <Button variant="outline" size="sm" onClick={() => addTier(type)} className="h-7 text-[10px]">
          <Plus className="h-3 w-3 mr-1" /> {isBn ? "নতুন স্তর" : "Add Tier"}
        </Button>
      </div>
      <div className="border border-border">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="bg-secondary text-muted-foreground text-[11px]">
              <th className="text-left p-2">{isBn ? "শুরু (মিনিট)" : "From (min)"}</th>
              <th className="text-left p-2">{isBn ? "শেষ (মিনিট)" : "To (min)"}</th>
              <th className="text-left p-2">{isBn ? "কর্তন (৳)" : "Deduction (৳)"}</th>
              <th className="text-right p-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {deduction[type].map((tier, i) => (
              <tr key={i}>
                <td className="p-2">
                  <Input type="number" min={0} value={tier.min_minutes} onChange={(e) => updateTier(type, i, "min_minutes", Number(e.target.value))} className={`${fieldClass} h-8 w-20 text-xs`} />
                </td>
                <td className="p-2">
                  <Input type="number" min={0} value={tier.max_minutes >= 9999 ? "" : tier.max_minutes} onChange={(e) => updateTier(type, i, "max_minutes", e.target.value ? Number(e.target.value) : 9999)} className={`${fieldClass} h-8 w-20 text-xs`} placeholder="∞" />
                </td>
                <td className="p-2">
                  <Input type="number" min={0} value={tier.amount} onChange={(e) => updateTier(type, i, "amount", Number(e.target.value))} className={`${fieldClass} h-8 w-20 text-xs`} />
                </td>
                <td className="p-2 text-right">
                  {deduction[type].length > 1 && (
                    <button onClick={() => removeTier(type, i)} className="text-destructive hover:text-destructive/80">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="font-heading text-2xl font-bold text-foreground">
        {isBn ? "সেটিংস" : "Settings"}
      </h2>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full grid grid-cols-7 bg-secondary">
          <TabsTrigger value="general" className="text-xs gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isBn ? "সাধারণ" : "General"}</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isBn ? "পণ্য/গিফট" : "Products"}</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="invoice" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isBn ? "ইনভয়েস" : "Invoice"}</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isBn ? "কর্তন" : "Deduction"}</span>
          </TabsTrigger>
          <TabsTrigger value="api" className="text-xs gap-1.5">
            <Plug className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">API</span>
          </TabsTrigger>
          <TabsTrigger value="notification" className="text-xs gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isBn ? "সাউন্ড" : "Sound"}</span>
          </TabsTrigger>
        </TabsList>

        {/* General / UI Tab */}
        <TabsContent value="general" className="mt-4">
          <div className="border border-border p-4 space-y-4">
            <h3 className="font-heading text-sm font-bold text-foreground">
              {isBn ? "UI কাস্টমাইজেশন" : "UI Customization"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">
                  {isBn ? "কোম্পানি লোগো" : "Company Logo"} (PNG/JPG)
                </label>
                {settings.company_logo && <img src={settings.company_logo} alt="Logo" className="h-12 mb-2 object-contain" />}
                <input ref={logoRef} type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload} className="hidden" />
                <button onClick={() => logoRef.current?.click()} className="text-xs px-3 py-1.5 border border-border text-foreground hover:bg-secondary">
                  {isBn ? "আপলোড করুন" : "Upload"}
                </button>
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">Favicon</label>
                {settings.favicon && <img src={settings.favicon} alt="Favicon" className="h-8 mb-2" />}
                <input ref={faviconRef} type="file" accept="image/png,image/x-icon" onChange={handleFaviconUpload} className="hidden" />
                <button onClick={() => faviconRef.current?.click()} className="text-xs px-3 py-1.5 border border-border text-foreground hover:bg-secondary">
                  {isBn ? "আপলোড করুন" : "Upload"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">{isBn ? "প্রাইমারি কালার" : "Primary Color"}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.primary_color || "#1D4ED8"} onChange={(e) => set("primary_color", e.target.value)} className="w-10 h-10 border border-border cursor-pointer" />
                  <Input value={settings.primary_color || "#1D4ED8"} onChange={(e) => set("primary_color", e.target.value)} className={`${fieldClass} w-32`} />
                </div>
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">{isBn ? "ফন্ট" : "Font"}</label>
                <Select value={settings.font || "atkinson"} onValueChange={(v) => set("font", v)}>
                  <SelectTrigger className={`${fieldClass} w-full`}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="atkinson">Atkinson Hyperlegible</SelectItem>
                    <SelectItem value="arimo">Arimo</SelectItem>
                    <SelectItem value="noto_sans_bengali">Noto Sans Bengali</SelectItem>
                    <SelectItem value="inter">Inter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <button onClick={() => saveGroup("ui_config", { company_logo: settings.company_logo, favicon: settings.favicon, primary_color: settings.primary_color, font: settings.font })} disabled={saving} className="px-4 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: BLUE }}>
              {isBn ? "সংরক্ষণ" : "Save"}
            </button>
          </div>
        </TabsContent>

        {/* Products & Gifts Tab */}
        <TabsContent value="products" className="mt-4">
          <div className="border border-border p-4 space-y-6">
            {/* Product Names */}
            <div className="space-y-3">
              <h3 className="font-heading text-sm font-bold text-foreground">
                {isBn ? "প্রোডাক্ট তালিকা" : "Product List"}
              </h3>
              <p className="text-xs text-muted-foreground font-body">
                {isBn ? "অর্ডার ফর্মে যে প্রোডাক্টের নাম ড্রপডাউনে দেখাবে।" : "Product names shown in order form dropdown."}
              </p>
              <div className="flex gap-2">
                <Input
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder={isBn ? "প্রোডাক্টের নাম লিখুন" : "Enter product name"}
                  className="bg-background border-border text-foreground flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newProductName.trim()) {
                      const updated = [...productNames, newProductName.trim()];
                      setProductNames(updated);
                      setNewProductName("");
                      saveGroup("product_names", updated);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!newProductName.trim()) return;
                    const updated = [...productNames, newProductName.trim()];
                    setProductNames(updated);
                    setNewProductName("");
                    saveGroup("product_names", updated);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> {isBn ? "যোগ" : "Add"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {productNames.map((name, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-body bg-secondary text-foreground border border-border rounded">
                    {name}
                    <button
                      onClick={() => {
                        const updated = productNames.filter((_, idx) => idx !== i);
                        setProductNames(updated);
                        saveGroup("product_names", updated);
                      }}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {productNames.length === 0 && (
                  <span className="text-xs text-muted-foreground font-body">{isBn ? "কোনো প্রোডাক্ট যোগ করা হয়নি" : "No products added"}</span>
                )}
              </div>
            </div>

              <div className="border-t border-border" />

            {/* Card Names */}
            <div className="space-y-3">
              <h3 className="font-heading text-sm font-bold text-foreground">
                {isBn ? "কার্ড তালিকা" : "Card List"}
              </h3>
              <p className="text-xs text-muted-foreground font-body">
                {isBn ? "অর্ডার ফর্মে যে কার্ডের নাম ড্রপডাউনে দেখাবে।" : "Card names shown in order form dropdown."}
              </p>
              <div className="flex gap-2">
                <Input
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  placeholder={isBn ? "কার্ডের নাম লিখুন" : "Enter card name"}
                  className="bg-background border-border text-foreground flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCardName.trim()) {
                      const updated = [...cardNames, newCardName.trim()];
                      setCardNames(updated);
                      setNewCardName("");
                      saveGroup("card_names", updated);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!newCardName.trim()) return;
                    const updated = [...cardNames, newCardName.trim()];
                    setCardNames(updated);
                    setNewCardName("");
                    saveGroup("card_names", updated);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> {isBn ? "যোগ" : "Add"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {cardNames.map((name, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-body bg-secondary text-foreground border border-border rounded">
                    {name}
                    <button
                      onClick={() => {
                        const updated = cardNames.filter((_, idx) => idx !== i);
                        setCardNames(updated);
                        saveGroup("card_names", updated);
                      }}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {cardNames.length === 0 && (
                  <span className="text-xs text-muted-foreground font-body">{isBn ? "কোনো কার্ড যোগ করা হয়নি" : "No cards added"}</span>
                )}
              </div>
            </div>

              <div className="border-t border-border" />

            {/* Gift Names */}
            <div className="space-y-3">
              <h3 className="font-heading text-sm font-bold text-foreground">
                {isBn ? "গিফট তালিকা" : "Gift List"}
              </h3>
              <p className="text-xs text-muted-foreground font-body">
                {isBn ? "অর্ডার ফর্মে যে গিফটের নাম ড্রপডাউনে দেখাবে।" : "Gift names shown in order form dropdown."}
              </p>
              <div className="flex gap-2">
                <Input
                  value={newGiftName}
                  onChange={(e) => setNewGiftName(e.target.value)}
                  placeholder={isBn ? "গিফটের নাম লিখুন" : "Enter gift name"}
                  className="bg-background border-border text-foreground flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newGiftName.trim()) {
                      const updated = [...giftNames, newGiftName.trim()];
                      setGiftNames(updated);
                      setNewGiftName("");
                      saveGroup("gift_names", updated);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!newGiftName.trim()) return;
                    const updated = [...giftNames, newGiftName.trim()];
                    setGiftNames(updated);
                    setNewGiftName("");
                    saveGroup("gift_names", updated);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> {isBn ? "যোগ" : "Add"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {giftNames.map((name, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-body bg-secondary text-foreground border border-border rounded">
                    {name}
                    <button
                      onClick={() => {
                        const updated = giftNames.filter((_, idx) => idx !== i);
                        setGiftNames(updated);
                        saveGroup("gift_names", updated);
                      }}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {giftNames.length === 0 && (
                  <span className="text-xs text-muted-foreground font-body">{isBn ? "কোনো গিফট যোগ করা হয়নি" : "No gifts added"}</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* WhatsApp Templates Tab */}
        <TabsContent value="whatsapp" className="mt-4">
          <div className="border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-sm font-bold text-foreground">
                  {isBn ? "WhatsApp টেমপ্লেট" : "WhatsApp Templates"}
                </h3>
                <p className="text-xs text-muted-foreground font-body mt-1">
                  {isBn ? "এজেন্টরা লিড শীট থেকে এই টেমপ্লেটগুলো ব্যবহার করে WhatsApp মেসেজ পাঠাতে পারবে।" : "Agents can use these templates to send WhatsApp messages from the lead sheet."}
                </p>
              </div>
              <Button size="sm" onClick={() => { setWaEditId(null); setWaName(""); setWaBody(""); setWaImageUrl(""); setShowWaModal(true); }} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> {isBn ? "নতুন টেমপ্লেট" : "New Template"}
              </Button>
            </div>

            {waTemplates.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {isBn ? "কোনো টেমপ্লেট নেই। উপরে 'নতুন টেমপ্লেট' ক্লিক করুন।" : "No templates yet. Click 'New Template' above."}
              </div>
            ) : (
              <div className="grid gap-3">
                {waTemplates.map(tpl => (
                  <div key={tpl.id} className="border border-border p-3 flex gap-3 items-start">
                    {tpl.image_url && (
                      <img src={tpl.image_url} alt={tpl.name} className="w-16 h-16 object-cover rounded border border-border flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-body text-sm font-bold text-foreground">{tpl.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap line-clamp-3">{tpl.body}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => { setWaEditId(tpl.id); setWaName(tpl.name); setWaBody(tpl.body); setWaImageUrl(tpl.image_url || ""); setShowWaModal(true); }} className="text-xs px-2 py-1 border border-border text-foreground hover:bg-secondary">
                        {isBn ? "সম্পাদনা" : "Edit"}
                      </button>
                      <button onClick={() => handleWaTemplateDelete(tpl.id)} className="text-xs px-2 py-1 border border-destructive/30 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* WhatsApp Template Modal */}
        <Dialog open={showWaModal} onOpenChange={setShowWaModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{waEditId ? (isBn ? "টেমপ্লেট সম্পাদনা" : "Edit Template") : (isBn ? "নতুন টেমপ্লেট" : "New Template")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{isBn ? "টেমপ্লেট নাম" : "Template Name"}</Label>
                <Input value={waName} onChange={e => setWaName(e.target.value)} className="mt-1" placeholder={isBn ? "যেমন: অর্ডার কনফার্মেশন" : "e.g. Order Confirmation"} />
              </div>
              <div>
                <Label>{isBn ? "মেসেজ বডি" : "Message Body"}</Label>
                <p className="text-[10px] text-muted-foreground mb-1">
                  {isBn ? "{{name}}, {{phone}}, {{address}} ব্যবহার করলে অটো রিপ্লেস হবে" : "Use {{name}}, {{phone}}, {{address}} for auto-replacement"}
                </p>
                <Textarea value={waBody} onChange={e => setWaBody(e.target.value)} className="mt-1" rows={4} placeholder={isBn ? "আসসালামু আলাইকুম {{name}}, আপনার অর্ডার..." : "Hello {{name}}, your order..."} />
              </div>
              <div>
                <Label>{isBn ? "ছবি (ঐচ্ছিক)" : "Image (Optional)"}</Label>
                {waImageUrl && <img src={waImageUrl} alt="template" className="w-20 h-20 object-cover rounded mt-1 mb-1 border border-border" />}
                <input ref={waImageRef} type="file" accept="image/*" onChange={handleWaImageUpload} className="hidden" />
                <button onClick={() => waImageRef.current?.click()} className="mt-1 text-xs px-3 py-1.5 border border-border text-foreground hover:bg-secondary">
                  {waImageUrl ? (isBn ? "ছবি পরিবর্তন" : "Change Image") : (isBn ? "ছবি আপলোড" : "Upload Image")}
                </button>
                {waImageUrl && <button onClick={() => setWaImageUrl("")} className="ml-2 text-xs text-destructive">{isBn ? "মুছুন" : "Remove"}</button>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWaModal(false)}>{isBn ? "বাতিল" : "Cancel"}</Button>
              <Button onClick={handleWaTemplateSave} disabled={saving || !waName.trim() || !waBody.trim()}>
                {saving ? "..." : (isBn ? "সংরক্ষণ" : "Save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        <TabsContent value="invoice" className="mt-4">
          <div className="border border-border p-4 space-y-4">
            <h3 className="font-heading text-sm font-bold text-foreground">{isBn ? "ইনভয়েস সেটিংস" : "Invoice Settings"}</h3>
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-2">{isBn ? "লেআউট" : "Layout"}</label>
              <div className="flex gap-3">
                {["4_per_a4", "6_per_a4", "9_per_a4"].map((layout) => (
                  <label key={layout} className="flex items-center gap-1.5 text-xs font-body text-foreground cursor-pointer">
                    <input type="radio" name="invoice_layout" checked={settings.invoice_layout === layout} onChange={() => set("invoice_layout", layout)} className="accent-[#1D4ED8]" />
                    {layout.replace("_per_a4", " per A4")}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">{isBn ? "ভাষা" : "Language"}</label>
              <div className="bg-secondary p-2 text-xs text-foreground font-body">বাংলা (Bengali) — {isBn ? "স্থায়ী" : "Fixed"}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">{isBn ? "কোম্পানি ঠিকানা" : "Company Address"}</label>
                <Textarea value={settings.company_address || ""} onChange={(e) => set("company_address", e.target.value)} className={`${fieldClass} min-h-[60px]`} />
              </div>
              <div>
                <label className="font-body text-xs text-muted-foreground block mb-1">{isBn ? "কোম্পানি ফোন" : "Company Phone"}</label>
                <Input value={settings.company_phone || ""} onChange={(e) => set("company_phone", e.target.value)} className={fieldClass} />
              </div>
            </div>
            <button onClick={() => saveGroup("invoice_config", { invoice_layout: settings.invoice_layout, invoice_language: "bn", company_address: settings.company_address, company_phone: settings.company_phone })} disabled={saving} className="px-4 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: BLUE }}>
              {isBn ? "সংরক্ষণ" : "Save"}
            </button>
          </div>
        </TabsContent>

        {/* Attendance Deduction Tab */}
        <TabsContent value="attendance" className="mt-4">
          <div className="border border-border p-4 space-y-6">
            <div>
              <h3 className="font-heading text-sm font-bold text-foreground">
                {isBn ? "উপস্থিতি কর্তন সেটিংস" : "Attendance Deduction Settings"}
              </h3>
              <p className="text-xs text-muted-foreground font-body mt-1">
                {isBn ? "কত মিনিট দেরিতে চেক ইন বা আগে চেক আউট করলে কত টাকা কাটা যাবে তা এখান থেকে নির্ধারণ করুন। একাধিক স্তর (tier) যোগ করা যাবে।" : "Configure tiered deduction amounts based on how many minutes late or early."}
              </p>
            </div>

            {renderTierTable("late_tiers", isBn ? "দেরিতে চেক ইন কর্তন" : "Late Check-In Deduction")}
            {renderTierTable("early_tiers", isBn ? "আগে চেক আউট কর্তন" : "Early Check-Out Deduction")}

            <button onClick={saveDeduction} disabled={saving} className="px-4 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: BLUE }}>
              {isBn ? "সংরক্ষণ" : "Save"}
            </button>

            {/* Appeal Reason Options */}
            <div className="border-t border-border pt-6 mt-6">
              <h3 className="font-heading text-sm font-bold text-foreground">
                {isBn ? "আপিল/ছুটির কারণ অপশন" : "Appeal & Leave Reason Options"}
              </h3>
              <p className="text-xs text-muted-foreground font-body mt-1 mb-4">
                {isBn ? "কর্মীরা আপিল বা ছুটির আবেদনে এই অপশনগুলো থেকে কারণ নির্বাচন করতে পারবে।" : "Employees can select from these options when submitting appeals or leave requests."}
              </p>

              {/* Attendance Appeal Reasons */}
              <div className="mb-4">
                <label className="font-body text-xs font-bold text-foreground block mb-2">
                  {isBn ? "কর্তন আপিল কারণ" : "Attendance Appeal Reasons"}
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {attendanceReasons.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground">
                      {r}
                      <button onClick={() => setAttendanceReasons(prev => prev.filter((_, idx) => idx !== i))} className="text-destructive hover:text-destructive/80 ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {attendanceReasons.length === 0 && <span className="text-xs text-muted-foreground">{isBn ? "কোনো অপশন নেই" : "No options"}</span>}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newAttendanceReason}
                    onChange={(e) => setNewAttendanceReason(e.target.value)}
                    placeholder={isBn ? "যেমন: যানজট, অসুস্থতা..." : "e.g. Traffic jam, Illness..."}
                    className="text-xs h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newAttendanceReason.trim()) {
                        setAttendanceReasons(prev => [...prev, newAttendanceReason.trim()]);
                        setNewAttendanceReason("");
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newAttendanceReason.trim()) {
                        setAttendanceReasons(prev => [...prev, newAttendanceReason.trim()]);
                        setNewAttendanceReason("");
                      }
                    }}
                    className="px-3 h-8 text-xs border border-border text-foreground hover:bg-secondary flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> {isBn ? "যোগ" : "Add"}
                  </button>
                </div>
              </div>

              {/* Leave Reasons */}
              <div className="mb-4">
                <label className="font-body text-xs font-bold text-foreground block mb-2">
                  {isBn ? "ছুটির আবেদন কারণ" : "Leave Request Reasons"}
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {leaveReasons.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground">
                      {r}
                      <button onClick={() => setLeaveReasons(prev => prev.filter((_, idx) => idx !== i))} className="text-destructive hover:text-destructive/80 ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {leaveReasons.length === 0 && <span className="text-xs text-muted-foreground">{isBn ? "কোনো অপশন নেই" : "No options"}</span>}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newLeaveReason}
                    onChange={(e) => setNewLeaveReason(e.target.value)}
                    placeholder={isBn ? "যেমন: পারিবারিক কারণ, চিকিৎসা..." : "e.g. Family emergency, Medical..."}
                    className="text-xs h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newLeaveReason.trim()) {
                        setLeaveReasons(prev => [...prev, newLeaveReason.trim()]);
                        setNewLeaveReason("");
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newLeaveReason.trim()) {
                        setLeaveReasons(prev => [...prev, newLeaveReason.trim()]);
                        setNewLeaveReason("");
                      }
                    }}
                    className="px-3 h-8 text-xs border border-border text-foreground hover:bg-secondary flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> {isBn ? "যোগ" : "Add"}
                  </button>
                </div>
              </div>

              <button
                onClick={() => saveGroup("appeal_reason_options", { attendance_reasons: attendanceReasons, leave_reasons: leaveReasons })}
                disabled={saving}
                className="px-4 py-1.5 text-xs font-bold text-white"
                style={{ backgroundColor: BLUE }}
              >
                {isBn ? "কারণ অপশন সংরক্ষণ" : "Save Reason Options"}
              </button>
            </div>
          </div>
        </TabsContent>

        {/* API Tab */}
        <TabsContent value="api" className="mt-4">
          <div className="border border-border p-4 space-y-4">
            <h3 className="font-heading text-sm font-bold text-foreground">{isBn ? "API কনফিগারেশন" : "API Configuration"}</h3>
            
            {/* Cloudinary */}
            <div className="border-b border-border pb-4">
              <h4 className="font-body text-xs font-bold text-foreground mb-1">Cloudinary {isBn ? "(ছবি আপলোড)" : "(Image Upload)"}</h4>
              <p className="text-[10px] text-muted-foreground font-body mb-2">
                {isBn ? "একবার সংরক্ষণ করলে সব ছবি Cloudinary তে আপলোড হবে।" : "Once saved, all images will upload to Cloudinary."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="font-body text-[10px] text-muted-foreground block mb-1">Cloud Name</label><Input value={settings.cloudinary_cloud_name || ""} onChange={(e) => set("cloudinary_cloud_name", e.target.value)} className={fieldClass} placeholder="my-cloud" /></div>
                <div><label className="font-body text-[10px] text-muted-foreground block mb-1">Upload Preset</label><Input value={settings.cloudinary_upload_preset || ""} onChange={(e) => set("cloudinary_upload_preset", e.target.value)} className={fieldClass} placeholder="unsigned_preset" /></div>
                <div><label className="font-body text-[10px] text-muted-foreground block mb-1">API Key ({isBn ? "ঐচ্ছিক" : "Optional"})</label><Input value={settings.cloudinary_api_key || ""} onChange={(e) => set("cloudinary_api_key", e.target.value)} className={fieldClass} /></div>
              </div>
              {settings.cloudinary_cloud_name && settings.cloudinary_upload_preset && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-green-500 font-body">✓ {isBn ? "সংযুক্ত" : "Connected"}</span>
                </div>
              )}
              <button onClick={() => saveGroup("cloudinary_config", { cloud_name: settings.cloudinary_cloud_name, upload_preset: settings.cloudinary_upload_preset, api_key: settings.cloudinary_api_key })} disabled={saving} className="mt-2 text-[10px] px-2 py-1 border border-border text-foreground hover:bg-secondary">
                {isBn ? "সংরক্ষণ" : "Save"}
              </button>
            </div>

            {/* WhatsApp */}
            <div className="border-b border-border pb-4">
              <h4 className="font-body text-xs font-bold text-foreground mb-2">WhatsApp Business API</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="font-body text-[10px] text-muted-foreground block mb-1">Sender Number</label><Input value={settings.whatsapp_sender || ""} onChange={(e) => set("whatsapp_sender", e.target.value)} className={fieldClass} placeholder="+880..." /></div>
                <div><label className="font-body text-[10px] text-muted-foreground block mb-1">API Key</label><Input type="password" value={settings.whatsapp_api_key || ""} onChange={(e) => set("whatsapp_api_key", e.target.value)} className={fieldClass} /></div>
              </div>
              <button onClick={() => { saveGroup("api_config", { whatsapp_sender: settings.whatsapp_sender, whatsapp_api_key: settings.whatsapp_api_key, steadfast_api_key: settings.steadfast_api_key, steadfast_secret_key: settings.steadfast_secret_key, ai_provider: settings.ai_provider, ai_api_key: settings.ai_api_key }); testConnection("whatsapp"); }} className="mt-2 text-[10px] px-2 py-1 border border-border text-foreground hover:bg-secondary">
                {isBn ? "সংরক্ষণ ও পরীক্ষা" : "Save & Test"}
              </button>
            </div>
            {/* SteadFast */}
            <div className="border-b border-border pb-4">
              <h4 className="font-body text-xs font-bold text-foreground mb-2">SteadFast Courier API</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="font-body text-[10px] text-muted-foreground block mb-1">API Key</label><Input type="password" value={settings.steadfast_api_key || ""} onChange={(e) => set("steadfast_api_key", e.target.value)} className={fieldClass} /></div>
                <div><label className="font-body text-[10px] text-muted-foreground block mb-1">Secret Key</label><Input type="password" value={settings.steadfast_secret_key || ""} onChange={(e) => set("steadfast_secret_key", e.target.value)} className={fieldClass} /></div>
              </div>
              <button onClick={() => { saveGroup("api_config", { whatsapp_sender: settings.whatsapp_sender, whatsapp_api_key: settings.whatsapp_api_key, steadfast_api_key: settings.steadfast_api_key, steadfast_secret_key: settings.steadfast_secret_key, ai_provider: settings.ai_provider, ai_api_key: settings.ai_api_key }); testConnection("steadfast"); }} className="mt-2 text-[10px] px-2 py-1 border border-border text-foreground hover:bg-secondary">
                {isBn ? "সংরক্ষণ ও পরীক্ষা" : "Save & Test"}
              </button>
            </div>
            {/* AI Chatbot */}
            <div>
              <h4 className="font-body text-xs font-bold text-foreground mb-2">AI Chatbot</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-body text-[10px] text-muted-foreground block mb-1">Provider</label>
                  <Select value={settings.ai_provider || ""} onValueChange={(v) => set("ai_provider", v)}>
                    <SelectTrigger className={`${fieldClass} w-full`}><SelectValue placeholder={isBn ? "নির্বাচন করুন" : "Select"} /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="openai">OpenAI GPT-4</SelectItem>
                      <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                      <SelectItem value="google">Google Gemini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><label className="font-body text-[10px] text-muted-foreground block mb-1">API Key</label><Input type="password" value={settings.ai_api_key || ""} onChange={(e) => set("ai_api_key", e.target.value)} className={fieldClass} /></div>
              </div>
              <button onClick={() => { saveGroup("api_config", { whatsapp_sender: settings.whatsapp_sender, whatsapp_api_key: settings.whatsapp_api_key, steadfast_api_key: settings.steadfast_api_key, steadfast_secret_key: settings.steadfast_secret_key, ai_provider: settings.ai_provider, ai_api_key: settings.ai_api_key }); testConnection("ai"); }} className="mt-2 text-[10px] px-2 py-1 border border-border text-foreground hover:bg-secondary">
                {isBn ? "সংরক্ষণ ও পরীক্ষা" : "Save & Test"}
              </button>
            </div>
            {/* Fraud Checker - Individual Courier APIs */}
            <div className="border-t border-border pt-4">
              <h4 className="font-body text-xs font-bold text-foreground mb-1">
                {isBn ? "ফ্রড চেকার (কুরিয়ার API)" : "Fraud Checker (Courier APIs)"}
              </h4>
              <p className="text-[10px] text-muted-foreground font-body mb-3">
                {isBn
                  ? "Steadfast, Pathao, RedX এর আলাদা আলাদা API ক্রেডেনশিয়াল দিন। ফোন নাম্বার দিয়ে ডেলিভারি হিস্টোরি চেক করা হবে।"
                  : "Provide individual API credentials for Steadfast, Pathao, RedX to check delivery history by phone."}
              </p>

              {/* Steadfast */}
              <div className="mb-3 p-2 border border-border rounded bg-secondary/30">
                <h5 className="font-body text-[11px] font-bold text-foreground mb-2">Steadfast Courier</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="font-body text-[10px] text-muted-foreground block mb-1">API Key</label>
                    <Input type="password" value={settings.fc_steadfast_api_key || ""} onChange={(e) => set("fc_steadfast_api_key", e.target.value)} className={fieldClass} placeholder="Steadfast API Key" />
                  </div>
                  <div>
                    <label className="font-body text-[10px] text-muted-foreground block mb-1">Secret Key</label>
                    <Input type="password" value={settings.fc_steadfast_secret_key || ""} onChange={(e) => set("fc_steadfast_secret_key", e.target.value)} className={fieldClass} placeholder="Steadfast Secret Key" />
                  </div>
                </div>
              </div>

              {/* Pathao */}
              <div className="mb-3 p-2 border border-border rounded bg-secondary/30">
                <h5 className="font-body text-[11px] font-bold text-foreground mb-2">Pathao Courier</h5>
                <p className="text-[9px] text-muted-foreground mb-2">
                  {isBn ? "merchant.pathao.com এ লগইন করার ইমেইল ও পাসওয়ার্ড দিন" : "Enter your merchant.pathao.com login email & password"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="font-body text-[10px] text-muted-foreground block mb-1">{isBn ? "ইমেইল/ইউজারনেম" : "Email/Username"}</label>
                    <Input value={settings.fc_pathao_username || ""} onChange={(e) => set("fc_pathao_username", e.target.value)} className={fieldClass} placeholder="merchant@example.com" />
                  </div>
                  <div>
                    <label className="font-body text-[10px] text-muted-foreground block mb-1">{isBn ? "পাসওয়ার্ড" : "Password"}</label>
                    <Input type="password" value={settings.fc_pathao_password || ""} onChange={(e) => set("fc_pathao_password", e.target.value)} className={fieldClass} placeholder="••••••••" />
                  </div>
                </div>
              </div>

              {/* RedX */}
              <div className="mb-3 p-2 border border-border rounded bg-secondary/30">
                <h5 className="font-body text-[11px] font-bold text-foreground mb-2">RedX Courier</h5>
                <p className="text-[9px] text-muted-foreground mb-2">
                  {isBn ? "RedX মার্চেন্ট প্যানেল থেকে Access Token নিন" : "Get Access Token from RedX merchant panel"}
                </p>
                <div>
                  <label className="font-body text-[10px] text-muted-foreground block mb-1">Access Token</label>
                  <Input type="password" value={settings.fc_redx_access_token || ""} onChange={(e) => set("fc_redx_access_token", e.target.value)} className={fieldClass} placeholder="RedX Access Token" />
                </div>
              </div>

              {(settings.fc_steadfast_api_key || settings.fc_pathao_username || settings.fc_redx_access_token) && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] text-green-500 font-body">
                    ✓ {isBn ? "কনফিগার করা হয়েছে" : "Configured"}:
                    {settings.fc_steadfast_api_key ? " Steadfast" : ""}
                    {settings.fc_pathao_username ? " Pathao" : ""}
                    {settings.fc_redx_access_token ? " RedX" : ""}
                  </span>
                </div>
              )}
              <button
                onClick={() => saveGroup("fraud_checker_config", {
                  steadfast_api_key: settings.fc_steadfast_api_key,
                  steadfast_secret_key: settings.fc_steadfast_secret_key,
                  pathao_username: settings.fc_pathao_username,
                  pathao_password: settings.fc_pathao_password,
                  redx_access_token: settings.fc_redx_access_token,
                })}
                disabled={saving}
                className="mt-2 text-[10px] px-2 py-1 border border-border text-foreground hover:bg-secondary"
              >
                {isBn ? "সংরক্ষণ" : "Save"}
              </button>
            </div>
          </div>
        </TabsContent>

        {/* Notification Tab */}
        <TabsContent value="notification" className="mt-4">
          <div className="border border-border p-4 space-y-3">
            <h3 className="font-heading text-sm font-bold text-foreground">{isBn ? "নোটিফিকেশন সাউন্ড" : "Notification Sound"}</h3>
            <p className="text-xs text-muted-foreground font-body">{isBn ? "MP3/WAV, সর্বোচ্চ ১MB" : "MP3/WAV, max 1MB"}</p>
            {settings.notification_sound && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground font-body">✓ {isBn ? "আপলোড করা হয়েছে" : "Uploaded"}</span>
                <button onClick={playSound} className="text-xs px-2 py-1 border border-border text-foreground hover:bg-secondary">▶ {isBn ? "প্রিভিউ" : "Preview"}</button>
              </div>
            )}
            <input ref={soundRef} type="file" accept="audio/mp3,audio/wav,audio/mpeg" onChange={handleSoundUpload} className="hidden" />
            <button onClick={() => soundRef.current?.click()} className="text-xs px-3 py-1.5 border border-border text-foreground hover:bg-secondary">
              {isBn ? "আপলোড করুন" : "Upload Sound"}
            </button>
            <audio ref={audioRef} className="hidden" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HRSettings;
