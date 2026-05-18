import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getStoredLanguage, setStoredLanguage } from "../utils/language";

interface LanguageCtx {
  language: string;
  setLanguage: (lang: string) => void;
}

const Ctx = createContext<LanguageCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // The default language is shown while Dexie loads on the very first render. Subsequent
  // reads come from `useLiveQuery`, which also re-fires after `setStoredLanguage` writes.
  const language = useLiveQuery(() => getStoredLanguage(), []) ?? `French`;

  function setLanguage(lang: string) {
    void setStoredLanguage(lang);
  }

  return <Ctx.Provider value={{ language, setLanguage }}>{children}</Ctx.Provider>;
}

export function useLanguage(): LanguageCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error(`useLanguage must be used within LanguageProvider`);
  return ctx;
}
