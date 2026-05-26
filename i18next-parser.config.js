// Scans src/**/*.{ts,tsx} for t('...') / <Trans> usage and merges discovered keys into
// src/locales/<lang>/translation.json. Run with `npm run extract`.
//
// English strings are the keys. New strings appear in en/translation.json with the
// English text as both key and default value; other-language JSON files get the key
// with an empty string for translators to fill in.
export default {
  locales: [`en`],
  input: [`src/**/*.{ts,tsx}`],
  output: `src/locales/$LOCALE/translation.json`,
  defaultNamespace: `translation`,
  defaultValue: (locale, _ns, key) => (locale === `en` ? key : ``),
  keySeparator: false,
  namespaceSeparator: false,
  sort: true,
  createOldCatalogs: false,
  failOnWarnings: false,
};
