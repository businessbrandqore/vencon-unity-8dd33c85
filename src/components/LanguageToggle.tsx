import { useLanguage } from "@/contexts/LanguageContext";
import { Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

const LanguageToggle = () => {
  const { lang, toggleLang } = useLanguage();

  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("vencon_theme");
    if (saved) return saved === "dark";
    return true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("vencon_theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
      <button
        onClick={() => setDark((p) => !p)}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        title={dark ? "Light Mode" : "Dark Mode"}
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <button
        onClick={toggleLang}
        className="font-heading text-sm tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-200"
      >
        {lang === "bn" ? "EN" : "বাং"}
      </button>
    </div>
  );
};

export default LanguageToggle;