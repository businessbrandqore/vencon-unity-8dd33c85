import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, UserPlus, Settings, BarChart3 } from "lucide-react";

const BLUE = "#1D4ED8";

const HRQuickActions = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isBn = t("vencon") === "VENCON";

  const actions = [
    {
      icon: Plus,
      label: isBn ? "➕ নতুন Campaign তৈরি করুন" : "➕ Create New Campaign",
      path: "/hr/campaigns?new=true",
    },
    {
      icon: UserPlus,
      label: isBn ? "👤 নতুন Employee Hire করুন" : "👤 Hire New Employee",
      path: "/hr/employees?new=true",
    },
    {
      icon: Settings,
      label: isBn ? "⚙️ Incentive Configure করুন" : "⚙️ Configure Incentives",
      path: "/hr/payroll",
    },
    {
      icon: BarChart3,
      label: isBn ? "📊 Salary Summary দেখুন" : "📊 View Salary Summary",
      path: "/hr/payroll?tab=summary",
    },
  ];

  return (
    <div>
      <h3 className="font-heading text-sm font-bold text-foreground mb-3">
        {isBn ? "দ্রুত কাজ" : "Quick Actions"}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-border">
        {actions.map((action) => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className="bg-background p-5 text-left hover:bg-secondary transition-colors group"
          >
            <p className="font-body text-sm text-foreground group-hover:text-foreground">
              {action.label}
            </p>
            <div
              className="w-6 h-[2px] mt-3 transition-all group-hover:w-10"
              style={{ backgroundColor: BLUE }}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default HRQuickActions;
