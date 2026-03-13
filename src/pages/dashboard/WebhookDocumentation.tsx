import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookOpen, Globe, Shield, CheckCircle2, ArrowRight, Copy, Code, AlertTriangle, Eye, EyeOff, Send, Loader2, CheckCircle, XCircle, ShoppingCart, Webhook, FileCode, Server, Zap } from "lucide-react";
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

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

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
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": activeSecret,
        },
        body: JSON.stringify({
          customer_name: "Test Customer",
          phone: `test-${Date.now()}`,
          address: "Test Address, Dhaka",
        }),
      });
      const data = await res.json();
      if (res.ok && data.imported > 0) {
        setTestResult({ success: true, message: isBn ? "✓ Connection সফল! Test lead import হয়েছে।" : "✓ Connection successful!" });
      } else if (res.ok && data.skipped_duplicates > 0) {
        setTestResult({ success: true, message: isBn ? "✓ Connection সফল! (Duplicate skipped)" : "✓ Connected! (Duplicate skipped)" });
      } else {
        setTestResult({ success: false, message: data.error || "Unknown error" });
      }
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    } finally {
      setTesting(false);
    }
  };

  // Generate PHP snippet for the selected campaign
  const generatePhpSnippet = (url: string, secret: string, websiteName?: string) => {
    return `// functions.php বা custom plugin এ যোগ করুন
// WooCommerce Checkout Order → CRM Webhook
add_action('woocommerce_thankyou', 'send_order_to_crm', 10, 1);

function send_order_to_crm(\$order_id) {
    \$order = wc_get_order(\$order_id);
    if (!$order) return;

    // একবারই পাঠানো নিশ্চিত করুন
    if (\$order->get_meta('_crm_webhook_sent')) return;

    \$body = array(
        'customer_name' => \$order->get_billing_first_name() . ' ' . \$order->get_billing_last_name(),
        'phone'         => \$order->get_billing_phone(),
        'address'       => \$order->get_billing_address_1() . ', ' . \$order->get_billing_city(),
        'extra_fields'  => array(
            'email'        => \$order->get_billing_email(),
            'order_id'     => \$order_id,
            'order_total'  => \$order->get_total(),
            'product'      => '',
            'quantity'     => 0,${websiteName ? `\n            'website'      => '${websiteName}',` : ''}
        ),
    );

    // প্রোডাক্ট তথ্য নিন
    \$items = \$order->get_items();
    \$product_names = array();
    \$total_qty = 0;
    foreach (\$items as \$item) {
        \$product_names[] = \$item->get_name();
        \$total_qty += \$item->get_quantity();
    }
    \$body['extra_fields']['product']  = implode(', ', \$product_names);
    \$body['extra_fields']['quantity'] = \$total_qty;

    \$response = wp_remote_post('${url}', array(
        'method'  => 'POST',
        'timeout' => 30,
        'headers' => array(
            'Content-Type'     => 'application/json',
            'x-webhook-secret' => '${secret}',
        ),
        'body' => wp_json_encode(\$body),
    ));

    // সফল হলে মার্ক করুন
    if (!is_wp_error(\$response) && wp_remote_retrieve_response_code(\$response) === 200) {
        \$order->update_meta_data('_crm_webhook_sent', 'yes');
        \$order->save();
    } else {
        // ত্রুটি লগ করুন
        error_log('CRM Webhook Error: ' . print_r(\$response, true));
    }
}`;
  };

  // Generate per-website PHP snippet
  const generatePerWebsitePhpSnippet = (websiteSecret: string, websiteUrl: string, siteName: string, dataMode: string) => {
    const perSiteUrl = `${supabaseUrl}/functions/v1/import-leads/${selectedCampaignId}`;
    return `// === ${siteName} (${dataMode === 'lead' ? 'Lead' : 'Processing'} ডাটা) ===
// functions.php বা custom plugin এ যোগ করুন

add_action('woocommerce_thankyou', 'send_order_to_crm_${dataMode}', 10, 1);

function send_order_to_crm_${dataMode}(\$order_id) {
    \$order = wc_get_order(\$order_id);
    if (!\$order) return;
    if (\$order->get_meta('_crm_webhook_sent')) return;

    \$items = \$order->get_items();
    \$product_names = array();
    \$total_qty = 0;
    foreach (\$items as \$item) {
        \$product_names[] = \$item->get_name();
        \$total_qty += \$item->get_quantity();
    }

    \$body = array(
        'customer_name' => \$order->get_billing_first_name() . ' ' . \$order->get_billing_last_name(),
        'phone'         => \$order->get_billing_phone(),
        'address'       => \$order->get_billing_address_1() . ', ' . \$order->get_billing_city(),
        'extra_fields'  => array(
            'email'    => \$order->get_billing_email(),
            'order_id' => \$order_id,
            'product'  => implode(', ', \$product_names),
            'quantity' => \$total_qty,
            'total'    => \$order->get_total(),
            'website'  => '${siteName}',
        ),
    );

    \$response = wp_remote_post('${perSiteUrl}', array(
        'method'  => 'POST',
        'timeout' => 30,
        'headers' => array(
            'Content-Type'     => 'application/json',
            'x-webhook-secret' => '${websiteSecret}',
        ),
        'body' => wp_json_encode(\$body),
    ));

    if (!is_wp_error(\$response) && wp_remote_retrieve_response_code(\$response) === 200) {
        \$order->update_meta_data('_crm_webhook_sent', 'yes');
        \$order->save();
    } else {
        error_log('CRM Webhook Error [${siteName}]: ' . print_r(\$response, true));
    }
}`;
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
              ? "আপনার WordPress/WooCommerce সাইটে কেউ চেক-আউট ফর্ম পূরণ করে অর্ডার করলে, সেই অর্ডারের তথ্য (নাম, ফোন, ঠিকানা, প্রোডাক্ট) অটোমেটিক আমাদের CRM সিস্টেমে চলে আসবে — Lead অথবা Processing ডাটা হিসেবে। কোনো ম্যানুয়াল কাজ লাগবে না।"
              : "When someone places an order via your WooCommerce checkout, the order data (name, phone, address, product) is automatically sent to our CRM as Lead or Processing data. No manual work needed."}
          </p>
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

          {/* Website (Lead/Processing) selector */}
          {selectedCampaign && campaignWebsites && campaignWebsites.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                {isBn ? "ওয়েবসাইট সিলেক্ট করুন (Lead / Processing)" : "Select Website (Lead / Processing)"}
              </label>
              <Select value={selectedWebsiteId} onValueChange={(v) => { setSelectedWebsiteId(v); setShowSecret(false); setTestResult(null); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={isBn ? "— ওয়েবসাইট বেছে নিন —" : "— Choose a website —"} />
                </SelectTrigger>
                <SelectContent>
                  {campaignWebsites.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      <span className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-primary" />
                        {ws.site_name}
                        <Badge variant={ws.data_mode === "lead" ? "default" : "secondary"} className="text-[10px]">
                          {ws.data_mode === "lead" ? "Lead" : "Processing"}
                        </Badge>
                        {ws.is_active ? (
                          <Badge className="bg-green-500/10 text-green-600 border-0 text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Show credentials when campaign (and optionally website) is selected */}
          {selectedCampaign && (
            <div className="space-y-4 pt-2">
              {/* Selected info summary */}
              {selectedWebsite && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">{selectedWebsite.site_name}</span>
                    <Badge variant={selectedWebsite.data_mode === "lead" ? "default" : "secondary"}>
                      {selectedWebsite.data_mode === "lead" ? "Lead Data" : "Processing Data"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">→ {selectedWebsite.site_url}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isBn 
                      ? `এই ওয়েবসাইট থেকে আসা ডাটা "${selectedWebsite.data_mode === 'lead' ? 'Lead' : 'Processing'}" হিসেবে সেভ হবে।`
                      : `Data from this website will be saved as "${selectedWebsite.data_mode === 'lead' ? 'Lead' : 'Processing'}".`}
                  </p>
                </div>
              )}

              {/* Webhook URL */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Webhook URL</label>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted border border-border">
                  <code className="text-xs text-foreground flex-1 break-all font-mono">{webhookUrl}</code>
                  <button onClick={() => copyText(webhookUrl)} className="text-muted-foreground hover:text-primary shrink-0">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Secret Key */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {selectedWebsite 
                    ? (isBn ? `Secret Key — ${selectedWebsite.site_name} (${selectedWebsite.data_mode === 'lead' ? 'Lead' : 'Processing'})` : `Secret Key — ${selectedWebsite.site_name} (${selectedWebsite.data_mode})`)
                    : (isBn ? "Campaign Secret Key" : "Campaign Secret Key")}
                </label>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted border border-border">
                  <code className="text-xs text-foreground flex-1 break-all font-mono">
                    {showSecret ? activeSecret : maskedSecret}
                  </code>
                  <button onClick={() => setShowSecret(!showSecret)} className="text-muted-foreground hover:text-primary shrink-0">
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={() => copyText(activeSecret)} className="text-muted-foreground hover:text-primary shrink-0">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                {!selectedWebsite && campaignWebsites && campaignWebsites.length > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    {isBn ? "⚠️ ওয়েবসাইট সিলেক্ট করুন — প্রতিটি সাইটের নিজস্ব Secret Key আছে যা ডাটা মোড (Lead/Processing) নির্ধারণ করে।" 
                          : "⚠️ Select a website — each site has its own Secret Key that determines data mode (Lead/Processing)."}
                  </p>
                )}
              </div>

              {/* Test Button */}
              <div className="flex items-center gap-3 pt-2">
                <Button size="sm" onClick={handleTestConnection} disabled={testing || selectedCampaign.status !== "active"}>
                  {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {isBn ? "টেস্ট করুন" : "Test Connection"}
                </Button>
                {selectedCampaign.status !== "active" && (
                  <span className="text-xs text-destructive">{isBn ? "⚠️ ক্যাম্পেইন Active নয়" : "⚠️ Campaign not active"}</span>
                )}
                {testResult && (
                  <div className={`flex items-center gap-1.5 text-xs ${testResult.success ? "text-green-600" : "text-destructive"}`}>
                    {testResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedCampaignId && (
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

          {/* Show code for selected website */}
          {selectedWebsite ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{selectedWebsite.site_name}</span>
                <Badge variant={selectedWebsite.data_mode === "lead" ? "default" : "secondary"}>
                  {selectedWebsite.data_mode === "lead" ? "Lead Data" : "Processing Data"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isBn 
                  ? `📋 নিচের PHP কোডটি "${selectedWebsite.site_name}" ওয়েবসাইটে যোগ করুন। এই কোড ব্যবহার করলে ডাটা "${selectedWebsite.data_mode === 'lead' ? 'Lead' : 'Processing'}" হিসেবে CRM-এ আসবে।`
                  : `📋 Add the PHP code below to "${selectedWebsite.site_name}". Data will arrive as "${selectedWebsite.data_mode}" in the CRM.`}
              </p>
              <div className="relative p-3 rounded-lg bg-muted border border-border overflow-x-auto">
                <button
                  onClick={() => copyText(generatePerWebsitePhpSnippet(selectedWebsite.webhook_secret, selectedWebsite.site_url, selectedWebsite.site_name, selectedWebsite.data_mode))}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-primary"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <pre className="text-[11px] text-foreground whitespace-pre font-mono leading-relaxed">
                  {generatePerWebsitePhpSnippet(selectedWebsite.webhook_secret, selectedWebsite.site_url, selectedWebsite.site_name, selectedWebsite.data_mode)}
                </pre>
              </div>
            </div>
          ) : selectedCampaign && campaignWebsites && campaignWebsites.length > 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-muted-foreground">
                {isBn 
                  ? "👆 উপরে থেকে একটি ওয়েবসাইট (Lead / Processing) সিলেক্ট করুন — তাহলে সেই সাইটের জন্য নির্দিষ্ট PHP কোড দেখাবে।" 
                  : "👆 Select a website (Lead / Processing) above to see the specific PHP code for that site."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {campaignWebsites.map((ws) => (
                  <Badge key={ws.id} variant="outline" className="cursor-pointer hover:bg-primary/10" onClick={() => setSelectedWebsiteId(ws.id)}>
                    {ws.site_name} — {ws.data_mode === "lead" ? "Lead" : "Processing"}
                  </Badge>
                ))}
              </div>
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
                product: "Premium Package",
                quantity: 2,
                total: "4500.00",
                website: "my-site.com"
              }
            }, null, 2)}</pre>
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-[11px] text-muted-foreground">
              {isBn ? "⚠️ আবশ্যক ফিল্ড: customer_name, phone" : "⚠️ Required fields: customer_name, phone"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isBn ? "💡 extra_fields এর সব কিছু ঐচ্ছিক কিন্তু ট্র্যাকিং এর জন্য রাখা ভালো" : "💡 Everything in extra_fields is optional but useful for tracking"}
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
