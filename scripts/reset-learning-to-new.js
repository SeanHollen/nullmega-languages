// One-shot: undo the inflated-learning-cards state caused by the daily-counter bug
// (status flipped to "learning" per-card without the counter incrementing, so repeated
// Learn-new-cards clicks promoted full daily quotas on top of each other). Every
// flashcard currently in status="learning" is reset to "new" with contexts stripped,
// and today's vocab learn-session counter is cleared so the daily quota starts fresh.
//
// USAGE — open the app in your browser, open DevTools console, paste this whole file.
// It runs immediately across ALL languages. Reload the page after.

(async () => {
  const open = indexedDB.open(`language-lab`);
  const db = await new Promise((res, rej) => {
    open.onsuccess = () => res(open.result);
    open.onerror = () => rej(open.error);
  });

  const tx = db.transaction([`flashcards`, `kv`], `readwrite`);

  const cards = await new Promise((res) => {
    const req = tx.objectStore(`flashcards`).getAll();
    req.onsuccess = () => res(req.result);
  });

  let reset = 0;
  for (const card of cards) {
    if (card.status === `learning`) {
      card.status = `new`;
      card.contexts = [];
      card.dateContextGenerated = null;
      card.learningCorrectCount = null;
      tx.objectStore(`flashcards`).put(card);
      reset++;
    }
  }

  tx.objectStore(`kv`).delete(`vocab_learn_session`);

  await new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });

  console.log(`Reset ${reset} card(s) from learning → new and cleared today's counter.`);
  db.close();
})();
