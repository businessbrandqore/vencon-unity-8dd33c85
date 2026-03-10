import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, ArrowRight, CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Step = "upload" | "map" | "campaign" | "preview" | "duplicate" | "importing" | "done";

const SYSTEM_FIELDS = [
  { key: "customer_name", label: "Customer Name", required: true },
  { key: "phone", label: "Phone", required: true },
  { key: "address", label: "Address", required: false },
  { key: "city", label: "City", required: false },
  { key: "extra_notes", label: "Extra Notes", required: false },
] as const;

const HRLeadImport = () => {
  const [step, setStep] = useState<Step>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [campaignId, setCampaignId] = useState("");
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [importableRows, setImportableRows] = useState<Record<string, string>[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: campaigns } = useQuery({
    queryKey: ["active-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("CSV file must have header + at least 1 row");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map((l) =>
        l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
      );
      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-map matching columns
      const autoMap: Record<string, string> = {};
      for (const f of SYSTEM_FIELDS) {
        const match = headers.find(
          (h) =>
            h.toLowerCase().includes(f.key.replace("_", " ")) ||
            h.toLowerCase().includes(f.key) ||
            h.toLowerCase() === f.label.toLowerCase()
        );
        if (match) autoMap[f.key] = match;
      }
      // Try common aliases
      if (!autoMap.customer_name) {
        const nm = headers.find((h) => /name/i.test(h));
        if (nm) autoMap.customer_name = nm;
      }
      if (!autoMap.phone) {
        const ph = headers.find((h) => /phone|mobile|tel/i.test(h));
        if (ph) autoMap.phone = ph;
      }
      setMapping(autoMap);
      setStep("map");
    };
    reader.readAsText(file);
  }, []);

  const getMappedRows = useCallback(() => {
    return csvRows.map((row) => {
      const obj: Record<string, string> = {};
      for (const f of SYSTEM_FIELDS) {
        const csvCol = mapping[f.key];
        if (csvCol) {
          const idx = csvHeaders.indexOf(csvCol);
          if (idx >= 0) obj[f.key] = row[idx] || "";
        }
      }
      return obj;
    });
  }, [csvRows, csvHeaders, mapping]);

  const handleCheckDuplicates = async () => {
    if (!campaignId) {
      toast.error("Campaign select করুন");
      return;
    }
    setLoading(true);
    const mapped = getMappedRows().filter((r) => r.customer_name && r.phone);
    const phones = mapped.map((r) => r.phone);

    // Check duplicates in batches
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("leads")
      .select("phone")
      .eq("campaign_id", campaignId)
      .gte("created_at", thirtyDaysAgo)
      .in("phone", phones);

    const existingPhones = new Set((existing || []).map((e) => e.phone));
    const importable = mapped.filter((r) => !existingPhones.has(r.phone));
    const dupes = mapped.length - importable.length;

    setImportableRows(importable);
    setDuplicateCount(dupes);
    setStep("duplicate");
    setLoading(false);
  };

  const handleImport = async () => {
    setStep("importing");
    setLoading(true);

    let imported = 0;
    let skipped = 0;

    // Insert in batches of 50
    for (let i = 0; i < importableRows.length; i += 50) {
      const batch = importableRows.slice(i, i + 50).map((r) => ({
        name: r.customer_name,
        phone: r.phone,
        address: [r.address, r.city].filter(Boolean).join(", ") || null,
        campaign_id: campaignId,
        source: "csv_import",
        import_source: "csv",
        special_note: r.extra_notes || null,
        status: "fresh",
      }));

      const { error, data } = await supabase.from("leads").insert(batch).select("id");
      if (!error && data) {
        imported += data.length;
      } else {
        skipped += batch.length;
      }
    }

    // Log the import
    const { data: userData } = await supabase.auth.getUser();
    let userId: string | null = null;
    if (userData?.user) {
      const { data: u } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", userData.user.id)
        .single();
      userId = u?.id || null;
    }

    await supabase.from("lead_import_logs").insert({
      campaign_id: campaignId,
      source: "csv",
      leads_imported: imported,
      duplicates_skipped: duplicateCount + skipped,
      total_received: csvRows.length,
      status: imported > 0 ? "success" : "failed",
      imported_by: userId,
    });

    setImportResult({ imported, skipped: duplicateCount + skipped });
    setStep("done");
    setLoading(false);
    toast.success(`${imported} leads imported successfully!`);
  };

  const reset = () => {
    setStep("upload");
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setCampaignId("");
    setDuplicateCount(0);
    setImportableRows([]);
    setImportResult(null);
  };

  const mappedPreview = step === "preview" || step === "duplicate" ? getMappedRows().slice(0, 10) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CSV Lead Import</h1>
        <p className="text-muted-foreground">CSV ফাইল থেকে leads import করুন</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {["Upload", "Map Columns", "Campaign", "Preview", "Duplicates", "Import"].map((s, i) => {
          const stepMap: Step[] = ["upload", "map", "campaign", "preview", "duplicate", "done"];
          const active = stepMap.indexOf(step) >= i || step === "importing";
          return (
            <div key={s} className="flex items-center gap-1">
              <Badge variant={active ? "default" : "outline"} className="text-xs">
                {i + 1}. {s}
              </Badge>
              {i < 5 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 — CSV File Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer hover:border-primary transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <span className="text-sm font-medium">CSV ফাইল select করুন</span>
              <span className="text-xs text-muted-foreground mt-1">
                .csv format, first row = headers
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Columns */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 — Column Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              CSV columns কে system fields-এ map করুন
            </p>
            {SYSTEM_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-4">
                <span className="w-40 text-sm font-medium">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={mapping[f.key] || ""}
                  onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v }))}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder="Select CSV column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={() => {
                  if (!mapping.customer_name || !mapping.phone) {
                    toast.error("Customer Name ও Phone mapping required");
                    return;
                  }
                  setStep("campaign");
                }}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Campaign Selection */}
      {step === "campaign" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 — Campaign Select করুন</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Campaign select করুন" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button
                onClick={() => {
                  if (!campaignId) {
                    toast.error("Campaign select করুন");
                    return;
                  }
                  setStep("preview");
                }}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4 — Preview (First 10 rows)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {SYSTEM_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <TableHead key={f.key}>{f.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedPreview.map((row, i) => (
                    <TableRow key={i}>
                      {SYSTEM_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                        <TableCell key={f.key}>{row[f.key] || "—"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm text-muted-foreground">Total rows: {csvRows.length}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("campaign")}>
                Back
              </Button>
              <Button onClick={handleCheckDuplicates} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Check Duplicates
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Duplicate Report */}
      {step === "duplicate" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 5 — Duplicate Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-6">
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{importableRows.length}</p>
                <p className="text-sm text-muted-foreground">Leads will be imported</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{duplicateCount}</p>
                <p className="text-sm text-muted-foreground">Duplicates (will be skipped)</p>
              </div>
            </div>
            {duplicateCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                গত ৩০ দিনের মধ্যে same phone + campaign-এ existing leads duplicate হিসেবে skip হবে
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("preview")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importableRows.length === 0}>
                Import করুন ({importableRows.length} leads)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importing */}
      {step === "importing" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Importing leads...</p>
          </CardContent>
        </Card>
      )}

      {/* Done */}
      {step === "done" && importResult && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <p className="text-lg font-medium">Import Complete!</p>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-sm text-muted-foreground">Imported</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{importResult.skipped}</p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
            </div>
            <Button onClick={reset}>আরেকটি Import করুন</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HRLeadImport;
