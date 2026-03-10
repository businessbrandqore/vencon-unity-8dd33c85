import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { translations, Language, toBengaliNum, formatDateBn, formatNumLocale, getRoleName, getStatusName } from "@/i18n/translations";
import { supabase } from "@/integrations/supabase/client";

interface LanguageContextType {
  lang: Language;
  toggleLang: () => void;
  t: (key: string) => string;
  n: (num: number) => string;
  d: (date: Date) => string;
  roleName: (roleKey: string) => string;
  statusName: (statusKey: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem("vencon_lang");
    return (saved === "en" || saved === "bn") ? saved : "bn";
  });

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem("vencon_lang", lang);
  }, [lang]);

  // Persist to DB when user is logged in (fire-and-forget)
  const persistLangToDb = useCallback(async (newLang: Language) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Get user id from users table
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", session.user.id)
        .single();
      if (userData) {
        await supabase
          .from("users")
          .update({ preferred_language: newLang } as any)
          .eq("id", userData.id);
      }
    }
  }, []);

  // Load preference from DB on mount (when session exists)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from("users")
          .select("preferred_language")
          .eq("auth_id", session.user.id)
          .single();
        if (data && (data as any).preferred_language) {
          const dbLang = (data as any).preferred_language as Language;
          if (dbLang === "bn" || dbLang === "en") {
            setLang(dbLang);
            localStorage.setItem("vencon_lang", dbLang);
          }
        }
      }
    })();
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "bn" ? "en" : "bn";
      persistLangToDb(next);
      return next;
    });
  }, [persistLangToDb]);

  const t = useCallback((key: string) => {
    return translations[key]?.[lang] || key;
  }, [lang]);

  const n = useCallback((num: number) => {
    return formatNumLocale(num, lang);
  }, [lang]);

  const d = useCallback((date: Date) => {
    if (lang === "bn") return formatDateBn(date);
    return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  }, [lang]);

  const roleName = useCallback((roleKey: string) => {
    return getRoleName(roleKey, lang);
  }, [lang]);

  const statusName = useCallback((statusKey: string) => {
    return getStatusName(statusKey, lang);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t, n, d, roleName, statusName }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
