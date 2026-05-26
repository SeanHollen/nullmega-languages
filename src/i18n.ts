import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/translation.json";

// English strings ARE the keys (e.g. `t('Submit Answers')`). With `keySeparator: false`
// and `nsSeparator: false`, dots/colons in copy don't get parsed as path separators.
// Missing keys fall back to the key itself, so a string that hasn't been added to the
// JSON yet still renders as English while the extractor catches up.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: `en`,
  fallbackLng: `en`,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export default i18n;
