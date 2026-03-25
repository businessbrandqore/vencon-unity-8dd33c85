import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Truck, Unplug, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface SteadfastConnectorProps {
  campaignId: string;
  campaignName: string;
  initialApiKey?: string;
  initialSecretKey?: string;
  initialConnected?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  isBn?: boolean;
}

const SteadfastConnector = ({
  campaignId,
  campaignName,
  initialApiKey = "",
  initialSecretKey = "",
  initialConnected = false,
  onConnectionChange,
  isBn = true,
}: SteadfastConnectorProps) => {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [secretKey, setSecretKey] = useState(initialSecretKey);
  const [connected, setConnected] = useState(initialConnected);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; balance?: number } | null>(null);

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !secretKey.trim()) {
      toast.error(isBn ? "API Key এবং Secret Key দিন" : "Enter API Key and Secret Key");
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("send-to-steadfast", {
        body: { test_connection: true, api_key: apiKey.trim(), secret_key: secretKey.trim() },
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult({
          success: true,
          message: isBn
            ? `✓ সংযোগ সফল! ব্যালেন্স: ৳${data.balance || 0} (${data.gateway})`
            : `✓ Connected! Balance: ৳${data.balance || 0} (${data.gateway})`,
          balance: data.balance,
        });
      } else {
        setTestResult({
          success: false,
          message: data?.error || (isBn ? "সংযোগ ব্যর্থ" : "Connection failed"),
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim() || !secretKey.trim()) {
      toast.error(isBn ? "API Key এবং Secret Key দিন" : "Enter API Key and Secret Key");
      return;
    }
    setSaving(true);

    try {
      const { error } = await supabase
        .from("campaigns")
        .update({
          steadfast_api_key: apiKey.trim(),
          steadfast_secret_key: secretKey.trim(),
          steadfast_connected: true,
        } as any)
        .eq("id", campaignId);

      if (error) throw error;

      setConnected(true);
      onConnectionChange?.(true);
      toast.success(isBn ? "SteadFast সংযোগ সেভ হয়েছে ✓" : "SteadFast connection saved ✓");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({
          steadfast_api_key: null,
          steadfast_secret_key: null,
          steadfast_connected: false,
        } as any)
        .eq("id", campaignId);

      if (error) throw error;

      setApiKey("");
      setSecretKey("");
      setConnected(false);
      setTestResult(null);
      onConnectionChange?.(false);
      toast.success(isBn ? "SteadFast সংযোগ বিচ্ছিন্ন হয়েছে" : "SteadFast disconnected");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          {isBn ? "SteadFast কুরিয়ার সংযোগ" : "SteadFast Courier Connection"}
          {connected ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 ml-auto">
              <CheckCircle className="h-3 w-3 mr-1" />
              {isBn ? "সংযুক্ত" : "Connected"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground ml-auto">
              {isBn ? "সংযুক্ত নয়" : "Not Connected"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {isBn
            ? `📦 "${campaignName}" ক্যাম্পেইনের জন্য আলাদা SteadFast অ্যাকাউন্ট কানেক্ট করুন। এই অ্যাকাউন্ট দিয়েই ওয়্যারহাউস থেকে ডিসপ্যাচ এবং ট্র্যাকিং হবে।`
            : `📦 Connect a separate SteadFast account for "${campaignName}" campaign. Dispatches and tracking will use this account.`}
        </p>

        <div className="space-y-2">
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">
              {isBn ? "SteadFast API Key" : "SteadFast API Key"}
            </label>
            <Input
              type={showKeys ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Api-Key..."
              disabled={connected && !showKeys}
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">
              {isBn ? "SteadFast Secret Key" : "SteadFast Secret Key"}
            </label>
            <div className="flex gap-2">
              <Input
                type={showKeys ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Secret-Key..."
                className="flex-1"
                disabled={connected && !showKeys}
              />
              <Button variant="outline" size="icon" onClick={() => setShowKeys(!showKeys)}>
                {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {testResult && (
          <div className={`flex items-start gap-2 text-sm p-2.5 rounded-lg ${
            testResult.success ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          }`}>
            {testResult.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span className="text-xs">{testResult.message}</span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {!connected ? (
            <>
              <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={testing || !apiKey.trim() || !secretKey.trim()}>
                {testing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Truck className="h-3.5 w-3.5 mr-1" />}
                {isBn ? "টেস্ট করুন" : "Test Connection"}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !apiKey.trim() || !secretKey.trim() || !testResult?.success}
                className="bg-primary text-primary-foreground">
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                {isBn ? "সংযোগ সেভ করুন" : "Save Connection"}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={testing}>
                {testing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Truck className="h-3.5 w-3.5 mr-1" />}
                {isBn ? "রিচেক করুন" : "Re-check"}
              </Button>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={handleDisconnect} disabled={saving}>
                <Unplug className="h-3.5 w-3.5 mr-1" />
                {isBn ? "বিচ্ছিন্ন করুন" : "Disconnect"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SteadfastConnector;
