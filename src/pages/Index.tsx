import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { panels } from "@/lib/panelConfig";
import LanguageToggle from "@/components/LanguageToggle";
import { Shield, Users, Target, User } from "lucide-react";

const panelIcons: Record<string, React.ElementType> = {
  sa: Shield,
  hr: Shield,
  tl: Users,
  employee: User,
};

const Index = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Show HR, TL, Employee on index (SA is hidden from public)
  const visiblePanels = panels.filter((p) => p.type !== "sa");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LanguageToggle />

      {/* Hero */}
      <div className="pt-24 pb-4 text-center">
        <h1 className="font-heading text-6xl font-bold tracking-[0.25em] text-foreground">
          VENCON
        </h1>
        <div className="mx-auto mt-3 w-12 h-1 rounded-full bg-[#EA580C]" />
        <p className="mt-4 font-body text-sm text-muted-foreground tracking-wide">
          Company Operations Management
        </p>
      </div>

      {/* Panel Cards */}
      <div className="flex-1 flex items-start justify-center px-4 pt-12 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
          {visiblePanels.map((panel) => {
            const Icon = panelIcons[panel.type] || Shield;
            return (
              <button
                key={panel.type}
                onClick={() => navigate(panel.loginPath)}
                className="group bg-card border border-border rounded-xl p-8 text-left transition-all duration-300 hover:border-[hsl(var(--border))]/60 hover:bg-secondary/30"
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

                <p className="font-body text-sm text-muted-foreground mb-6 leading-relaxed">
                  {t(panel.descKey)}
                </p>

                <span
                  className="font-heading text-sm tracking-wide transition-colors duration-300"
                  style={{ color: panel.color }}
                >
                  Sign In →
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
