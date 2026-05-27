// Manually set the per-mode ability rating for a language.
// MODE must be one of: reading, listening, pronunciation, writing.
// VALUE is clamped to 1-100 by the app on next save; this script just writes the row.
// LANGUAGE — leave blank to use whichever language is currently selected in the UI.
//
// USAGE — set MODE, VALUE (and optionally LANGUAGE) below, then paste this file into
// the DevTools console. Reload the page after.

(async () => {
  const MODE = `reading`;
  const VALUE = 50;
  const LANGUAGE = ``;

  const open = indexedDB.open(`language-lab`);
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result);
    open.onerror = () => rej(open.error);
  });

  const tx = db.transaction([`abilities`, `kv`], `readwrite`);

  let lang = LANGUAGE;
  if (!lang) {
    const row = await new Promise((res) => {
      const req = tx.objectStore(`kv`).get(`selectedLanguage`);
      req.onsuccess = () => res(req.result);
    });
    lang = typeof row?.value === `string` ? row.value : `French`;
  }

  const id = `${lang}|${MODE}`;
  const existing = await new Promise((res) => {
    const req = tx.objectStore(`abilities`).get(id);
    req.onsuccess = () => res(req.result);
  });
  tx.objectStore(`abilities`).put({
    id,
    language: lang,
    mode: MODE,
    rating: VALUE,
    confidenceValue: existing?.confidenceValue ?? 0.5,
    confidenceUpdatedAt: Date.now(),
  });

  await new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });

  console.log(`Set ${MODE} rating for ${lang} to ${VALUE}. Reload to see updated UI.`);
  db.close();
})();
