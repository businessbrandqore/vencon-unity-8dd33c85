import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { panels } from "@/lib/panelConfig";
import LanguageToggle from "@/components/LanguageToggle";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LanguageToggle />

      {/* Header */}
      <div className="pt-16 pb-8 text-center">
        <h1 className="font-heading text-5xl font-bold tracking-[0.2em] text-foreground">
          {t("vencon")}
        </h1>
        <p className="mt-3 font-body text-sm text-muted-foreground tracking-wide">
          {t("tagline")}
        </p>
      </div>

      {/* Panel Grid */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[2px] w-full max-w-4xl">
          {panels.map((panel) => (
            <button
              key={panel.type}
              onClick={() => navigate(panel.loginPath)}
              className="group relative bg-card p-12 md:p-16 text-left transition-colors duration-300 hover:bg-secondary focus:outline-none"
            >
              {/* Accent bar */}
              <div
                className="absolute top-0 left-0 w-full h-[2px] transition-opacity duration-300 opacity-40 group-hover:opacity-100"
                style={{ backgroundColor: panel.color }}
              />

              <h2
                className="font-heading text-xl font-semibold tracking-wide mb-4"
                style={{ color: panel.color }}
              >
                {t(panel.nameKey)}
              </h2>

              <p className="font-body text-sm text-muted-foreground mb-8 leading-relaxed">
                {t(panel.descKey)}
              </p>

              <span
                className="font-heading text-xs tracking-[0.15em] uppercase transition-colors duration-300"
                style={{ color: panel.color }}
              >
                {t("login")} →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
