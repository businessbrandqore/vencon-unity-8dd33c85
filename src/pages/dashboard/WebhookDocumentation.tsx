import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookOpen, Globe, Shield, CheckCircle2, ArrowRight, Copy, Code, AlertTriangle, Eye, EyeOff, Send, Loader2, CheckCircle, XCircle, ShoppingCart, Webhook, FileCode, Server, Zap, Sparkles, ScanSearch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WebhookDocumentation = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const isBn = t("vencon") === "VENCON";
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("");
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [analyzingWebsiteId, setAnalyzingWebsiteId] = useState<string | null>(null);
  const [analyzedResults, setAnalyzedResults] = useState<Record<string, { code: string; fields: string[]; formFound: boolean }>>({});

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const buildTestPayload = (siteName?: string) => ({
    customer_name: `[TEST] ${siteName ? `${siteName} ` : ""}টেস্ট কাস্টমার`,
    phone: `017${Math.floor(10000000 + Math.random() * 90000000)}`,
    address: "টেস্ট ঠিকানা, ঢাকা",
    extra_fields: {
      email: "test@example.com",
      order_id: `TEST-${Date.now()}`,
      product: "টেস্ট প্রোডাক্ট",
      quantity: 1,
      total: "980.00",
      currency: "BDT",
      payment: "Cash on Delivery",
      website: siteName || "Documentation Test",
    },
  });

  const normalizeAiPhpCode = (code: string) => {
    const cleaned = code
      .replace(/^```php\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const phpStart = cleaned.indexOf("<?php");
    if (phpStart >= 0) return cleaned.slice(phpStart).trim();

    const addActionStart = cleaned.indexOf("add_action(");
    if (addActionStart >= 0) return cleaned.slice(addActionStart).trim();

    const functionStart = cleaned.indexOf("function ");
    if (functionStart >= 0) return cleaned.slice(functionStart).trim();

    return cleaned;
  };

  const escapePhpString = (value: string) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  const buildPhpSnippet = ({
    webhookUrl,
    secret,
    siteName,
    dataMode,
  }: {
    webhookUrl: string;
    secret: string;
    siteName?: string;
    dataMode: string;
  }) => {
    const functionName = `send_order_to_crm_${dataMode}`;
    const safeWebhookUrl = escapePhpString(webhookUrl);
    const safeSecret = escapePhpString(secret);
    const safeSiteName = escapePhpString(siteName || "Website");
    const safeDataMode = escapePhpString(dataMode);

    return `// functions.php বা Code Snippets plugin এ যোগ করুন
// ✅ WooCommerce, CartFlows, FunnelKit সহ checkout submit হলেই দ্রুত webhook যাবে
add_action('woocommerce_checkout_order_processed', '${functionName}', 10, 1);
add_action('woocommerce_thankyou', '${functionName}', 10, 1);

function ${functionName}($order_id) {
    if (!$order_id) return;

    $order = wc_get_order($order_id);
    if (!$order) return;
    if ($order->get_meta('_crm_webhook_sent')) return;

    $customer_name = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
    if (empty($customer_name)) $customer_name = $order->get_formatted_billing_full_name();
    if (empty($customer_name)) $customer_name = $order->get_billing_company();

    $phone = $order->get_billing_phone();
    if (empty($phone)) {
        $phone = $order->get_meta('_billing_phone') ?: $order->get_meta('billing_phone') ?: $order->get_meta('phone') ?: '';
    }

    $address = implode(', ', array_filter([
        $order->get_billing_address_1(),
        $order->get_billing_address_2(),
        $order->get_billing_city(),
        $order->get_billing_state(),
        $order->get_billing_postcode(),
    ]));

    $products = [];
    $qty = 0;
    foreach ($order->get_items() as $item) {
        $products[] = $item->get_name();
        $qty += (int) $item->get_quantity();
    }

    $custom_fields = [];
    foreach ($order->get_meta_data() as $meta) {
        if (strpos($meta->key, '_') === 0) continue;
        $custom_fields[$meta->key] = $meta->value;
    }

    $body = [
        'customer_name' => $customer_name,
        'phone' => $phone,
        'address' => $address,
        'extra_fields' => array_merge([
            'email' => $order->get_billing_email(),
            'order_id' => $order->get_id(),
            'product' => implode(', ', $products),
            'quantity' => $qty,
            'total' => $order->get_total(),
            'currency' => $order->get_currency(),
            'payment' => $order->get_payment_method_title(),
            'website' => '${safeSiteName}',
            'data_mode' => '${safeDataMode}',
        ], $custom_fields),
    ];

    $response = wp_remote_post('${safeWebhookUrl}', [
        'method' => 'POST',
        'timeout' => 20,
        'headers' => [
            'Content-Type' => 'application/json',
            'x-webhook-secret' => '${safeSecret}',
        ],
        'body' => wp_json_encode($body),
    ]);

    if (is_wp_error($response)) {
        error_log('CRM Webhook Error [${safeSiteName}]: ' . $response->get_error_message());
        return;
    }

    $status_code = wp_remote_retrieve_response_code($response);
    if ($status_code >= 200 && $status_code < 300) {
        $order->update_meta_data('_crm_webhook_sent', 'yes');
        $order->save();
        return;
    }

    error_log('CRM Webhook Error [${safeSiteName}] status ' . $status_code . ': ' . wp_remote_retrieve_body($response));
}`;
  };

  const handleAnalyzeCheckout = async (ws: { id: string; site_url: string; site_name: string; data_mode: string; webhook_secret: string }) => {
    setAnalyzingWebsiteId(ws.id);
    try {
      const res = await supabase.functions.invoke("analyze-checkout", {
        body: {
          site_url: ws.site_url,
          site_name: ws.site_name,
          data_mode: ws.data_mode,
          webhook_secret: ws.webhook_secret,
          webhook_url: `${supabaseUrl}/functions/v1/import-leads/${selectedCampaignId}`,
        },
      });
      if (res.error) throw res.error;
      const data = res.data;
      if (data?.success && data?.generated_code) {
        setAnalyzedResults((prev) => ({
          ...prev,
          [ws.id]: {
            code: normalizeAiPhpCode(data.generated_code),
            fields: data.detected_fields || [],
            formFound: data.form_found,
          },
        }));
        toast({ title: isBn ? "✅ ফর্ম এনালাইসিস সম্পন্ন!" : "✅ Form analysis complete!" });
      } else {
        toast({ title: isBn ? "এনালাইসিস ব্যর্থ" : "Analysis failed", description: data?.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: isBn ? "ত্রুটি হয়েছে" : "Error occurred", description: String(err), variant: "destructive" });
    } finally {
      setAnalyzingWebsiteId(null);
    }
  };

  const { data: campaigns } = useQuery({
    queryKey: ["doc-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status, webhook_secret")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Also fetch campaign websites for selected campaign
  const { data: campaignWebsites } = useQuery({
    queryKey: ["doc-campaign-websites", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data, error } = await supabase
        .from("campaign_websites")
        .select("*")
        .eq("campaign_id", selectedCampaignId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCampaignId,
  });

  const selectedCampaign = campaigns?.find((c) => c.id === selectedCampaignId);
  const selectedWebsite = campaignWebsites?.find((w) => w.id === selectedWebsiteId);
  const webhookUrl = selectedCampaignId
    ? `${supabaseUrl}/functions/v1/import-leads/${selectedCampaignId}`
    : "";
  const selectedWebsiteWebhookUrl = selectedCampaignId && selectedWebsiteId
    ? `${supabaseUrl}/functions/v1/import-leads/${selectedCampaignId}/${selectedWebsiteId}`
    : webhookUrl;

  // Use website-specific secret if selected, otherwise campaign secret
  const activeSecret = selectedWebsite?.webhook_secret || selectedCampaign?.webhook_secret || "";
  const maskedSecret = activeSecret
    ? "•".repeat(Math.max(0, activeSecret.length - 8)) + activeSecret.slice(-8)
    : "";

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: isBn ? "কপি হয়েছে!" : "Copied!" });
  };

  const handleTestConnection = async () => {
    if (!activeSecret) return;
    setTesting(true);
    setTestResult(null);
    try {
        const res = await fetch(selectedWebsiteWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": activeSecret,
          "X-Test-Connection": "true",
        },
        body: JSON.stringify(buildTestPayload(selectedWebsite?.site_name)),
      });
      const data = await res.json();
      if (res.ok && data.imported > 0) {
        setTestResult({ success: true, message: isBn ? "✓ Connection সফল! Test data save হবে না।" : "✓ Connection successful! Test data was not saved." });
      } else if (res.ok && data.skipped_duplicates > 0) {
        setTestResult({ success: true, message: isBn ? "✓ Connection সফল! (Duplicate skipped)" : "✓ Connected! (Duplicate skipped)" });
      } else {
        setTestResult({ success: false, message: data.error || (isBn ? "ডাটা save হয়নি" : "Data was not saved") });
      }
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const generatePhpSnippet = (url: string, secret: string, websiteName?: string) =>
    buildPhpSnippet({
      webhookUrl: url,
      secret,
      siteName: websiteName || selectedCampaign?.name,
      dataMode: "lead",
    });

  const generatePerWebsitePhpSnippet = (websiteSecret: string, websiteUrl: string, siteName: string, dataMode: string) => {
    const perSiteUrl = `${supabaseUrl}/functions/v1/import-leads/${selectedCampaignId}`;
    return buildPhpSnippet({
      webhookUrl: perSiteUrl,
      secret: websiteSecret,
      siteName,
      dataMode,
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {isBn ? "WooCommerce → CRM ইন্টিগ্রেশন গাইড" : "WooCommerce → CRM Integration Guide"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isBn ? "WooCommerce চেক-আউট ফর্ম থেকে অটোমেটিক ডাটা সংগ্রহের সম্পূর্ণ গাইড" : "Complete guide to auto-collect data from WooCommerce checkout"}
            </p>
          </div>
        </div>
      </div>

      {/* Overview — What This Does */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            {isBn ? "সংক্ষেপে কি হবে?" : "What Does This Do?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isBn
              ? "আপনার WordPress/WooCommerce সাইটে কেউ চেক-আউট ফর্ম পূরণ করে অর্ডার করলে, সেই অর্ডারের সব তথ্য অটোমেটিক আমাদের CRM সিস্টেমে চলে আসবে। ফর্ম যেভাবেই বানানো হোক — স্ট্যান্ডার্ড WooCommerce, CartFlows, FunnelKit, বা কাস্টম — সব কাজ করবে।"
              : "When someone places an order via your WooCommerce checkout, all order data is automatically sent to our CRM. Works with ANY checkout: standard WooCommerce, CartFlows, FunnelKit, or custom forms."}
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {["WooCommerce", "CartFlows", "FunnelKit", "Custom Checkout"].map((name) => (
              <Badge key={name} variant="outline" className="text-xs border-primary/30 text-primary">
                ✅ {name}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-body">
            {[
              isBn ? "🛒 কাস্টমার চেক-আউট করে" : "🛒 Customer checks out",
              isBn ? "📤 WordPress ডাটা পাঠায়" : "📤 WordPress sends data",
              isBn ? "🔐 Secret Key যাচাই" : "🔐 Secret Key verified",
              isBn ? "💾 CRM-এ Lead/Processing সেভ" : "💾 Saved as Lead/Processing",
              isBn ? "📊 TL ড্যাশবোর্ডে দেখায়" : "📊 Appears on TL Dashboard",
            ].map((step, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium">{step}</span>
                {i < 4 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Selector + Credentials */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {isBn ? "ধাপ ১: ক্যাম্পেইন সিলেক্ট ও ক্রেডেনশিয়াল কপি করুন" : "Step 1: Select Campaign & Copy Credentials"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Campaign selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              {isBn ? "ক্যাম্পেইন সিলেক্ট করুন" : "Select Campaign"}
            </label>
            <Select value={selectedCampaignId} onValueChange={(v) => { setSelectedCampaignId(v); setSelectedWebsiteId(""); setShowSecret(false); setTestResult(null); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={isBn ? "— ক্যাম্পেইন বেছে নিন —" : "— Choose a campaign —"} />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      {c.name}
                      <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px] ml-1">
                        {c.status}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show both websites' credentials when campaign is selected */}
          {selectedCampaign && campaignWebsites && campaignWebsites.length > 0 ? (
            <div className="space-y-4 pt-2">
              {/* Webhook URL (same for both) */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Webhook URL ({isBn ? "দুটি সাইটের জন্য একই" : "Same for both sites"})</label>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted border border-border">
                  <code className="text-xs text-foreground flex-1 break-all font-mono">{webhookUrl}</code>
                  <button onClick={() => copyText(webhookUrl)} className="text-muted-foreground hover:text-primary shrink-0">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Each website card with its own secret */}
              <div className="grid gap-3 md:grid-cols-2">
                {campaignWebsites.map((ws) => {
                  const wsMasked = ws.webhook_secret
                    ? "•".repeat(Math.max(0, ws.webhook_secret.length - 8)) + ws.webhook_secret.slice(-8)
                    : "";
                  const isLead = ws.data_mode === "lead";
                  return (
                    <div key={ws.id} className={`p-4 rounded-xl border-2 space-y-3 ${isLead ? "border-primary/40 bg-primary/5" : "border-purple-500/40 bg-purple-500/5"}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Globe className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">{ws.site_name}</span>
                        <Badge variant={isLead ? "default" : "secondary"} className="text-[10px]">
                          {isLead ? "Lead" : "Processing"}
                        </Badge>
                        {ws.is_active ? (
                          <Badge className="bg-green-500/10 text-green-600 border-0 text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isBn 
                          ? `এই সাইট থেকে ডাটা "${isLead ? 'Lead' : 'Processing'}" হিসেবে CRM-এ আসবে।`
                          : `Data from this site arrives as "${isLead ? 'Lead' : 'Processing'}" in CRM.`}
                      </p>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Secret Key — {ws.site_name}
                        </label>
                        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted border border-border">
                          <code className="text-[11px] text-foreground flex-1 break-all font-mono">
                            {selectedWebsiteId === ws.id && showSecret ? ws.webhook_secret : wsMasked}
                          </code>
                          <button onClick={() => { setSelectedWebsiteId(ws.id); setShowSecret(selectedWebsiteId === ws.id ? !showSecret : true); }} className="text-muted-foreground hover:text-primary shrink-0">
                            {selectedWebsiteId === ws.id && showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => copyText(ws.webhook_secret)} className="text-muted-foreground hover:text-primary shrink-0">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* Per-website test */}
                      <Button size="sm" variant="outline" className="w-full text-xs" onClick={async () => {
                        setSelectedWebsiteId(ws.id);
                        setTesting(true);
                        setTestResult(null);
                        try {
                          const res = await fetch(`${supabaseUrl}/functions/v1/import-leads/${selectedCampaignId}/${ws.id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "X-Webhook-Secret": ws.webhook_secret, "X-Test-Connection": "true" },
                            body: JSON.stringify(buildTestPayload(ws.site_name)),
                          });
                          const data = await res.json();
                          if (res.ok && (data.imported > 0 || data.skipped_duplicates > 0)) {
                            setTestResult({ success: true, message: isBn ? `✓ ${ws.site_name} — OK! Test data save হবে না।` : `✓ ${ws.site_name} — OK! Test data was not saved.` });
                          } else {
                            setTestResult({ success: false, message: data.error || (isBn ? "ডাটা save হয়নি" : "Data was not saved") });
                          }
                        } catch (err) { setTestResult({ success: false, message: String(err) }); }
                        finally { setTesting(false); }
                      }} disabled={testing || selectedCampaign.status !== "active"}>
                        {testing && selectedWebsiteId === ws.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                        {isBn ? `টেস্ট — ${ws.site_name}` : `Test — ${ws.site_name}`}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`flex items-center gap-1.5 text-xs p-2 rounded-lg ${testResult.success ? "text-green-600 bg-green-500/10" : "text-destructive bg-destructive/10"}`}>
                  {testResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {testResult.message}
                </div>
              )}

              {selectedCampaign.status !== "active" && (
                <span className="text-xs text-destructive">{isBn ? "⚠️ ক্যাম্পেইন Active নয় — টেস্ট করতে Active করুন" : "⚠️ Campaign not active"}</span>
              )}
            </div>
          ) : selectedCampaign ? (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                {isBn ? "⚠️ এই ক্যাম্পেইনে কোনো ওয়েবসাইট যোগ করা হয়নি।" : "⚠️ No websites added to this campaign yet."}
              </p>
              <p className="text-xs text-muted-foreground">
                {isBn 
                  ? "প্রতিটি ক্যাম্পেইনে দুটি ওয়েবসাইট (একটি Lead, একটি Processing) যোগ করতে হবে। Campaign সেটিংসে গিয়ে ওয়েবসাইট যোগ করুন।" 
                  : "Add two websites (one Lead, one Processing) in Campaign settings."}
              </p>
              <p className="text-xs text-muted-foreground">
                {isBn ? "📍 যান: সাইডবার → ক্যাম্পেইন → এই ক্যাম্পেইন এডিট করুন → ওয়েবসাইট ট্যাব" : "📍 Go to: Sidebar → Campaigns → Edit → Websites tab"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isBn ? "👆 উপরে থেকে একটি ক্যাম্পেইন সিলেক্ট করুন" : "👆 Select a campaign above"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Prerequisites */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {isBn ? "ধাপ ২: WordPress সাইটে কি কি লাগবে?" : "Step 2: WordPress Prerequisites"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                icon: "🌐",
                title: isBn ? "WordPress সাইট (SSL/HTTPS চালু)" : "WordPress site (SSL/HTTPS enabled)",
                desc: isBn ? "আপনার সাইটে https:// থাকতে হবে" : "Your site must use https://",
              },
              {
                icon: "🛒",
                title: isBn ? "WooCommerce প্লাগইন ইনস্টল ও অ্যাক্টিভ" : "WooCommerce plugin installed & active",
                desc: isBn ? "চেক-আউট ফর্ম WooCommerce থেকে আসবে" : "Checkout forms come from WooCommerce",
              },
              {
                icon: "📝",
                title: isBn ? "Theme এর functions.php ফাইল এক্সেস অথবা Custom Plugin" : "Access to theme's functions.php or a Custom Plugin",
                desc: isBn ? "এখানে PHP কোড যোগ করতে হবে" : "PHP code will be added here",
              },
              {
                icon: "🔑",
                title: isBn ? "এই পেজ থেকে Webhook URL ও Secret Key কপি করা" : "Webhook URL & Secret Key copied from this page",
                desc: isBn ? "উপরে ক্যাম্পেইন সিলেক্ট করুন" : "Select campaign above",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Setup — PHP Code */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            {isBn ? "ধাপ ৩: WordPress এ PHP কোড যোগ করুন" : "Step 3: Add PHP Code to WordPress"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Where to add */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              {isBn ? "📂 কোড কোথায় যোগ করবেন?" : "📂 Where to add the code?"}
            </p>
            <div className="space-y-2 text-xs text-blue-700 dark:text-blue-400">
              <p>{isBn ? "নিচের যেকোনো একটি জায়গায়:" : "Any ONE of these locations:"}</p>
              <div className="space-y-1.5 ml-2">
                <p><strong>{isBn ? "অপশন ১ (সহজ):" : "Option 1 (Easy):"}</strong> {isBn 
                  ? "WordPress Dashboard → Appearance → Theme File Editor → functions.php ফাইল খুলুন → নিচে কোড পেস্ট করুন" 
                  : "WordPress Dashboard → Appearance → Theme File Editor → Open functions.php → Paste code at bottom"}</p>
                <p><strong>{isBn ? "অপশন ২ (ভালো):" : "Option 2 (Better):"}</strong> {isBn 
                  ? "\"Code Snippets\" প্লাগইন ইনস্টল করুন → নতুন Snippet তৈরি করুন → কোড পেস্ট করুন → \"Run on: Frontend\" সিলেক্ট করুন" 
                  : "Install 'Code Snippets' plugin → Create new snippet → Paste code → Select 'Run on: Frontend'"}</p>
                <p><strong>{isBn ? "অপশন ৩ (সবচেয়ে ভালো):" : "Option 3 (Best):"}</strong> {isBn 
                  ? "Child Theme এর functions.php তে যোগ করুন (থিম আপডেটে কোড হারাবে না)" 
                  : "Add to Child Theme's functions.php (won't be lost on theme updates)"}</p>
              </div>
            </div>
          </div>

          {/* Show code for ALL websites in the campaign */}
          {selectedCampaign && campaignWebsites && campaignWebsites.length > 0 ? (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                {isBn 
                  ? "📋 প্রতিটি ওয়েবসাইটের জন্য আলাদা PHP কোড। AI দিয়ে ফর্ম এনালাইজ করে কাস্টমাইজড কোড পেতে পারেন।"
                  : "📋 Separate PHP code per website. Use AI to analyze the checkout form for customized code."}
              </p>
              {campaignWebsites.map((ws) => {
                const isLead = ws.data_mode === "lead";
                const snippet = generatePerWebsitePhpSnippet(ws.webhook_secret, ws.site_url, ws.site_name, ws.data_mode);
                const analyzed = analyzedResults[ws.id];
                const isAnalyzing = analyzingWebsiteId === ws.id;
                return (
                  <div key={ws.id} className={`rounded-xl border-2 overflow-hidden ${isLead ? "border-primary/30" : "border-purple-500/30"}`}>
                    <div className={`px-4 py-2 flex items-center gap-2 flex-wrap ${isLead ? "bg-primary/10" : "bg-purple-500/10"}`}>
                      <Globe className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-foreground">{ws.site_name}</span>
                      <Badge variant={isLead ? "default" : "secondary"} className="text-[10px]">
                        {isLead ? "Lead" : "Processing"}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">{ws.site_url}</span>
                    </div>

                    {/* AI Analyze Button */}
                    <div className="px-4 py-2 border-b border-border bg-background flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={analyzed ? "outline" : "default"}
                        className="text-xs gap-1.5"
                        disabled={isAnalyzing}
                        onClick={() => handleAnalyzeCheckout(ws)}
                      >
                        {isAnalyzing ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" />{isBn ? "ফর্ম এনালাইজ হচ্ছে..." : "Analyzing..."}</>
                        ) : analyzed ? (
                          <><ScanSearch className="h-3.5 w-3.5" />{isBn ? "🔄 পুনরায় এনালাইজ করুন" : "🔄 Re-analyze"}</>
                        ) : (
                          <><Sparkles className="h-3.5 w-3.5" />{isBn ? "🤖 AI দিয়ে ফর্ম এনালাইজ করুন" : "🤖 AI Analyze Form"}</>
                        )}
                      </Button>
                      {analyzed && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Badge className="bg-green-500/10 text-green-600 border-0 text-[10px]">
                            {analyzed.formFound 
                              ? (isBn ? "✅ ফর্ম পাওয়া গেছে" : "✅ Form found") 
                              : (isBn ? "⚡ ইউনিভার্সাল কোড" : "⚡ Universal code")}
                          </Badge>
                          {analyzed.fields.length > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {analyzed.fields.length} {isBn ? "টি ফিল্ড" : " fields"}
                            </Badge>
                          )}
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground w-full">
                        {isBn 
                          ? "AI আপনার সাইটের চেক-আউট পেজ ভিজিট করে ফর্ম ফিল্ড খুঁজে বের করবে এবং সেই অনুসারে PHP কোড বানাবে"
                          : "AI will visit your checkout page, detect form fields, and generate tailored PHP code"}
                      </p>
                    </div>

                    {/* Show AI-generated code if available, otherwise default */}
                    {analyzed ? (
                      <div className="space-y-0">
                        {/* Detected fields */}
                        {analyzed.fields.length > 0 && (
                          <div className="px-4 py-2 border-b border-border bg-muted/50">
                            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                              {isBn ? "🔍 ডিটেক্টেড ফিল্ড:" : "🔍 Detected fields:"}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {analyzed.fields.map((f) => (
                                <Badge key={f} variant="outline" className="text-[9px] font-mono">{f}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* AI-generated PHP code */}
                        <div className="relative p-3 overflow-x-auto">
                          <div className="absolute top-2 right-2 flex gap-1 z-10">
                            <Badge className="bg-primary/10 text-primary border-0 text-[9px]">
                              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI Generated
                            </Badge>
                            <button onClick={() => copyText(analyzed.code)} className="text-muted-foreground hover:text-primary">
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                          <pre className="text-[11px] text-foreground whitespace-pre font-mono leading-relaxed">
                            {analyzed.code}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="relative p-3 overflow-x-auto">
                        <div className="absolute top-2 right-2 flex gap-1 z-10">
                          <Badge variant="outline" className="text-[9px]">
                            {isBn ? "ডিফল্ট" : "Default"}
                          </Badge>
                          <button onClick={() => copyText(snippet)} className="text-muted-foreground hover:text-primary">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        <pre className="text-[11px] text-foreground whitespace-pre font-mono leading-relaxed">
                          {snippet}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : selectedCampaign ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground font-medium">
                {isBn ? "📋 নিচের PHP কোডটি কপি করুন:" : "📋 Copy the PHP code below:"}
              </p>
              <div className="relative p-3 rounded-lg bg-muted border border-border overflow-x-auto">
                <button
                  onClick={() => copyText(generatePhpSnippet(webhookUrl, selectedCampaign.webhook_secret || "YOUR_SECRET_KEY"))}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-primary"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <pre className="text-[11px] text-foreground whitespace-pre font-mono leading-relaxed">
                  {generatePhpSnippet(webhookUrl, selectedCampaign.webhook_secret || "YOUR_SECRET_KEY")}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isBn ? "👆 প্রথমে উপর থেকে একটি ক্যাম্পেইন সিলেক্ট করুন" : "👆 Select a campaign above first"}
            </p>
          )}

          {/* Important notes */}
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {isBn ? "গুরুত্বপূর্ণ নোট:" : "Important Notes:"}
            </p>
            <ul className="text-xs text-amber-700 dark:text-amber-500 space-y-1 ml-5 list-disc">
              <li>{isBn ? "কোড যোগ করার পর WordPress সাইটে একটি টেস্ট অর্ডার দিন" : "After adding code, place a test order on your WordPress site"}</li>
              <li>{isBn ? "যদি দুটি ওয়েবসাইট থাকে (Lead + Processing), প্রতিটিতে আলাদা কোড ব্যবহার করুন" : "If you have two websites (Lead + Processing), use separate code for each"}</li>
              <li>{isBn ? "functions.php এ যোগ করলে থিম আপডেটে কোড মুছে যেতে পারে — Child Theme ব্যবহার করুন" : "Code in functions.php may be lost on theme update — use Child Theme"}</li>
              <li>{isBn ? "\"Code Snippets\" প্লাগইন ব্যবহার করলে থিম আপডেটে কোড মুছবে না" : "Using 'Code Snippets' plugin prevents code loss on updates"}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Customization Guide — When & How to Change */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            {isBn ? "🔧 কোড কি চেঞ্জ করতে হবে?" : "🔧 Do You Need to Change the Code?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* No change needed */}
          <div className="p-4 rounded-xl border-2 border-green-500/30 bg-green-500/5 space-y-3">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {isBn ? "বেশিরভাগ ক্ষেত্রে কোনো চেঞ্জ লাগবে না ✅" : "No changes needed in most cases ✅"}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isBn
                ? "জেনারেট করা PHP কোড ডাইনামিক — এটি অটোমেটিকভাবে WooCommerce অর্ডার অবজেক্ট থেকে সব Billing ফিল্ড, প্রোডাক্ট তথ্য, এবং কাস্টম মেটা ফিল্ড ক্যাপচার করে। CartFlows, FunnelKit, Checkout Field Editor, বা কাস্টম ফর্ম — যেটাই ব্যবহার করুন, কোড একই থাকবে কারণ সব প্লাগিন শেষ পর্যন্ত WooCommerce Order তৈরি করে।"
                : "The generated PHP code is dynamic — it automatically captures all billing fields, product info, and custom meta fields from the WooCommerce order object. Whether you use CartFlows, FunnelKit, Checkout Field Editor, or custom forms — the code stays the same."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { form: isBn ? "স্ট্যান্ডার্ড WooCommerce" : "Standard WooCommerce", change: isBn ? "কোনো চেঞ্জ নেই" : "No change" },
                { form: "CartFlows", change: isBn ? "কোনো চেঞ্জ নেই" : "No change" },
                { form: "FunnelKit", change: isBn ? "কোনো চেঞ্জ নেই" : "No change" },
                { form: "Checkout Field Editor", change: isBn ? "কোনো চেঞ্জ নেই" : "No change" },
              ].map((item) => (
                <div key={item.form} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                  <span className="text-foreground font-medium">{item.form}</span>
                  <Badge className="bg-green-500/10 text-green-600 border-0 text-[10px]">✅ {item.change}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* When changes needed */}
          <div className="p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 space-y-3">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {isBn ? "যখন চেঞ্জ করতে হবে (বিরল ক্ষেত্রে)" : "When Changes Are Needed (Rare Cases)"}
            </p>
            <div className="space-y-3">
              {/* Case 1: Custom phone field */}
              <div className="p-3 rounded-lg bg-background border border-border space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  {isBn ? "🔹 কেস ১: ফোন নম্বর কাস্টম ফিল্ডে আছে" : "🔹 Case 1: Phone is in a custom field"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isBn
                    ? "যদি আপনার চেক-আউট ফর্মে ফোন নম্বর 'billing_phone' ছাড়া অন্য ফিল্ড নামে থাকে (যেমন: 'custom_phone', 'mobile_number'):"
                    : "If your checkout uses a different field name for phone (e.g., 'custom_phone', 'mobile_number'):"}
                </p>
                <div className="p-2 rounded bg-muted border border-border">
                  <pre className="text-[11px] text-foreground font-mono whitespace-pre-wrap">{isBn
                    ? `// নিচের লাইনটি খুঁজুন:
$phone = $billing_data['phone'] ?? '';

// এভাবে পরিবর্তন করুন:
$phone = $billing_data['phone'] ?? '';
if (empty($phone)) {
    $phone = $order->get_meta('custom_phone')
          ?: $order->get_meta('mobile_number')
          ?: '';
}`
                    : `// Find this line:
$phone = $billing_data['phone'] ?? '';

// Change to:
$phone = $billing_data['phone'] ?? '';
if (empty($phone)) {
    $phone = $order->get_meta('custom_phone')
          ?: $order->get_meta('mobile_number')
          ?: '';
}`}</pre>
                </div>
              </div>

              {/* Case 2: Custom name field */}
              <div className="p-3 rounded-lg bg-background border border-border space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  {isBn ? "🔹 কেস ২: নাম একটি ফিল্ডে আছে (first/last আলাদা নেই)" : "🔹 Case 2: Name is a single field (no first/last)"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isBn
                    ? "যদি ফর্মে 'আপনার নাম লিখুন' শুধু একটি ফিল্ড থাকে এবং সেটা কাস্টম ফিল্ড নামে সেভ হয়:"
                    : "If the form has just one 'Name' field saved as a custom meta:"}
                </p>
                <div className="p-2 rounded bg-muted border border-border">
                  <pre className="text-[11px] text-foreground font-mono whitespace-pre-wrap">{isBn
                    ? `// নিচের লাইনগুলো খুঁজুন:
$name_parts = array_filter(array(
    $billing_data['first_name'] ?? '',
    $billing_data['last_name'] ?? '',
));

// এর পরে যোগ করুন:
if (empty($name_parts)) {
    $customer_name = $order->get_meta('billing_full_name')
                  ?: $order->get_meta('your_custom_name_field')
                  ?: 'Unknown';
}`
                    : `// Find these lines:
$name_parts = array_filter(array(
    $billing_data['first_name'] ?? '',
    $billing_data['last_name'] ?? '',
));

// Add after:
if (empty($name_parts)) {
    $customer_name = $order->get_meta('billing_full_name')
                  ?: $order->get_meta('your_custom_name_field')
                  ?: 'Unknown';
}`}</pre>
                </div>
              </div>

              {/* Case 3: Specific extra fields */}
              <div className="p-3 rounded-lg bg-background border border-border space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  {isBn ? "🔹 কেস ৩: নির্দিষ্ট Extra ফিল্ড আলাদাভাবে পাঠাতে চান" : "🔹 Case 3: Send specific extra fields explicitly"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isBn
                    ? "কাস্টম মেটা অটো-ক্যাপচার হচ্ছে, কিন্তু যদি কোনো নির্দিষ্ট ফিল্ড নাম দিয়ে পাঠাতে চান:"
                    : "Custom meta is auto-captured, but if you want to send specific fields with clear names:"}
                </p>
                <div className="p-2 rounded bg-muted border border-border">
                  <pre className="text-[11px] text-foreground font-mono whitespace-pre-wrap">{isBn
                    ? `// extra_fields array-তে নিচেরগুলো যোগ করুন:
'extra_fields' => array_merge(array(
    // ... আগের ফিল্ডগুলো ...
    'district'    => $order->get_meta('billing_district'),
    'thana'       => $order->get_meta('billing_thana'),
    'delivery_note' => $order->get_meta('order_comments'),
), $custom_fields),`
                    : `// Add to the extra_fields array:
'extra_fields' => array_merge(array(
    // ... existing fields ...
    'district'    => $order->get_meta('billing_district'),
    'thana'       => $order->get_meta('billing_thana'),
    'delivery_note' => $order->get_meta('order_comments'),
), $custom_fields),`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* How to find field names */}
          <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 space-y-3">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              {isBn ? "💡 কাস্টম ফিল্ড নাম কিভাবে বের করবেন?" : "💡 How to Find Custom Field Names?"}
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>{isBn ? "আপনার সাইটে একটি টেস্ট অর্ডার দেওয়ার পর:" : "After placing a test order on your site:"}</p>
              <div className="space-y-1.5 ml-2">
                <p>1. {isBn ? "WordPress Dashboard → WooCommerce → Orders → টেস্ট অর্ডারটি খুলুন" : "WordPress Dashboard → WooCommerce → Orders → Open the test order"}</p>
                <p>2. {isBn ? "নিচে \"Custom Fields\" বা \"Order Meta\" সেকশনে সব ফিল্ড নাম দেখতে পাবেন" : "Scroll down to 'Custom Fields' or 'Order Meta' section to see all field names"}</p>
                <p>3. {isBn ? "যেকোনো ফিল্ডের নাম (key) ব্যবহার করে $order->get_meta('field_name') দিয়ে ডাটা পেতে পারবেন" : "Use any field key with $order->get_meta('field_name') to get the data"}</p>
              </div>
              <div className="p-2 rounded bg-background border border-border mt-2">
                <p className="text-[11px] font-medium text-foreground">
                  {isBn ? "🎯 টিপস: আমাদের কোড ইতিমধ্যেই সব কাস্টম মেটা অটো-ক্যাপচার করে extra_fields এ পাঠায়। তাই বেশিরভাগ ক্ষেত্রে কোনো চেঞ্জ লাগবে না!" : "🎯 Tip: Our code already auto-captures all custom meta into extra_fields. So in most cases, no changes needed!"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Format */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            {isBn ? "যে ডাটা ফরম্যাটে পাঠানো হয় (JSON)" : "Data Format Sent (JSON)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 rounded-lg bg-muted border border-border">
            <pre className="text-xs text-foreground whitespace-pre-wrap">{JSON.stringify({
              customer_name: "রহিম উদ্দিন",
              phone: "01712345678",
              address: "ধানমন্ডি ৩২, ঢাকা",
              extra_fields: {
                email: "rahim@example.com",
                order_id: 1234,
                product: "Special Perfume Combo",
                quantity: 1,
                total: "319.00",
                currency: "BDT",
                payment: "Cash On Delivery",
                website: "my-site.com",
                "_billing_district": "Dhaka",
                "custom_field_1": "value (অটো-ক্যাপচার)"
              }
            }, null, 2)}</pre>
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-[11px] text-muted-foreground">
              {isBn ? "⚠️ আবশ্যক ফিল্ড: customer_name, phone — বাকি সব ঐচ্ছিক" : "⚠️ Required: customer_name, phone — everything else is optional"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isBn ? "💡 কাস্টম মেটা ফিল্ড অটোমেটিক extra_fields এ যোগ হয় — আলাদা কিছু করতে হবে না" : "💡 Custom meta fields are automatically added to extra_fields"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step-by-Step Visual Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {isBn ? "ধাপ ৪: টেস্ট ও যাচাই করুন" : "Step 4: Test & Verify"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              step: "1",
              title: isBn ? "WordPress সাইটে একটি টেস্ট অর্ডার দিন" : "Place a test order on your WordPress site",
              desc: isBn ? "চেক-আউট ফর্মে নাম, ফোন, ঠিকানা দিয়ে অর্ডার করুন" : "Fill checkout form with name, phone, address",
            },
            {
              step: "2",
              title: isBn ? "এই পেজে এসে 'টেস্ট করুন' বাটনে ক্লিক করুন" : "Come to this page and click 'Test Connection'",
              desc: isBn ? "এটি একটি ডামি ডাটা পাঠিয়ে কানেকশন চেক করবে" : "This sends a dummy data to verify connection",
            },
            {
              step: "3",
              title: isBn ? "TL ড্যাশবোর্ডে Fresh Data ট্যাবে চেক করুন" : "Check TL Dashboard → Fresh Data tab",
              desc: isBn ? "ডাটা দেখা গেলে সেটআপ সফল!" : "If data appears, setup is complete!",
            },
            {
              step: "4",
              title: isBn ? "WordPress এ error_log চেক করুন (সমস্যা হলে)" : "Check WordPress error_log (if issues)",
              desc: isBn ? "wp-content/debug.log ফাইলে CRM Webhook Error দেখুন" : "Look for 'CRM Webhook Error' in wp-content/debug.log",
            },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">{item.step}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* WordPress Debug Mode Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            {isBn ? "WordPress Debug Mode চালু করুন (ঐচ্ছিক)" : "Enable WordPress Debug Mode (Optional)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isBn
              ? "সমস্যা হলে WordPress এর wp-config.php ফাইলে নিচের লাইনগুলো যোগ/পরিবর্তন করুন:"
              : "If you face issues, add/modify these lines in wp-config.php:"}
          </p>
          <div className="p-3 rounded-lg bg-muted border border-border">
            <pre className="text-xs text-foreground whitespace-pre font-mono">{`define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);`}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            {isBn
              ? "তাহলে wp-content/debug.log ফাইলে সব error দেখতে পাবেন। প্রোডাকশনে WP_DEBUG বন্ধ রাখুন।"
              : "Then check wp-content/debug.log for all errors. Keep WP_DEBUG off in production."}
          </p>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            {isBn ? "সমস্যা ও সমাধান" : "Troubleshooting"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                q: isBn ? "ডাটা আসছে না?" : "Data not coming through?",
                a: isBn
                  ? "✅ Campaign status \"Active\" আছে কিনা চেক করুন\n✅ Webhook URL সঠিক কিনা দেখুন (Campaign ID মিলছে?)\n✅ x-webhook-secret হেডার সঠিক কিনা চেক করুন\n✅ WordPress সাইটে SSL (https) চালু আছে কিনা দেখুন\n✅ wp-content/debug.log এ কোনো PHP error আছে কিনা দেখুন\n✅ WooCommerce এর order status \"processing\" বা \"completed\" আছে কিনা"
                  : "✅ Check Campaign status is 'Active'\n✅ Verify Webhook URL has correct Campaign ID\n✅ Check x-webhook-secret header is correct\n✅ Ensure WordPress site has SSL (https)\n✅ Check wp-content/debug.log for PHP errors\n✅ Ensure WooCommerce order status is 'processing' or 'completed'"
              },
              {
                q: isBn ? "401 Unauthorized এরর?" : "401 Unauthorized error?",
                a: isBn
                  ? "Secret Key ভুল আছে বা হেডার মিসিং। উপরে থেকে সঠিক Campaign সিলেক্ট করে Secret Key কপি করুন। ওয়েবসাইট-ভিত্তিক Secret Key ব্যবহার করলে সেটি ম্যাচ করছে কিনা দেখুন।"
                  : "Secret Key is wrong or header is missing. Select the correct Campaign above and copy the Secret Key. If using per-website keys, ensure they match."
              },
              {
                q: isBn ? "Duplicate ডাটা আসছে?" : "Getting duplicate data?",
                a: isBn
                  ? "সিস্টেম অটোমেটিক ৩০ দিনের মধ্যে একই ফোন নম্বর + একই Campaign-এর ডুপ্লিকেট ফিল্টার করে। PHP কোডে _crm_webhook_sent মেটা চেক করে যাতে একই অর্ডার দুবার না যায়।"
                  : "The system filters duplicates with same phone + campaign within 30 days. The PHP code checks _crm_webhook_sent meta to prevent duplicate sends."
              },
              {
                q: isBn ? "Lead নাকি Processing — কিভাবে আলাদা হয়?" : "How are Lead vs Processing differentiated?",
                a: isBn
                  ? "প্রতিটি ওয়েবসাইটের জন্য আলাদা Secret Key আছে। সিস্টেম Secret Key দেখে বুঝে নেয় ডাটাটি Lead নাকি Processing। HR ক্যাম্পেইন সেটিংসে প্রতিটি ওয়েবসাইট Lead/Processing হিসেবে কনফিগার করা থাকে।"
                  : "Each website has its own Secret Key. The system identifies Lead vs Processing based on the key. HR configures each website as Lead/Processing in campaign settings."
              },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-background">
                <p className="font-heading font-bold text-sm text-foreground mb-1">{item.q}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{item.a}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Response Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            {isBn ? "API Response কোড" : "API Response Codes"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Code</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">{isBn ? "অর্থ" : "Meaning"}</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">{isBn ? "করণীয়" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { code: "200", meaning: isBn ? "সফল" : "Success", action: isBn ? "ডাটা সংরক্ষণ হয়েছে ✅" : "Data saved ✅" },
                  { code: "400", meaning: isBn ? "ভুল রিকুয়েস্ট" : "Bad Request", action: isBn ? "JSON ফরম্যাট বা Campaign ID ঠিক আছে কিনা দেখুন" : "Check JSON format or Campaign ID" },
                  { code: "401", meaning: isBn ? "Secret Key নেই" : "No Secret Key", action: isBn ? "PHP কোডে x-webhook-secret হেডার আছে কিনা দেখুন" : "Check x-webhook-secret header in PHP code" },
                  { code: "403", meaning: isBn ? "Secret Key ভুল" : "Wrong Secret Key", action: isBn ? "সঠিক Secret Key ব্যবহার করুন" : "Use correct Secret Key" },
                  { code: "404", meaning: isBn ? "Campaign পাওয়া যায়নি" : "Campaign not found", action: isBn ? "URL-এর Campaign ID চেক করুন" : "Check Campaign ID in URL" },
                ].map((row) => (
                  <tr key={row.code} className="border-b border-border last:border-0">
                    <td className="py-2 px-3">
                      <Badge variant="outline" className={row.code === "200" ? "border-green-500 text-green-600" : "border-destructive text-destructive"}>
                        {row.code}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-foreground">{row.meaning}</td>
                    <td className="py-2 px-3 text-muted-foreground">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI Helper Prompt */}
      <Card className="border-dashed border-2 border-primary/30">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            🤖 {isBn ? "AI-কে সেটআপ করাতে চান?" : "Want AI to set it up?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isBn
              ? "নিচের টেক্সটটি কপি করে ChatGPT/Claude বা যেকোনো AI-তে পেস্ট করুন। AI আপনাকে স্টেপ বাই স্টেপ গাইড করবে:"
              : "Copy the text below and paste it into ChatGPT/Claude or any AI. It will guide you step by step:"}
          </p>
          {selectedCampaign && (
            <div className="relative p-4 rounded-lg bg-muted border border-border">
              <button
                onClick={() => {
                  const prompt = isBn
                    ? `আমার একটি WordPress/WooCommerce সাইট আছে। আমি চাই কেউ চেক-আউট ফর্ম পূরণ করে অর্ডার করলে সেই ডাটা (নাম, ফোন, ঠিকানা, প্রোডাক্ট) অটোমেটিক আমার CRM সিস্টেমে যাবে।

আমার CRM এর তথ্য:
- Webhook URL: ${webhookUrl}
- Secret Key: [উপরে থেকে কপি করুন]
- HTTP Header: x-webhook-secret
- Method: POST
- Content-Type: application/json

JSON ফরম্যাট:
{
  "customer_name": "বিলিং নাম",
  "phone": "বিলিং ফোন",
  "address": "বিলিং ঠিকানা, শহর",
  "extra_fields": {
    "email": "বিলিং ইমেইল",
    "order_id": "WooCommerce অর্ডার আইডি",
    "product": "প্রোডাক্ট নাম",
    "quantity": "পরিমাণ",
    "total": "মোট মূল্য"
  }
}

আমাকে functions.php বা Code Snippets প্লাগইনে যোগ করার জন্য সম্পূর্ণ PHP কোড দাও যা woocommerce_thankyou হুকে কাজ করবে। ডুপ্লিকেট যাতে না যায় সেজন্য order meta চেক করবে। error_log-এ ত্রুটি লগ করবে।`
                    : `I have a WordPress/WooCommerce site. When someone places an order via checkout, I want the data (name, phone, address, product) to be automatically sent to my CRM.

CRM Details:
- Webhook URL: ${webhookUrl}
- Secret Key: [copy from above]
- HTTP Header: x-webhook-secret
- Method: POST
- Content-Type: application/json

JSON format:
{
  "customer_name": "billing name",
  "phone": "billing phone",
  "address": "billing address, city",
  "extra_fields": {
    "email": "billing email",
    "order_id": "WooCommerce order ID",
    "product": "product names",
    "quantity": "total quantity",
    "total": "order total"
  }
}

Give me the complete PHP code for functions.php or Code Snippets plugin that hooks into woocommerce_thankyou. It should check order meta to prevent duplicates and log errors to error_log.`;
                  copyText(prompt);
                }}
                className="absolute top-2 right-2 text-muted-foreground hover:text-primary"
              >
                <Copy className="h-4 w-4" />
              </button>
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {isBn
                  ? `আমার একটি WordPress/WooCommerce সাইট আছে। আমি চাই কেউ চেক-আউট ফর্ম পূরণ করে অর্ডার করলে সেই ডাটা অটোমেটিক আমার CRM সিস্টেমে যাবে।

Webhook URL: ${webhookUrl}
Secret Header: x-webhook-secret
Method: POST | Format: JSON

আমাকে সম্পূর্ণ PHP কোড দাও...`
                  : `I have a WooCommerce site. I want checkout orders to auto-send to my CRM.

Webhook URL: ${webhookUrl}
Secret Header: x-webhook-secret
Method: POST | Format: JSON

Give me complete PHP code...`}
              </pre>
            </div>
          )}
          {!selectedCampaign && (
            <p className="text-sm text-muted-foreground text-center py-2">
              {isBn ? "👆 প্রথমে উপরে থেকে ক্যাম্পেইন সিলেক্ট করুন" : "👆 Select a campaign above first"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WebhookDocumentation;
