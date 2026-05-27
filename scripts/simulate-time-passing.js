// Shift every timestamp in IndexedDB back by N days, so cards become due, streaks
// accumulate, etc. — without actually waiting.
//
// USAGE — set NUM_DAYS below, then paste this entire file into the DevTools console.
// Reload the page after.

(async () => {
  const NUM_DAYS = 1;

  const shift = NUM_DAYS * 24 * 60 * 60 * 1000;
  const open = indexedDB.open(`language-lab`);
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result);
    open.onerror = () => rej(open.error);
  });

  const tx = db.transaction(
    [`flashcards`, `grammarCards`, `assessments`, `abilities`, `kv`],
    `readwrite`,
  );
  const getAll = (store) =>
    new Promise((res) => {
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
    });

  const flashcards = await getAll(`flashcards`);
  for (const card of flashcards) {
    if (typeof card.lastReviewed === `number`) card.lastReviewed -= shift;
    if (typeof card.addedAt === `number`) card.addedAt -= shift;
    if (typeof card.dateContextGenerated === `number`) card.dateContextGenerated -= shift;
    tx.objectStore(`flashcards`).put(card);
  }

  const grammarCards = await getAll(`grammarCards`);
  for (const card of grammarCards) {
    if (typeof card.lastReviewed === `number`) card.lastReviewed -= shift;
    if (typeof card.addedAt === `number`) card.addedAt -= shift;
    tx.objectStore(`grammarCards`).put(card);
  }

  const assessments = await getAll(`assessments`);
  for (const rec of assessments) {
    if (typeof rec.completedAt === `number`) rec.completedAt -= shift;
    tx.objectStore(`assessments`).put(rec);
  }

  const abilities = await getAll(`abilities`);
  for (const ab of abilities) {
    if (ab.confidenceUpdatedAt > 0) ab.confidenceUpdatedAt -= shift;
    tx.objectStore(`abilities`).put(ab);
  }

  // Shift the vocab daily-learn-session counter date too.
  const vocabSession = await new Promise((res) => {
    const req = tx.objectStore(`kv`).get(`vocab_learn_session`);
    req.onsuccess = () => res(req.result);
  });
  if (vocabSession?.value?.date) {
    const d = new Date(vocabSession.value.date);
    d.setDate(d.getDate() - NUM_DAYS);
    tx.objectStore(`kv`).put({
      key: `vocab_learn_session`,
      value: { date: d.toISOString().slice(0, 10), count: vocabSession.value.count },
    });
  }

  await new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });

  console.log(`Simulated ${NUM_DAYS} day(s) passing. Reload the page.`);
  db.close();
})();
