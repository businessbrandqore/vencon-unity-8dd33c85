import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Search } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  actor_id: string | null;
  actor_role: string | null;
  target_table: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
  ip_address: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  login: "text-green-400 border-green-600/50",
  logout: "text-muted-foreground border-border",
  create: "text-blue-400 border-blue-500/50",
  update: "text-yellow-400 border-yellow-500/50",
  delete: "text-destructive border-destructive/50",
  approve: "text-green-400 border-green-600/50",
  reject: "text-orange-400 border-orange-500/50",
};

export default function SAAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (data) {
        setLogs(data as AuditLog[]);
        const actorIds = [...new Set(data.map((l) => l.actor_id).filter(Boolean))] as string[];
        if (actorIds.length > 0) {
          const { data: users } = await supabase.from("users").select("id, name").in("id", actorIds);
          if (users) {
            const map: Record<string, string> = {};
            users.forEach((u) => { map[u.id] = u.name; });
            setActors(map);
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  const tables = [...new Set(logs.map((l) => l.target_table).filter(Boolean))] as string[];

  const filtered = logs.filter((l) => {
    if (tableFilter !== "all" && l.target_table !== tableFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const actorName = l.actor_id ? actors[l.actor_id] || "" : "";
      return (
        l.action.toLowerCase().includes(s) ||
        actorName.toLowerCase().includes(s) ||
        (l.target_table || "").toLowerCase().includes(s) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(s)
      );
    }
    return true;
  });

  if (loading) return <LoadingSpinner text="লোড হচ্ছে..." />;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-primary" /> Audit Logs
      </h1>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
        </div>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সকল Table</SelectItem>
            {tables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading">সর্বশেষ {filtered.length} টি লগ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-2 text-left">সময়</th>
                  <th className="py-2 px-2 text-left">Action</th>
                  <th className="py-2 px-2 text-left">ব্যবহারকারী</th>
                  <th className="py-2 px-2 text-left">Role</th>
                  <th className="py-2 px-2 text-left">Table</th>
                  <th className="py-2 px-2 text-left">বিস্তারিত</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id} className="border-b border-border">
                    <td className="py-2 px-2 text-xs whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString("bn-BD") : "—"}
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className={ACTION_COLORS[log.action] || ""}>{log.action}</Badge>
                    </td>
                    <td className="py-2 px-2">{log.actor_id ? (actors[log.actor_id] || log.actor_id.slice(0, 8)) : "System"}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{log.actor_role || "—"}</td>
                    <td className="py-2 px-2"><Badge variant="secondary" className="text-xs">{log.target_table || "—"}</Badge></td>
                    <td className="py-2 px-2 text-xs max-w-[300px] truncate text-muted-foreground">
                      {log.details ? JSON.stringify(log.details).slice(0, 100) : "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">কোনো audit log নেই</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
