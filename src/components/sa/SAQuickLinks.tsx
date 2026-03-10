import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Package, Wallet, BarChart3, ScrollText, Settings } from "lucide-react";

const TEAL = "#0D9488";

const SAQuickLinks = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const links = [
    { icon: Package, label: isBn ? "ওয়্যারহাউস ও স্টক" : "Warehouse & Stock", path: "/sa/warehouse" },
    { icon: Wallet, label: isBn ? "বাজেট ম্যানেজমেন্ট" : "Budget Management", path: "/sa/budget" },
    { icon: BarChart3, label: isBn ? "কোম্পানি অ্যানালিটিক্স" : "Company Analytics", path: "/sa/analytics" },
    { icon: ScrollText, label: isBn ? "অডিট লগ" : "Audit Logs", path: "/sa/audit-logs" },
    { icon: Settings, label: isBn ? "সিস্টেম সেটিংস" : "System Settings", path: "/sa/settings" },
  ];

  return (
    <div>
      <h4 className="font-heading text-xs tracking-wider text-muted-foreground uppercase mb-4">
        {isBn ? "দ্রুত লিংক" : "Quick Links"}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-[1px] bg-border">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="bg-background p-4 flex flex-col items-center gap-2 hover:bg-secondary/50 transition-colors group"
            >
              <Icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" style={{ color: TEAL }} />
              <span className="font-body text-[11px] text-muted-foreground group-hover:text-foreground transition-colors text-center">
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
