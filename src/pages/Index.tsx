import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { panels } from "@/lib/panelConfig";
import LanguageToggle from "@/components/LanguageToggle";
import { Shield, Users, Target, User } from "lucide-react";

const panelIcons: Record<string, React.ElementType> = {
  sa: Shield,
  hr: Users,
  tl: Target,
  employee: User,
};

const Index = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LanguageToggle />

      {/* Hero */}
      <div className="pt-24 pb-4 text-center">
        <h1 className="font-heading text-6xl font-bold tracking-[0.25em] text-foreground">
          VENCON
        </h1>
        <div className="mx-auto mt-3 w-12 h-1 rounded-full bg-primary" />
        <p className="mt-4 font-body text-sm text-muted-foreground tracking-wide">
          {t("tagline")}
        </p>
      </div>

      {/* Panel Cards */}
      <div className="flex-1 flex items-start justify-center px-4 pt-12 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-5xl">
          {panels.map((panel) => {
            const Icon = panelIcons[panel.type] || Shield;
            return (
              <button
                key={panel.type}
                onClick={() => navigate(panel.loginPath)}
                className="group bg-card border border-border rounded-xl p-7 text-left transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1"
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: panel.color }}
                >
                  <Icon className="h-5 w-5 text-background" />
                </div>

                <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
                  {t(panel.nameKey)}
                </h2>

                <p className="font-body text-sm text-muted-foreground mb-6 leading-relaxed min-h-[40px]">
                  {t(panel.descKey)}
                </p>

                <span
                  className="font-heading text-sm tracking-wide transition-colors duration-300 group-hover:underline"
                  style={{ color: panel.color }}
                >
                  {t("login")} →
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4">
        <p className="font-body text-xs text-muted-foreground">© 2026 Vencon</p>
      </div>
    </div>
  );
};

export default Index;
