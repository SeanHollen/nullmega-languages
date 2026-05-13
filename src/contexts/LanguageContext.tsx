import { createContext, useContext, useState, ReactNode } from "react";
import { getStoredLanguage, setStoredLanguage } from "../utils/language";

interface LanguageCtx {
  language: string;
  setLanguage: (lang: string) => void;
}

const Ctx = createContext<LanguageCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(getStoredLanguage);

  function setLanguage(lang: string) {
    setStoredLanguage(lang);
    setLanguageState(lang);
  }

  return <Ctx.Provider value={{ language, setLanguage }}>{children}</Ctx.Provider>;
}

export function useLanguage(): LanguageCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error(`useLanguage must be used within LanguageProvider`);
  return ctx;
}
