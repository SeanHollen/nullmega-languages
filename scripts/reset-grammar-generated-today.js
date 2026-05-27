// Resets today's grammar generation counter so the daily quota is fresh.
//
// The counter (kv `grammar_learn_session`) only ever increments — generating a card
// bumps it, but deleting a card later does not roll it back. If you generated some
// cards today and then deleted them, the daily cap still thinks they exist.
//
// USAGE — open the app in your browser, open DevTools console, paste this whole file.
// Reload the page after.

(async () => {
  const open = indexedDB.open(`language-lab`);
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result);
    open.onerror = () => rej(open.error);
  });
  const tx = db.transaction([`kv`], `readwrite`);
  tx.objectStore(`kv`).delete(`grammar_learn_session`);
  await new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  console.log(`Cleared today's grammar generation counter.`);
  db.close();
})();
