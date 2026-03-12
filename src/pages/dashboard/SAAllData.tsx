import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, Database, Users, Target, ShoppingCart, Package } from "lucide-react";

type TabKey = "leads" | "orders" | "employees" | "inventory";

const SAAllData = () => {
  const { t, d } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const [tab, setTab] = useState<TabKey>("leads");
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [dataModeFilter, setDataModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({ leads: 0, orders: 0, employees: 0, inventory: 0 });

  useEffect(() => {
    const loadCampaigns = async () => {
      const { data } = await supabase.from("campaigns").select("id, name").order("name");
      setCampaigns(data || []);
    };
    loadCampaigns();
  }, []);

  useEffect(() => {
    loadData();
  }, [tab, campaignFilter, dataModeFilter, statusFilter]);

  const loadData = async () => {
    setLoading(true);

    // Always load counts
    const [lc, oc, ec, ic] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("inventory").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      leads: lc.count || 0,
      orders: oc.count || 0,
      employees: ec.count || 0,
      inventory: ic.count || 0,
    });

    if (tab === "leads") {
      let q = supabase.from("leads").select("id, name, phone, status, agent_type, campaign_id, created_at, source").order("created_at", { ascending: false }).limit(200);
      if (campaignFilter !== "all") q = q.eq("campaign_id", campaignFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data } = await q;
      setLeads(data || []);
    } else if (tab === "orders") {
      let q = supabase.from("orders").select("id, customer_name, phone, product, price, quantity, status, delivery_status, created_at").order("created_at", { ascending: false }).limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data } = await q;
      setOrders(data || []);
    } else if (tab === "employees") {
      const { data } = await supabase.from("users").select("id, name, email, phone, role, panel, department, is_active, created_at").order("name").limit(500);
      setEmployees(data || []);
    } else if (tab === "inventory") {
      const { data } = await supabase.from("inventory").select("*").order("product_name");
      setInventory(data || []);
    }

    setLoading(false);
  };

  const filtered = (items: any[]) => {
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter((item) =>
      Object.values(item).some((v) => typeof v === "string" && v.toLowerCase().includes(s))
    );
  };

  const statusBadge = (status: string | null) => {
    const colors: Record<string, string> = {
      fresh: "bg-blue-500/10 text-blue-400",
      called: "bg-yellow-500/10 text-yellow-400",
      order_confirmed: "bg-emerald-500/10 text-emerald-400",
      pending_cso: "bg-orange-500/10 text-orange-400",
      send_today: "bg-cyan-500/10 text-cyan-400",
      dispatched: "bg-purple-500/10 text-purple-400",
      delivered: "bg-emerald-500/10 text-emerald-400",
      returned: "bg-red-500/10 text-red-400",
      cancelled: "bg-red-500/10 text-red-400",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-heading ${colors[status || ""] || "bg-muted text-muted-foreground"}`}>
        {status || "—"}
      </span>
    );
  };

  const tabItems = [
    { key: "leads" as const, label: isBn ? "লিড" : "Leads", icon: Target, count: stats.leads },
    { key: "orders" as const, label: isBn ? "অর্ডার" : "Orders", icon: ShoppingCart, count: stats.orders },
    { key: "employees" as const, label: isBn ? "কর্মচারী" : "Employees", icon: Users, count: stats.employees },
    { key: "inventory" as const, label: isBn ? "ইনভেন্টরি" : "Inventory", icon: Package, count: stats.inventory },
  ];

  const leadStatuses = ["all", "fresh", "called", "not_interested", "order_confirmed", "callback", "busy", "no_answer", "switched_off"];
  const orderStatuses = ["all", "pending_cso", "send_today", "dispatched", "call_done", "rejected"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "সকল ডাটা" : "All Data"}
        </h2>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tabItems.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(""); setStatusFilter("all"); }}
              className={`bg-card border rounded-xl p-4 text-left transition-colors ${
                tab === t.key ? "border-primary" : "border-border hover:border-primary/30"
              }`}
            >
              <Icon className="h-4 w-4 text-primary mb-2" />
              <p className="font-heading text-lg font-bold text-foreground">{t.count.toLocaleString()}</p>
              <p className="font-body text-xs text-muted-foreground">{t.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isBn ? "সার্চ করুন..." : "Search..."}
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {tab === "leads" && (
          <>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-xs font-body text-foreground focus:outline-none"
            >
              <option value="all">{isBn ? "সব ক্যাম্পেইন" : "All Campaigns"}</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-xs font-body text-foreground focus:outline-none"
            >
              {leadStatuses.map((s) => (
                <option key={s} value={s}>{s === "all" ? (isBn ? "সব স্ট্যাটাস" : "All Status") : s}</option>
              ))}
            </select>
          </>
        )}

        {tab === "orders" && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-xs font-body text-foreground focus:outline-none"
          >
            {orderStatuses.map((s) => (
              <option key={s} value={s}>{s === "all" ? (isBn ? "সব স্ট্যাটাস" : "All Status") : s}</option>
            ))}
          </select>
        )}

        <button onClick={loadData} className="px-3 py-2 text-xs font-heading bg-primary text-primary-foreground rounded-lg">
          {isBn ? "রিফ্রেশ" : "Refresh"}
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="h-48 animate-pulse" />
        ) : (
          <div className="overflow-x-auto">
            {/* Leads Table */}
            {tab === "leads" && (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "নাম" : "Name"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "ফোন" : "Phone"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "ধরন" : "Type"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "সোর্স" : "Source"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "তারিখ" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered(leads).length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">{isBn ? "কোনো ডাটা নেই" : "No data"}</td></tr>
                  ) : filtered(leads).map((l) => (
                    <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-2.5 font-body text-xs text-foreground">{l.name || "—"}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{l.phone || "—"}</td>
                      <td className="px-4 py-2.5">{statusBadge(l.status)}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{l.agent_type || "—"}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{l.source || "—"}</td>
                      <td className="px-4 py-2.5 font-body text-[10px] text-muted-foreground">{l.created_at ? d(new Date(l.created_at)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Orders Table */}
            {tab === "orders" && (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "গ্রাহক" : "Customer"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "ফোন" : "Phone"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "পণ্য" : "Product"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "মূল্য" : "Price"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "ডেলিভারি" : "Delivery"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "তারিখ" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered(orders).length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-sm text-muted-foreground">{isBn ? "কোনো ডাটা নেই" : "No data"}</td></tr>
                  ) : filtered(orders).map((o) => (
                    <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-2.5 font-body text-xs text-foreground">{o.customer_name || "—"}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{o.phone || "—"}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{o.product || "—"}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-foreground">৳{o.price?.toLocaleString() || "0"}</td>
                      <td className="px-4 py-2.5">{statusBadge(o.status)}</td>
                      <td className="px-4 py-2.5">{statusBadge(o.delivery_status)}</td>
                      <td className="px-4 py-2.5 font-body text-[10px] text-muted-foreground">{o.created_at ? d(new Date(o.created_at)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Employees Table */}
            {tab === "employees" && (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "নাম" : "Name"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "ইমেইল" : "Email"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "ফোন" : "Phone"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "রোল" : "Role"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "প্যানেল" : "Panel"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered(employees).length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">{isBn ? "কোনো ডাটা নেই" : "No data"}</td></tr>
                  ) : filtered(employees).map((e) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-2.5 font-body text-xs text-foreground font-medium">{e.name}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{e.email}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{e.phone || "—"}</td>
                      <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{e.role}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-heading bg-primary/10 text-primary">{e.panel?.toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-heading ${e.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                          {e.is_active ? (isBn ? "সক্রিয়" : "Active") : (isBn ? "নিষ্ক্রিয়" : "Inactive")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Inventory Table */}
            {tab === "inventory" && (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "পণ্য" : "Product"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "স্টক ইন" : "Stock In"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "ডিসপ্যাচ" : "Dispatched"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "রিটার্ন" : "Returned"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "ক্ষতিগ্রস্ত" : "Damaged"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "বর্তমান স্টক" : "Current"}</th>
                    <th className="px-4 py-3 font-heading text-[10px] tracking-wider text-muted-foreground uppercase">{isBn ? "মূল্য" : "Unit Price"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered(inventory).length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-sm text-muted-foreground">{isBn ? "কোনো ডাটা নেই" : "No data"}</td></tr>
                  ) : filtered(inventory).map((i) => {
                    const current = (i.stock_in || 0) - (i.dispatched || 0) - (i.damaged || 0) + (i.returned || 0);
                    const isLow = current <= (i.low_stock_threshold || 10);
                    return (
                      <tr key={i.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-2.5 font-body text-xs text-foreground font-medium">{i.product_name}</td>
                        <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{i.stock_in || 0}</td>
                        <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{i.dispatched || 0}</td>
                        <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{i.returned || 0}</td>
                        <td className="px-4 py-2.5 font-body text-xs text-muted-foreground">{i.damaged || 0}</td>
                        <td className={`px-4 py-2.5 font-body text-xs font-bold ${isLow ? "text-red-400" : "text-emerald-400"}`}>{current}</td>
                        <td className="px-4 py-2.5 font-body text-xs text-foreground">৳{i.unit_price?.toLocaleString() || "0"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SAAllData;
