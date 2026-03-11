import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BLUE = "#1D4ED8";

const ROLES = [
  "Telesales Executive",
  "Delivery Coordinator",
  "Office Assistant",
  "Creative And Human Resource Manager",
  "Business Development And Marketing Manager",
  "Inventory Manager",
  "Customer Support Executive",
  "Customer Security Officer",
  "Warehouse Supervisor",
  "Warehouse Assistant",
  "Team Leader",
  "Group Leader",
  "Assistant Team Leader",
  "Maintenance Officer",
];

const DAYS = [
  { value: "sat", label: "Sat", bn: "শনি" },
  { value: "sun", label: "Sun", bn: "রবি" },
  { value: "mon", label: "Mon", bn: "সোম" },
  { value: "tue", label: "Tue", bn: "মঙ্গল" },
  { value: "wed", label: "Wed", bn: "বুধ" },
  { value: "thu", label: "Thu", bn: "বৃহঃ" },
  { value: "fri", label: "Fri", bn: "শুক্র" },
];

const GUARDIAN_TYPES = [
  { value: "father", bn: "পিতা", en: "Father" },
  { value: "mother", bn: "মাতা", en: "Mother" },
  { value: "husband", bn: "স্বামী", en: "Husband" },
  { value: "other", bn: "অন্যান্য", en: "Other" },
];

/** Map role to panel */
const getRolePanel = (role: string): "sa" | "hr" | "tl" | "employee" => {
  if (role === "Team Leader" || role === "Group Leader" || role === "Assistant Team Leader") return "tl";
  return "employee";
};

const HREmployeeNew = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isBn = t("vencon") === "VENCON";

  const [form, setForm] = useState({
    name: "",
    fatherName: "",
    fatherPhone: "",
    motherName: "",
    motherPhone: "",
    guardianType: "",
    email: "",
    password: "",
    role: "",
    basicSalary: "",
    offDays: [] as string[],
    checkIn: "09:00",
    checkOut: "18:00",
    gpsLatitude: "",
    gpsLongitude: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (key: string, value: string | string[]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: string) =>
    setForm((prev) => ({
      ...prev,
      offDays: prev.offDays.includes(day)
        ? prev.offDays.filter((d) => d !== day)
        : [...prev.offDays, day],
    }));

  const validate = () => {
    if (!form.name.trim()) return isBn ? "নাম আবশ্যক" : "Name required";
    if (!form.fatherName.trim()) return isBn ? "পিতার নাম আবশ্যক" : "Father's name required";
    if (!form.fatherPhone.trim()) return isBn ? "পিতার ফোন আবশ্যক" : "Father's phone required";
    if (!form.motherName.trim()) return isBn ? "মাতার নাম আবশ্যক" : "Mother's name required";
    if (!form.motherPhone.trim()) return isBn ? "মাতার ফোন আবশ্যক" : "Mother's phone required";
    if (!form.guardianType) return isBn ? "অভিভাবক নির্বাচন আবশ্যক" : "Guardian selection required";
    if (!form.email.trim()) return isBn ? "ইমেইল আবশ্যক" : "Email required";
    if (!form.password || form.password.length < 6) return isBn ? "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর" : "Password min 6 chars";
    if (!form.role) return isBn ? "রোল নির্বাচন আবশ্যক" : "Role required";
    if (!form.basicSalary) return isBn ? "বেতন আবশ্যক" : "Salary required";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    if (!user) return;
    setSubmitting(true);

    const panel = getRolePanel(form.role);
    const isAgent = form.role === "Telesales Executive";

    // Insert user record
    const { data: newUser, error: insertErr } = await supabase
      .from("users")
      .insert({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        panel,
        basic_salary: Number(form.basicSalary),
        shift_start: form.clockIn,
        shift_end: form.clockOut,
        is_active: isAgent,
        father_name: form.fatherName.trim(),
        father_phone: form.fatherPhone.trim(),
        mother_name: form.motherName.trim(),
        mother_phone: form.motherPhone.trim(),
        guardian_type: form.guardianType,
        off_days: form.offDays,
        gps_location: form.gpsLocation.trim() || null,
        must_change_password: true,
      } as any)
      .select("id")
      .single();

    if (insertErr || !newUser) {
      toast({ title: insertErr?.message || "Error", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    if (isAgent) {
      // Create auth account immediately
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-auth-user", {
        body: {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          user_id: newUser.id,
        },
      });

      if (res.error) {
        toast({ title: res.error.message || "Auth creation failed", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      toast({
        title: isBn ? "Agent সফলভাবে hire করা হয়েছে ✓" : "Agent hired successfully ✓",
      });
    } else {
      // SA approval flow
      await supabase.from("sa_approvals").insert({
        type: "non_agent_hire",
        requested_by: user.id,
        status: "pending",
        details: {
          user_id: newUser.id,
          name: form.name.trim(),
          role: form.role,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          basic_salary: Number(form.basicSalary),
          panel,
        },
      });

      // Notify SA
      const { data: saUsers } = await supabase
        .from("users")
        .select("id")
        .eq("panel", "sa")
        .eq("is_active", true);

      if (saUsers) {
        await supabase.from("notifications").insert(
          saUsers.map((sa) => ({
            user_id: sa.id,
            title: isBn
              ? `নতুন hire approval দরকার: ${form.name.trim()} — ${form.role}`
              : `New hire needs approval: ${form.name.trim()} — ${form.role}`,
            type: "approval",
          }))
        );
      }

      toast({
        title: isBn
          ? "SA approval-এর জন্য submit হয়েছে। SA approve করলে account active হবে।"
          : "Submitted for SA approval. Account will be activated after SA approves.",
      });
    }

    setSubmitting(false);
    navigate("/hr/employees");
  };

  const fieldClass = "bg-background border-border text-foreground";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">
          {isBn ? "নতুন Employee Hire করুন" : "Hire New Employee"}
        </h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {isBn ? "সকল তথ্য সঠিকভাবে পূরণ করুন" : "Fill all fields correctly"}
        </p>
      </div>

      <div className="space-y-4">
        {/* Personal Info */}
        <div className="border border-border p-4 space-y-3">
          <h3 className="font-heading text-sm font-bold text-foreground">
            {isBn ? "ব্যক্তিগত তথ্য" : "Personal Information"}
          </h3>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "পুরো নাম *" : "Full Name *"}
            </label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldClass} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "পিতার নাম *" : "Father's Name *"}
              </label>
              <Input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "পিতার ফোন *" : "Father's Phone *"}
              </label>
              <Input value={form.fatherPhone} onChange={(e) => set("fatherPhone", e.target.value)} className={fieldClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "মাতার নাম *" : "Mother's Name *"}
              </label>
              <Input value={form.motherName} onChange={(e) => set("motherName", e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "মাতার ফোন *" : "Mother's Phone *"}
              </label>
              <Input value={form.motherPhone} onChange={(e) => set("motherPhone", e.target.value)} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "অভিভাবক *" : "Guardian *"}
            </label>
            <Select value={form.guardianType} onValueChange={(v) => set("guardianType", v)}>
              <SelectTrigger className={`${fieldClass} w-full`}>
                <SelectValue placeholder={isBn ? "অভিভাবক নির্বাচন করুন" : "Select guardian"} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {GUARDIAN_TYPES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {isBn ? g.bn : g.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Account Info */}
        <div className="border border-border p-4 space-y-3">
          <h3 className="font-heading text-sm font-bold text-foreground">
            {isBn ? "অ্যাকাউন্ট তথ্য" : "Account Information"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "ইমেইল (লগইন) *" : "Email (login) *"}
              </label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "অস্থায়ী পাসওয়ার্ড *" : "Temporary Password *"}
              </label>
              <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "রোল *" : "Role *"}
            </label>
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger className={`${fieldClass} w-full`}>
                <SelectValue placeholder={isBn ? "রোল নির্বাচন করুন" : "Select role"} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-60">
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.role === "Telesales Executive" && (
              <p className="text-xs mt-1" style={{ color: "#22C55E" }}>
                {isBn ? "✓ Agent — সরাসরি hire হবে, SA approval লাগবে না" : "✓ Agent — Direct hire, no SA approval needed"}
              </p>
            )}
            {form.role && form.role !== "Telesales Executive" && (
              <p className="text-xs mt-1" style={{ color: "#F59E0B" }}>
                {isBn ? "⚠ SA approval প্রয়োজন হবে" : "⚠ SA approval will be required"}
              </p>
            )}
          </div>
        </div>

        {/* Work Details */}
        <div className="border border-border p-4 space-y-3">
          <h3 className="font-heading text-sm font-bold text-foreground">
            {isBn ? "কাজের বিবরণ" : "Work Details"}
          </h3>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "মাসিক বেতন (BDT) *" : "Monthly Salary (BDT) *"}
            </label>
            <Input
              type="number"
              value={form.basicSalary}
              onChange={(e) => set("basicSalary", e.target.value)}
              className={fieldClass}
              placeholder="e.g. 15000"
            />
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-2">
              {isBn ? "সাপ্তাহিক ছুটির দিন" : "Off Days"}
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`px-3 py-1.5 text-xs font-body border transition-colors ${
                    form.offDays.includes(d.value)
                      ? "text-white border-transparent"
                      : "text-foreground border-border hover:bg-secondary"
                  }`}
                  style={form.offDays.includes(d.value) ? { backgroundColor: BLUE } : {}}
                >
                  {isBn ? d.bn : d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "ক্লক-ইন টাইম" : "Clock-In Time"}
              </label>
              <Input type="time" value={form.clockIn} onChange={(e) => set("clockIn", e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground block mb-1">
                {isBn ? "ক্লক-আউট টাইম" : "Clock-Out Time"}
              </label>
              <Input type="time" value={form.clockOut} onChange={(e) => set("clockOut", e.target.value)} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground block mb-1">
              {isBn ? "GPS উপস্থিতি লোকেশন" : "GPS Attendance Location"}
            </label>
            <Input
              value={form.gpsLocation}
              onChange={(e) => set("gpsLocation", e.target.value)}
              className={fieldClass}
              placeholder={isBn ? "শহর বা এলাকা" : "City or area"}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-body font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: BLUE }}
          >
            {submitting
              ? isBn ? "প্রসেসিং..." : "Processing..."
              : isBn ? "সাবমিট করুন" : "Submit"}
          </button>
          <button
            onClick={() => navigate("/hr/employees")}
            className="px-6 py-2.5 text-sm font-body border border-border text-foreground hover:bg-secondary"
          >
            {isBn ? "বাতিল" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HREmployeeNew;
