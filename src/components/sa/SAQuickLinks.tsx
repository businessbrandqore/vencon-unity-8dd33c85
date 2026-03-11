import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Package, Wallet, BarChart3, ScrollText, Settings, CreditCard, Users, Shield } from "lucide-react";

const SAQuickLinks = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const links = [
    { icon: Package, label: isBn ? "ওয়্যারহাউস ও স্টক" : "Warehouse & Stock", path: "/sa/warehouse", color: "#0D9488" },
    { icon: Wallet, label: isBn ? "বাজেট ম্যানেজমেন্ট" : "Budget Management", path: "/sa/budget", color: "#1D4ED8" },
    { icon: BarChart3, label: isBn ? "কোম্পানি অ্যানালিটিক্স" : "Company Analytics", path: "/sa/analytics", color: "#7C3AED" },
    { icon: CreditCard, label: isBn ? "পেরোল" : "Payroll", path: "/sa/payroll", color: "#EA580C" },
    { icon: ScrollText, label: isBn ? "অডিট লগ" : "Audit Logs", path: "/sa/audit-logs", color: "#F59E0B" },
    { icon: Settings, label: isBn ? "সিস্টেম সেটিংস" : "System Settings", path: "/sa/settings", color: "#6B7280" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="font-heading text-sm font-bold text-foreground mb-4">
        {isBn ? "দ্রুত লিংক" : "Quick Links"}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="flex flex-col items-center gap-2.5 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors group"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${link.color}20` }}
              >
                <Icon className="h-4 w-4" style={{ color: link.color }} />
              </div>
              <span className="font-body text-[10px] text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">
                {link.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SAQuickLinks;
