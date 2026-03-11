import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookOpen, Globe, Shield, CheckCircle2, ArrowRight, Copy, Code, AlertTriangle, Eye, EyeOff, Send, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WebhookDocumentation = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const isBn = t("vencon") === "VENCON";
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
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

  const selectedCampaign = campaigns?.find((c) => c.id === selectedCampaignId);
  const webhookUrl = selectedCampaignId
    ? `${supabaseUrl}/functions/v1/import-leads/${selectedCampaignId}`
    : "";

  const maskedSecret = selectedCampaign?.webhook_secret
    ? "•".repeat(Math.max(0, selectedCampaign.webhook_secret.length - 8)) + selectedCampaign.webhook_secret.slice(-8)
    : "";

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: isBn ? "কপি হয়েছে!" : "Copied!" });
  };

  const handleTestConnection = async () => {
    if (!selectedCampaign?.webhook_secret) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": selectedCampaign.webhook_secret,
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
              {isBn ? "Webhook ইন্টিগ্রেশন ডকুমেন্টেশন" : "Webhook Integration Documentation"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isBn ? "WordPress সাইট থেকে ডাটা সংগ্রহের সম্পূর্ণ গাইড" : "Complete guide to collect data from WordPress sites"}
            </p>
          </div>
        </div>
      </div>

      {/* Campaign Selector */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {isBn ? "ক্যাম্পেইন সিলেক্ট করুন" : "Select Campaign"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedCampaignId} onValueChange={(v) => { setSelectedCampaignId(v); setShowSecret(false); setTestResult(null); }}>
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

          {selectedCampaign && (
            <div className="space-y-4 pt-2">
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
                <label className="text-xs font-medium text-muted-foreground block mb-1">Secret Key</label>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted border border-border">
                  <code className="text-xs text-foreground flex-1 break-all font-mono">
                    {showSecret ? selectedCampaign.webhook_secret : maskedSecret}
                  </code>
                  <button onClick={() => setShowSecret(!showSecret)} className="text-muted-foreground hover:text-primary shrink-0">
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={() => copyText(selectedCampaign.webhook_secret || "")} className="text-muted-foreground hover:text-primary shrink-0">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* HTTP Header hint */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">HTTP Header</label>
                <div className="p-2.5 rounded-lg bg-muted border border-border">
                  <code className="text-xs text-foreground">x-webhook-secret: {showSecret ? selectedCampaign.webhook_secret : "••••••••"}</code>
                </div>
              </div>

              {/* Test Button */}
              <div className="flex items-center gap-3">
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
              {isBn ? "👆 উপরে থেকে একটি ক্যাম্পেইন সিলেক্ট করুন — তাহলে Webhook URL ও Secret Key দেখতে পাবেন" : "👆 Select a campaign above to see its Webhook URL & Secret Key"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {isBn ? "কিভাবে কাজ করে?" : "How Does It Work?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isBn
              ? "আপনার WordPress সাইটে কেউ ফর্ম সাবমিট করলে, WordPress একটি Webhook (HTTP POST request) পাঠায় আমাদের সিস্টেমে। সিস্টেম Secret Key দিয়ে যাচাই করে ডাটা সংরক্ষণ করে।"
              : "When someone submits a form on your WordPress site, WordPress sends a Webhook (HTTP POST request) to our system. The system validates it using a Secret Key and saves the data."}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-body">
            {[
              isBn ? "🌐 ভিজিটর ফর্ম সাবমিট করে" : "🌐 Visitor submits form",
              isBn ? "📤 WordPress Webhook পাঠায়" : "📤 WordPress sends Webhook",
              isBn ? "🔐 Secret Key যাচাই হয়" : "🔐 Secret Key validated",
              isBn ? "💾 ডাটা সংরক্ষণ হয়" : "💾 Data saved",
              isBn ? "📊 Dashboard-এ দেখা যায়" : "📊 Visible on Dashboard",
            ].map((step, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium">{step}</span>
                {i < 4 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Format */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            {isBn ? "ডাটা ফরম্যাট (JSON Body)" : "Data Format (JSON Body)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 rounded-lg bg-muted border border-border">
            <pre className="text-xs text-foreground whitespace-pre-wrap">{JSON.stringify({
              customer_name: "John Doe",
              phone: "01712345678",
              address: "123 Main St",
              city: "Dhaka",
              extra_fields: { email: "john@example.com", message: "Interested in product" }
            }, null, 2)}</pre>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {isBn ? "⚠️ customer_name ও phone ফিল্ড আবশ্যক" : "⚠️ customer_name and phone fields are required"}
          </p>
        </CardContent>
      </Card>

      {/* WPForms Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-0">1</Badge>
            WPForms {isBn ? "দিয়ে সেটআপ" : "Setup"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-800 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {isBn
                ? "WPForms Webhooks addon প্রয়োজন (Pro/Elite plan)। Lite version-এ Webhooks নেই।"
                : "WPForms Webhooks addon required (Pro/Elite plan). Lite version doesn't include Webhooks."}
            </p>
          </div>

          {[
            { step: "1", title: isBn ? "WPForms → Addons → Webhooks install ও activate করুন" : "WPForms → Addons → Install & activate Webhooks" },
            { step: "2", title: isBn ? "আপনার ফর্ম Edit করুন → Settings → Webhooks ট্যাবে যান" : "Edit your form → Settings → Go to Webhooks tab" },
            { step: "3", title: isBn ? "'Enable Webhooks' টগল চালু করুন" : "Turn on 'Enable Webhooks' toggle" },
            { step: "4", title: isBn ? "Request URL ফিল্ডে উপরে থেকে কপি করা Webhook URL পেস্ট করুন" : "Paste the Webhook URL copied from above in the Request URL field" },
            { step: "5", title: isBn ? "Request Method: POST সিলেক্ট করুন" : "Select Request Method: POST" },
            { step: "6", title: isBn ? "Request Format: JSON সিলেক্ট করুন" : "Select Request Format: JSON" },
            { step: "7", title: isBn ? "Request Headers-এ নতুন হেডার যোগ করুন:" : "Add a new Request Header:" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">{item.step}</span>
              </div>
              <p className="text-sm text-foreground">{item.title}</p>
            </div>
          ))}

          <div className="ml-9 p-3 rounded-lg bg-muted border border-border space-y-1">
            <p className="text-xs"><strong>Header Name:</strong> <code className="bg-background px-1.5 py-0.5 rounded text-primary">x-webhook-secret</code></p>
            <p className="text-xs"><strong>Header Value:</strong> <code className="bg-background px-1.5 py-0.5 rounded text-primary">{isBn ? "উপর থেকে কপি করা Secret Key পেস্ট করুন" : "Paste the Secret Key copied from above"}</code></p>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-primary">8</span>
            </div>
            <div>
              <p className="text-sm text-foreground">
                {isBn ? "Body ম্যাপিং করুন — ফর্ম ফিল্ড → JSON key:" : "Map Body fields — Form field → JSON key:"}
              </p>
              <div className="mt-2 p-3 rounded-lg bg-muted border border-border">
                <pre className="text-xs text-foreground">{`customer_name  →  Name field
phone          →  Phone field
address        →  Address field
city           →  City field`}</pre>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-green-600">✓</span>
            </div>
            <p className="text-sm text-foreground font-medium">
              {isBn ? "Save করুন। এখন ফর্ম সাবমিট করলে ডাটা অটোমেটিক আসবে!" : "Save. Now form submissions will automatically flow in!"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact Form 7 Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-0">2</Badge>
            Contact Form 7 {isBn ? "দিয়ে সেটআপ" : "Setup"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-400">
              {isBn
                ? "💡 Contact Form 7 এর সাথে \"CF7 to Webhook\" প্লাগইন ব্যবহার করতে হবে।"
                : "💡 You need the \"CF7 to Webhook\" plugin alongside CF7."}
            </p>
          </div>

          {[
            { step: "1", title: isBn ? "WordPress প্লাগইন ইনস্টল করুন: \"CF7 to Webhook\"" : "Install WordPress plugin: \"CF7 to Webhook\"" },
            { step: "2", title: isBn ? "Contact Form 7 → আপনার ফর্ম Edit করুন" : "Contact Form 7 → Edit your form" },
            { step: "3", title: isBn ? "\"Webhook\" ট্যাবে যান" : "Go to the 'Webhook' tab" },
            { step: "4", title: isBn ? "Webhook URL ফিল্ডে উপরে থেকে কপি করা URL পেস্ট করুন" : "Paste the Webhook URL copied from above" },
            { step: "5", title: isBn ? "Custom Headers সেকশনে যোগ করুন:" : "Add in Custom Headers section:" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">{item.step}</span>
              </div>
              <p className="text-sm text-foreground">{item.title}</p>
            </div>
          ))}

          <div className="ml-9 p-3 rounded-lg bg-muted border border-border">
            <code className="text-xs text-foreground">x-webhook-secret: {isBn ? "উপর থেকে কপি করা Secret Key" : "Secret Key from above"}</code>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-primary">6</span>
            </div>
            <div>
              <p className="text-sm text-foreground">
                {isBn ? "Field ম্যাপিং করুন:" : "Map the fields:"}
              </p>
              <div className="mt-2 p-3 rounded-lg bg-muted border border-border">
                <pre className="text-xs text-foreground">{`[your-name]    →  customer_name
[your-phone]   →  phone
[your-address] →  address
[your-city]    →  city`}</pre>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-green-600">✓</span>
            </div>
            <p className="text-sm text-foreground font-medium">
              {isBn ? "Save করুন। ফর্ম সাবমিট হলে ডাটা চলে আসবে!" : "Save. Form submissions will flow in automatically!"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* WP Webhooks Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-0">3</Badge>
            WP Webhooks {isBn ? "দিয়ে সেটআপ (রেকমেন্ডেড)" : "Setup (Recommended)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-xs text-green-800 dark:text-green-400">
              {isBn
                ? "✅ WP Webhooks সবচেয়ে সহজ — Free version-ও কাজ করবে। এটি রেকমেন্ডেড।"
                : "✅ WP Webhooks is the easiest — Free version works. This is recommended."}
            </p>
          </div>

          {[
            { step: "1", title: isBn ? "WordPress → Plugins → \"WP Webhooks\" ইনস্টল ও activate করুন" : "WordPress → Plugins → Install & activate 'WP Webhooks'" },
            { step: "2", title: isBn ? "WP Webhooks → Send Data → \"Add Webhook URL\" ক্লিক করুন" : "WP Webhooks → Send Data → Click 'Add Webhook URL'" },
            { step: "3", title: isBn ? "Webhook Name দিন (যেমন: \"CRM Lead Import\")" : "Give Webhook Name (e.g. 'CRM Lead Import')" },
            { step: "4", title: isBn ? "Webhook URL ফিল্ডে উপরে থেকে কপি করা URL পেস্ট করুন" : "Paste your Webhook URL from above" },
            { step: "5", title: isBn ? "Trigger সিলেক্ট করুন → \"Form submission\"" : "Select Trigger → 'Form submission'" },
            { step: "6", title: isBn ? "Settings → Headers → নতুন হেডার যোগ করুন:" : "Settings → Headers → Add new header:" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">{item.step}</span>
              </div>
              <p className="text-sm text-foreground">{item.title}</p>
            </div>
          ))}

          <div className="ml-9 p-3 rounded-lg bg-muted border border-border space-y-1">
            <p className="text-xs"><strong>Key:</strong> <code className="bg-background px-1.5 py-0.5 rounded text-primary">x-webhook-secret</code></p>
            <p className="text-xs"><strong>Value:</strong> <code className="bg-background px-1.5 py-0.5 rounded text-primary">{isBn ? "উপর থেকে কপি করা Secret Key" : "Secret Key from above"}</code></p>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-primary">7</span>
            </div>
            <div>
              <p className="text-sm text-foreground">
                {isBn ? "Body/Payload Template সেট করুন:" : "Set Body/Payload Template:"}
              </p>
              <div className="mt-2 p-3 rounded-lg bg-muted border border-border">
                <pre className="text-xs text-foreground">{JSON.stringify({
                  customer_name: "{{name}}",
                  phone: "{{phone}}",
                  address: "{{address}}",
                  city: "{{city}}",
                  extra_fields: {
                    email: "{{email}}",
                    message: "{{message}}"
                  }
                }, null, 2)}</pre>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-green-600">✓</span>
            </div>
            <p className="text-sm text-foreground font-medium">
              {isBn ? "Save করুন এবং \"Send Demo\" বাটনে ক্লিক করে টেস্ট করুন!" : "Save and click 'Send Demo' to test!"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            {isBn ? "সমস্যা সমাধান" : "Troubleshooting"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                q: isBn ? "ডাটা আসছে না?" : "Data not coming through?",
                a: isBn
                  ? "✅ Campaign status \"Active\" আছে কিনা চেক করুন\n✅ Webhook URL সঠিক কিনা দেখুন\n✅ x-webhook-secret হেডার সঠিক কিনা চেক করুন\n✅ WordPress সাইটে SSL (https) চালু আছে কিনা দেখুন"
                  : "✅ Check Campaign status is 'Active'\n✅ Verify Webhook URL is correct\n✅ Check x-webhook-secret header is correct\n✅ Ensure WordPress site has SSL (https) enabled"
              },
              {
                q: isBn ? "401 Unauthorized এরর?" : "401 Unauthorized error?",
                a: isBn
                  ? "Secret Key ভুল আছে। উপরে থেকে সঠিক Campaign সিলেক্ট করে Secret Key কপি করুন।"
                  : "Secret Key is wrong. Select the correct Campaign above and copy the Secret Key."
              },
              {
                q: isBn ? "Duplicate ডাটা আসছে?" : "Getting duplicate data?",
                a: isBn
                  ? "সিস্টেম অটোমেটিক ৩০ দিনের মধ্যে একই ফোন নম্বর + একই Campaign-এর ডুপ্লিকেট ফিল্টার করে।"
                  : "The system automatically filters duplicates with the same phone number + campaign within 30 days."
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
                  { code: "200", meaning: isBn ? "সফল" : "Success", action: isBn ? "ডাটা সংরক্ষণ হয়েছে" : "Data saved" },
                  { code: "400", meaning: isBn ? "ভুল রিকুয়েস্ট" : "Bad Request", action: isBn ? "Campaign ID ঠিক আছে কিনা দেখুন" : "Check Campaign ID" },
                  { code: "401", meaning: isBn ? "Secret Key নেই" : "No Secret Key", action: isBn ? "x-webhook-secret হেডার যোগ করুন" : "Add x-webhook-secret header" },
                  { code: "403", meaning: isBn ? "Secret Key ভুল" : "Wrong Secret Key", action: isBn ? "সঠিক Secret Key ব্যবহার করুন" : "Use correct Secret Key" },
                  { code: "404", meaning: isBn ? "Campaign পাওয়া যায়নি" : "Campaign not found", action: isBn ? "Campaign ID চেক করুন" : "Check Campaign ID" },
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
    </div>
  );
};

export default WebhookDocumentation;
