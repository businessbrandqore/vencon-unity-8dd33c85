import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Eye, EyeOff, CheckCircle, XCircle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const HRCampaignIntegration = () => {
  const { id: campaignId } = useParams<{ id: string }>();
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const { data: campaign } = useQuery({
    queryKey: ["campaign-integration", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status, webhook_secret")
        .eq("id", campaignId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const { data: importLogs } = useQuery({
    queryKey: ["import-logs", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_import_logs")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const webhookUrl = `${supabaseUrl}/functions/v1/import-leads/${campaignId}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const handleTestConnection = async () => {
    if (!campaign?.webhook_secret) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": campaign.webhook_secret,
        },
        body: JSON.stringify({
          customer_name: "Test Customer",
          phone: `test-${Date.now()}`,
          address: "Test Address, Dhaka",
        }),
      });
      const data = await res.json();
      if (res.ok && data.imported > 0) {
        setTestResult({ success: true, message: "✓ Connection সফল! Test lead import হয়েছে।" });
      } else if (res.ok && data.skipped_duplicates > 0) {
        setTestResult({ success: true, message: "✓ Connection সফল! (Duplicate test lead skipped)" });
      } else {
        setTestResult({ success: false, message: data.error || "Unknown error" });
      }
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const maskedSecret = campaign?.webhook_secret
    ? "•".repeat(Math.max(0, campaign.webhook_secret.length - 8)) + campaign.webhook_secret.slice(-8)
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Integration — {campaign?.name || "Loading..."}
        </h1>
        <p className="text-muted-foreground">WordPress webhook setup ও lead import configuration</p>
      </div>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Webhook URL:</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                {webhookUrl}
              </code>
              <Button size="icon" variant="outline" onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Webhook Secret:</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                {showSecret ? campaign?.webhook_secret : maskedSecret}
              </code>
              <Button size="icon" variant="outline" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => copyToClipboard(campaign?.webhook_secret || "", "Secret")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">Setup Instructions:</p>
            <p>
              WordPress-এ Contact Form 7 বা WPForms-এ এই URL টি webhook destination হিসেবে add করুন।
            </p>
            <p>
              Header-এ <code className="bg-muted px-1 rounded">X-Webhook-Secret: [secret]</code> পাঠান।
            </p>
            <p className="text-muted-foreground">
              JSON body তে <code>customer_name</code> (required), <code>phone</code> (required),{" "}
              <code>address</code>, <code>city</code> পাঠান।
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleTestConnection} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Test Connection
            </Button>
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.message}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Import Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Import Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead>Duplicates</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importLogs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{format(new Date(log.created_at!), "yyyy-MM-dd HH:mm")}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.source}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{log.leads_imported}</TableCell>
                  <TableCell className="text-muted-foreground">{log.duplicates_skipped}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "success" ? "default" : "destructive"}>
                      {log.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              )) ?? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No imports yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default HRCampaignIntegration;
