import React, { createContext, useContext, useState, ReactNode } from "react";

type Language = "bn" | "en";

interface Translations {
  [key: string]: { bn: string; en: string };
}

const translations: Translations = {
  vencon: { bn: "VENCON", en: "VENCON" },
  tagline: { bn: "কোম্পানি অপারেশন ম্যানেজমেন্ট সিস্টেম", en: "Company Operations Management System" },
  login: { bn: "Login করুন", en: "Login" },
  email: { bn: "ইমেইল", en: "Email" },
  password: { bn: "পাসওয়ার্ড", en: "Password" },
  sa_panel: { bn: "সুপার অ্যাডমিন প্যানেল", en: "Super Admin Panel" },
  hr_panel: { bn: "এইচআর প্যানেল", en: "HR Panel" },
  tl_panel: { bn: "টিম লিডার প্যানেল", en: "Team Leader Panel" },
  employee_panel: { bn: "এমপ্লয়ী প্যানেল", en: "Employee Panel" },
  sa_desc: { bn: "ম্যানেজিং ডিরেক্টর, অপারেশন ম্যানেজার, ওয়্যারহাউস ডিরেক্টর", en: "MD, Operations Manager, Warehouse Director" },
  hr_desc: { bn: "এইচআর ম্যানেজার", en: "HR Manager" },
  tl_desc: { bn: "টিম লিডার, সহকারী টিএল, বিজনেস ডেভ ম্যানেজার", en: "Team Leader, Assistant TL, Business Dev Manager" },
  employee_desc: { bn: "টেলিসেলস, ওয়্যারহাউস, কাস্টমার সার্ভিস ইত্যাদি", en: "Telesales, Warehouse, CS, etc." },
  locked_msg: { bn: "অনেক বেশি ভুল চেষ্টা। অনুগ্রহ করে অপেক্ষা করুন:", en: "Too many failed attempts. Please wait:" },
  invalid_creds: { bn: "ইমেইল বা পাসওয়ার্ড ভুল", en: "Invalid email or password" },
  dashboard: { bn: "ড্যাশবোর্ড", en: "Dashboard" },
  welcome: { bn: "স্বাগতম", en: "Welcome" },
  logout: { bn: "লগআউট", en: "Logout" },
  select_panel: { bn: "আপনার প্যানেল নির্বাচন করুন", en: "Select Your Panel" },
};

interface LanguageContextType {
  lang: Language;
  toggleLang: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>("bn");

  const toggleLang = () => setLang((prev) => (prev === "bn" ? "en" : "bn"));

  const t = (key: string) => {
    return translations[key]?.[lang] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
