import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}

const HRSettings = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const isBn = t("vencon") === "VENCON";

  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const soundRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["ui_config", "invoice_config", "api_config", "notification_config"]);

    const merged: Settings = {};
    (data || []).forEach((row) => {
      const val = row.value as Record<string, string>;
      Object.assign(merged, val);
    });
    setSettings(merged);
    setLoading(false);
  };

  const saveGroup = async (key: string, values: Record<string, string | undefined>) => {
    if (!user) return;
    setSaving(true);

    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("key", key)
      .single();

    if (existing) {
      await supabase
        .from("app_settings")
        .update({ value: values as any, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq("key", key);
    } else {
      await supabase
        .from("app_settings")
        .insert({ key, value: values as any, updated_by: user.id });
    }

    toast({ title: isBn ? "সংরক্ষিত ✓" : "Saved ✓" });
    setSaving(false);
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("app-assets").upload(path, file);
    if (error) {
      toast({ title: error.message, variant: "destructive" });
      return null;
    }
    const { data } = supabase.storage.from("app-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "logos");
    if (url) {
      setSettings({ ...settings, company_logo: url });
      saveGroup("ui_config", { ...settings, company_logo: url });
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "favicons");
    if (url) {
      setSettings({ ...settings, favicon: url });
      saveGroup("ui_config", { ...settings, favicon: url });
    }
  };

  const handleSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast({ title: isBn ? "ফাইল ১MB-এর বেশি" : "File exceeds 1MB", variant: "destructive" });
      return;
    }
    const url = await uploadFile(file, "sounds");
    if (url) {
      setSettings({ ...settings, notification_sound: url });
      saveGroup("notification_config", { notification_sound: url });
    }
  };

  const playSound = () => {
    if (settings.notification_sound && audioRef.current) {
      audioRef.current.src = settings.notification_sound;
      audioRef.current.play();
    }
  };

  const testConnection = async (service: string) => {
    // Simple validation test
    let valid = false;
    switch (service) {
      case "whatsapp":
        valid = !!(settings.whatsapp_sender && settings.whatsapp_api_key);
        break;
      case "steadfast":
        valid = !!(settings.steadfast_api_key && settings.steadfast_secret_key);
        break;
      case "ai":
        valid = !!(settings.ai_provider && settings.ai_api_key);
        break;
    }
    toast({
      title: valid
        ? isBn ? "কনফিগারেশন সংরক্ষিত ✓" : "Configuration saved ✓"
        : isBn ? "সব ফিল্ড পূরণ করুন" : "Fill all fields",
      variant: valid ? "default" : "destructive",
    });
  };

  const set = (key: keyof Settings, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">{isBn ? "লোড হচ্ছে..." : "Loading..."}</div>;
  }

  const fieldClass = "bg-background border-border text-foreground";

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <h2 className="font-heading text-2xl font-bold text-foreground">
        {isBn ? "সেটিংস" : "Settings"}
      </h2>

      {/* UI Customization */}
      <div className="border border-border p-4 space-y-4">
        <h3 className="font-heading text-sm font-bold text-foreground">
          {isBn ? "UI কাস্টমাইজেশন" : "UI Customization"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "কোম্পানি লোগো" : "Company Logo"} (PNG/JPG)
            </label>
            {settings.company_logo && (
              <img src={settings.company_logo} alt="Logo" className="h-12 mb-2 object-contain" />
            )}
            <input ref={logoRef} type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload} className="hidden" />
            <button
              onClick={() => logoRef.current?.click()}
              className="text-xs px-3 py-1.5 border border-border text-foreground hover:bg-secondary"
            >
              {isBn ? "আপলোড করুন" : "Upload"}
            </button>
          </div>

          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              Favicon
            </label>
            {settings.favicon && (
              <img src={settings.favicon} alt="Favicon" className="h-8 mb-2" />
            )}
            <input ref={faviconRef} type="file" accept="image/png,image/x-icon" onChange={handleFaviconUpload} className="hidden" />
            <button
              onClick={() => faviconRef.current?.click()}
              className="text-xs px-3 py-1.5 border border-border text-foreground hover:bg-secondary"
            >
              {isBn ? "আপলোড করুন" : "Upload"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "প্রাইমারি কালার" : "Primary Color"}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.primary_color || "#1D4ED8"}
                onChange={(e) => set("primary_color", e.target.value)}
                className="w-10 h-10 border border-border cursor-pointer"
              />
              <Input
                value={settings.primary_color || "#1D4ED8"}
                onChange={(e) => set("primary_color", e.target.value)}
                className={`${fieldClass} w-32`}
              />
            </div>
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "ফন্ট" : "Font"}
            </label>
            <Select value={settings.font || "atkinson"} onValueChange={(v) => set("font", v)}>
              <SelectTrigger className={`${fieldClass} w-full`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="atkinson">Atkinson Hyperlegible</SelectItem>
                <SelectItem value="arimo">Arimo</SelectItem>
                <SelectItem value="noto_sans_bengali">Noto Sans Bengali</SelectItem>
                <SelectItem value="inter">Inter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <button
          onClick={() => saveGroup("ui_config", {
            company_logo: settings.company_logo,
            favicon: settings.favicon,
            primary_color: settings.primary_color,
            font: settings.font,
          })}
          disabled={saving}
          className="px-4 py-1.5 text-xs font-bold text-white"
          style={{ backgroundColor: BLUE }}
        >
          {isBn ? "সংরক্ষণ" : "Save"}
        </button>
      </div>

      {/* Invoice Settings */}
      <div className="border border-border p-4 space-y-4">
        <h3 className="font-heading text-sm font-bold text-foreground">
          {isBn ? "ইনভয়েস সেটিংস" : "Invoice Settings"}
        </h3>

        <div>
          <label className="font-body text-xs text-muted-foreground block mb-2">
            {isBn ? "লেআউট" : "Layout"}
          </label>
          <div className="flex gap-3">
            {["4_per_a4", "6_per_a4", "9_per_a4"].map((layout) => (
              <label key={layout} className="flex items-center gap-1.5 text-xs font-body text-foreground cursor-pointer">
                <input
                  type="radio"
                  name="invoice_layout"
                  checked={settings.invoice_layout === layout}
                  onChange={() => set("invoice_layout", layout)}
                  className="accent-[#1D4ED8]"
                />
                {layout.replace("_per_a4", " per A4")}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="font-body text-xs text-muted-foreground block mb-1">
            {isBn ? "ভাষা" : "Language"}
          </label>
          <div className="bg-secondary p-2 text-xs text-foreground font-body">
            বাংলা (Bengali) — {isBn ? "স্থায়ী" : "Fixed"}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "কোম্পানি ঠিকানা" : "Company Address"}
            </label>
            <Textarea
              value={settings.company_address || ""}
              onChange={(e) => set("company_address", e.target.value)}
              className={`${fieldClass} min-h-[60px]`}
            />
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "কোম্পানি ফোন" : "Company Phone"}
            </label>
            <Input
              value={settings.company_phone || ""}
              onChange={(e) => set("company_phone", e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <button
          onClick={() => saveGroup("invoice_config", {
            invoice_layout: settings.invoice_layout,
            invoice_language: "bn",
            company_address: settings.company_address,
            company_phone: settings.company_phone,
          })}
          disabled={saving}
          className="px-4 py-1.5 text-xs font-bold text-white"
          style={{ backgroundColor: BLUE }}
        >
          {isBn ? "সংরক্ষণ" : "Save"}
        </button>
      </div>

      {/* API Configuration */}
      <div className="border border-border p-4 space-y-4">
        <h3 className="font-heading text-sm font-bold text-foreground">
          {isBn ? "API কনফিগারেশন" : "API Configuration"}
        </h3>

        {/* WhatsApp */}
        <div className="border-b border-border pb-4">
          <h4 className="font-body text-xs font-bold text-foreground mb-2">WhatsApp Business API</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-body text-[10px] text-muted-foreground block mb-1">Sender Number</label>
              <Input
                value={settings.whatsapp_sender || ""}
                onChange={(e) => set("whatsapp_sender", e.target.value)}
                className={fieldClass}
                placeholder="+880..."
              />
            </div>
            <div>
              <label className="font-body text-[10px] text-muted-foreground block mb-1">API Key</label>
              <Input
                type="password"
                value={settings.whatsapp_api_key || ""}
                onChange={(e) => set("whatsapp_api_key", e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
          <button
            onClick={() => {
              saveGroup("api_config", {
                whatsapp_sender: settings.whatsapp_sender,
                whatsapp_api_key: settings.whatsapp_api_key,
                steadfast_api_key: settings.steadfast_api_key,
                steadfast_secret_key: settings.steadfast_secret_key,
                ai_provider: settings.ai_provider,
                ai_api_key: settings.ai_api_key,
              });
              testConnection("whatsapp");
            }}
            className="mt-2 text-[10px] px-2 py-1 border border-border text-foreground hover:bg-secondary"
          >
            {isBn ? "সংরক্ষণ ও পরীক্ষা" : "Save & Test"}
          </button>
        </div>

        {/* SteadFast */}
        <div className="border-b border-border pb-4">
          <h4 className="font-body text-xs font-bold text-foreground mb-2">SteadFast Courier API</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-body text-[10px] text-muted-foreground block mb-1">API Key</label>
              <Input
                type="password"
                value={settings.steadfast_api_key || ""}
                onChange={(e) => set("steadfast_api_key", e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="font-body text-[10px] text-muted-foreground block mb-1">Secret Key</label>
              <Input
                type="password"
                value={settings.steadfast_secret_key || ""}
                onChange={(e) => set("steadfast_secret_key", e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
          <button
            onClick={() => {
              saveGroup("api_config", {
                whatsapp_sender: settings.whatsapp_sender,
                whatsapp_api_key: settings.whatsapp_api_key,
                steadfast_api_key: settings.steadfast_api_key,
                steadfast_secret_key: settings.steadfast_secret_key,
                ai_provider: settings.ai_provider,
                ai_api_key: settings.ai_api_key,
              });
              testConnection("steadfast");
            }}
            className="mt-2 text-[10px] px-2 py-1 border border-border text-foreground hover:bg-secondary"
          >
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
                <SelectTrigger className={`${fieldClass} w-full`}>
                  <SelectValue placeholder={isBn ? "নির্বাচন করুন" : "Select"} />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="openai">OpenAI GPT-4</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                  <SelectItem value="google">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-body text-[10px] text-muted-foreground block mb-1">API Key</label>
              <Input
                type="password"
                value={settings.ai_api_key || ""}
                onChange={(e) => set("ai_api_key", e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
          <button
            onClick={() => {
              saveGroup("api_config", {
                whatsapp_sender: settings.whatsapp_sender,
                whatsapp_api_key: settings.whatsapp_api_key,
                steadfast_api_key: settings.steadfast_api_key,
                steadfast_secret_key: settings.steadfast_secret_key,
                ai_provider: settings.ai_provider,
                ai_api_key: settings.ai_api_key,
              });
              testConnection("ai");
            }}
            className="mt-2 text-[10px] px-2 py-1 border border-border text-foreground hover:bg-secondary"
          >
            {isBn ? "সংরক্ষণ ও পরীক্ষা" : "Save & Test"}
          </button>
        </div>
      </div>

      {/* Notification Sound */}
      <div className="border border-border p-4 space-y-3">
        <h3 className="font-heading text-sm font-bold text-foreground">
          {isBn ? "নোটিফিকেশন সাউন্ড" : "Notification Sound"}
        </h3>
        <p className="text-xs text-muted-foreground font-body">
          {isBn ? "MP3/WAV, সর্বোচ্চ ১MB" : "MP3/WAV, max 1MB"}
        </p>
        {settings.notification_sound && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground font-body">✓ {isBn ? "আপলোড করা হয়েছে" : "Uploaded"}</span>
            <button
              onClick={playSound}
              className="text-xs px-2 py-1 border border-border text-foreground hover:bg-secondary"
            >
              ▶ {isBn ? "প্রিভিউ" : "Preview"}
            </button>
          </div>
        )}
        <input ref={soundRef} type="file" accept="audio/mp3,audio/wav,audio/mpeg" onChange={handleSoundUpload} className="hidden" />
        <button
          onClick={() => soundRef.current?.click()}
          className="text-xs px-3 py-1.5 border border-border text-foreground hover:bg-secondary"
        >
          {isBn ? "আপলোড করুন" : "Upload Sound"}
        </button>
        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  );
};

export default HRSettings;
