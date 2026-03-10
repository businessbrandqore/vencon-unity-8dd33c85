import { useLanguage } from "@/contexts/LanguageContext";

const LanguageToggle = () => {
  const { lang, toggleLang } = useLanguage();

  return (
    <button
      onClick={toggleLang}
      className="fixed top-6 right-6 z-50 font-heading text-sm tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-200"
    >
      {lang === "bn" ? "EN" : "বাং"}
    </button>
  );
};

export default LanguageToggle;
