import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const BLUE = "#1D4ED8";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  panel: string;
  is_active: boolean;
  basic_salary: number | null;
  created_at: string;
}

const HREmployees = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBn = t("vencon") === "VENCON";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterPanel, setFilterPanel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      navigate("/hr/employees/new");
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, name, email, role, panel, is_active, basic_salary, created_at")
      .order("created_at", { ascending: false });
    setEmployees(data || []);
    setLoading(false);
  };

  const filtered = employees.filter((e) => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole !== "all" && e.role !== filterRole) return false;
    if (filterPanel !== "all" && e.panel !== filterPanel) return false;
    if (filterStatus === "active" && !e.is_active) return false;
    if (filterStatus === "inactive" && e.is_active) return false;
    return true;
  });

  const uniqueRoles = [...new Set(employees.map((e) => e.role))].sort();

  const handleDeactivate = async (emp: Employee) => {
    await supabase.from("users").update({ is_active: !emp.is_active }).eq("id", emp.id);
    fetchEmployees();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "কর্মচারী ম্যানেজমেন্ট" : "Employee Management"}
        </h2>
        <button
          onClick={() => navigate("/hr/employees/new")}
          className="px-4 py-2 text-sm font-body font-bold text-white"
          style={{ backgroundColor: BLUE }}
        >
          {isBn ? "➕ নতুন Employee Hire" : "➕ Hire Employee"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={isBn ? "নাম বা ইমেইল খুঁজুন..." : "Search name or email..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-background border-border text-foreground w-64"
        />
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-48 bg-background border-border text-foreground">
            <SelectValue placeholder={isBn ? "রোল" : "Role"} />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">{isBn ? "সব রোল" : "All Roles"}</SelectItem>
            {uniqueRoles.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPanel} onValueChange={setFilterPanel}>
          <SelectTrigger className="w-40 bg-background border-border text-foreground">
            <SelectValue placeholder="Panel" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">{isBn ? "সব প্যানেল" : "All Panels"}</SelectItem>
            <SelectItem value="sa">SA</SelectItem>
            <SelectItem value="hr">HR</SelectItem>
            <SelectItem value="tl">TL</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-background border-border text-foreground">
            <SelectValue placeholder="Status" />
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
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="bg-secondary text-muted-foreground text-[11px]">
                <th className="text-left p-3">{isBn ? "নাম" : "Full Name"}</th>
                <th className="text-left p-3">{isBn ? "রোল" : "Role"}</th>
                <th className="text-left p-3">{isBn ? "প্যানেল" : "Panel"}</th>
                <th className="text-center p-3">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                <th className="text-right p-3">{isBn ? "বেতন" : "Salary"}</th>
                <th className="text-left p-3">{isBn ? "যোগদান" : "Joined"}</th>
                <th className="text-right p-3">{isBn ? "অ্যাকশন" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-secondary/50">
                  <td className="p-3 text-foreground font-bold">{emp.name}</td>
                  <td className="p-3 text-foreground text-xs">{emp.role}</td>
                  <td className="p-3">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 uppercase" style={{ backgroundColor: BLUE, color: "#fff" }}>
                      {emp.panel}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${emp.is_active ? "bg-green-500" : "bg-red-500"}`} />
                  </td>
                  <td className="p-3 text-right text-foreground">
                    {emp.basic_salary ? `৳${emp.basic_salary.toLocaleString()}` : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {new Date(emp.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => navigate(`/hr/employees/${emp.id}`)}
                      className="text-xs px-2 py-1 border border-border text-foreground hover:bg-secondary"
                    >
                      {isBn ? "দেখুন" : "View"}
                    </button>
                    <button
                      onClick={() => handleDeactivate(emp)}
                      className={`text-xs px-2 py-1 border border-border hover:bg-secondary ${emp.is_active ? "text-destructive" : "text-green-500"}`}
                    >
                      {emp.is_active ? (isBn ? "নিষ্ক্রিয়" : "Deactivate") : (isBn ? "সক্রিয়" : "Activate")}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
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

export default HREmployees;
