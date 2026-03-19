import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users, Eye } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  panel: string;
  is_active: boolean;
  phone: string | null;
  department: string | null;
  designation: string | null;
  basic_salary: number | null;
  created_at: string;
}

const SAEmployees = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isBn = t("vencon") === "VENCON";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterPanel, setFilterPanel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("users")
        .select("id, name, email, role, panel, is_active, phone, department, designation, basic_salary, created_at")
        .order("created_at", { ascending: false });
      setEmployees(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = employees.filter((e) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.email.toLowerCase().includes(search.toLowerCase()) && !(e.phone || "").includes(search)) return false;
    if (filterRole !== "all" && e.role !== filterRole) return false;
    if (filterPanel !== "all" && e.panel !== filterPanel) return false;
    if (filterStatus === "active" && !e.is_active) return false;
    if (filterStatus === "inactive" && e.is_active) return false;
    return true;
  });

  const uniqueRoles = [...new Set(employees.map((e) => e.role))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {isBn ? "সকল কর্মচারী" : "All Employees"}
          </h2>
          <p className="font-body text-sm text-muted-foreground">
            {isBn ? `মোট ${filtered.length} জন` : `${filtered.length} total`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isBn ? "নাম, ইমেইল বা ফোন..." : "Name, email or phone..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-background border-border"
          />
        </div>
        <Select value={filterPanel} onValueChange={setFilterPanel}>
          <SelectTrigger className="w-32 bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">{isBn ? "সব প্যানেল" : "All Panels"}</SelectItem>
            <SelectItem value="sa">SA</SelectItem>
            <SelectItem value="hr">HR</SelectItem>
            <SelectItem value="tl">TL</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-48 bg-background border-border">
            <SelectValue placeholder={isBn ? "সব রোল" : "All Roles"} />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border max-h-60">
            <SelectItem value="all">{isBn ? "সব রোল" : "All Roles"}</SelectItem>
            {uniqueRoles.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">{isBn ? "সব" : "All"}</SelectItem>
            <SelectItem value="active">{isBn ? "সক্রিয়" : "Active"}</SelectItem>
            <SelectItem value="inactive">{isBn ? "নিষ্ক্রিয়" : "Inactive"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">{isBn ? "লোড হচ্ছে..." : "Loading..."}</div>
      ) : (
        <div className="border border-border overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">{isBn ? "নাম" : "Name"}</th>
                <th className="text-left p-3 font-medium text-muted-foreground">{isBn ? "রোল" : "Role"}</th>
                <th className="text-left p-3 font-medium text-muted-foreground">{isBn ? "প্যানেল" : "Panel"}</th>
                <th className="text-left p-3 font-medium text-muted-foreground">{isBn ? "ফোন" : "Phone"}</th>
                <th className="text-left p-3 font-medium text-muted-foreground">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                <th className="text-left p-3 font-medium text-muted-foreground">{isBn ? "বেতন" : "Salary"}</th>
                <th className="text-center p-3 font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr
                  key={emp.id}
                  className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/sa/employees/${emp.id}`)}
                >
                  <td className="p-3">
                    <div className="font-bold text-foreground">{emp.name}</div>
                    <div className="text-xs text-muted-foreground">{emp.email}</div>
                  </td>
                  <td className="p-3 text-foreground">{emp.role}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-primary/10 text-primary">
                      {emp.panel}
                    </span>
                  </td>
                  <td className="p-3 text-foreground">{emp.phone || "—"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-[10px] font-bold text-white ${emp.is_active ? "bg-green-600" : "bg-red-600"}`}>
                      {emp.is_active ? (isBn ? "সক্রিয়" : "Active") : (isBn ? "নিষ্ক্রিয়" : "Inactive")}
                    </span>
                  </td>
                  <td className="p-3 text-foreground font-mono">৳{(emp.basic_salary || 0).toLocaleString()}</td>
                  <td className="p-3 text-center">
                    <Eye className="h-4 w-4 text-muted-foreground inline-block" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    {isBn ? "কোনো কর্মচারী পাওয়া যায়নি" : "No employees found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SAEmployees;
