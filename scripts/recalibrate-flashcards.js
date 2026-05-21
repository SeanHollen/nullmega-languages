// One-shot recalibration for flashcards whose currentInterval was inflated by the
// review-mode-right-after-wrong bug. Replays each card's reviewHistory with the fixed
// logic and patches the card if its current state diverges.
//
// USAGE — open the app in your browser, open DevTools console, paste this whole file.
// It runs immediately across ALL flashcards (every language). Reload the page after.
//
// Pre-condition: a card scheduled at > 1d with NO reviewHistory entries can't be
// reconstructed — it predates the reviewHistory field. By default the script also
// resets those to 1d. To skip the fallback, edit RESET_UNTRACKED below to false.

(async () => {
  const RESET_UNTRACKED = true;

  const DAY = 24 * 60 * 60 * 1000;
  const INTERVALS = [1, 3, 7, 14, 30, 90, 180, 365].map((d) => d * DAY);
  const INITIAL_INTERVAL = INTERVALS[0];

  function nextInterval(currentInterval) {
    const idx = INTERVALS.findIndex((i) => i > currentInterval);
    return idx >= 0 ? INTERVALS[idx] : INTERVALS[INTERVALS.length - 1];
  }

  function formatInterval(ms) {
    if (ms === 0) return "0";
    const days = ms / DAY;
    if (days < 1) return `${Math.round(ms / (60 * 60 * 1000))}h`;
    return `${days}d`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("language-lab");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  function readAllFlashcards(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("flashcards", "readonly");
      const store = tx.objectStore("flashcards");
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  function putCard(db, card) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("flashcards", "readwrite");
      const store = tx.objectStore("flashcards");
      const req = store.put(card);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  // Replay reviewHistory through the FIXED state machine: wrong → reset to 1d +
  // relearning. A single right answer graduates a relearning card back to scheduled at
  // 1d (does NOT re-advance via nextInterval — that's the bug that inflated intervals).
  // Corrects on scheduled cards advance via nextInterval.
  function replayHistory(history) {
    let interval = INITIAL_INTERVAL;
    let inRelearning = false;
    for (const entry of history) {
      if (entry.outcome === "incorrect") {
        interval = INITIAL_INTERVAL;
        inRelearning = true;
      } else if (inRelearning) {
        inRelearning = false;
        interval = INITIAL_INTERVAL;
      } else {
        interval = nextInterval(interval);
      }
    }
    return { interval, inRelearning };
  }

  try {
    const db = await openDb();
    const cards = await readAllFlashcards(db);
    const changes = [];
    let patchedFromHistory = 0;
    let patchedNoHistory = 0;
    let skippedNoHistory = 0;

    for (const card of cards) {
      if (card.status === "new" || card.status === "dropped") continue;
      const history = card.reviewHistory ?? [];

      if (history.length === 0) {
        if (
          card.status === "scheduled" &&
          card.currentInterval > INITIAL_INTERVAL &&
          RESET_UNTRACKED
        ) {
          await putCard(db, {
            ...card,
            currentInterval: INITIAL_INTERVAL,
            relearningStartedAt: null,
            learningCorrectCount: 0,
          });
          changes.push({
            source: card.source,
            language: card.language,
            from: `${card.status}/${formatInterval(card.currentInterval)}`,
            to: `scheduled/${formatInterval(INITIAL_INTERVAL)}`,
            reason: "no reviewHistory; reset to initial",
          });
          patchedNoHistory++;
        } else {
          skippedNoHistory++;
        }
        continue;
      }

      const { interval, inRelearning } = replayHistory(history);
      const expectedStatus = inRelearning ? "learning" : "scheduled";
      const expectedRelearningStartedAt = inRelearning
        ? (card.relearningStartedAt ?? Date.now())
        : null;

      const drift =
        card.currentInterval !== interval ||
        card.status !== expectedStatus ||
        card.relearningStartedAt !== expectedRelearningStartedAt;
      if (!drift) continue;

      await putCard(db, {
        ...card,
        currentInterval: interval,
        status: expectedStatus,
        relearningStartedAt: expectedRelearningStartedAt,
      });
      changes.push({
        source: card.source,
        language: card.language,
        from: `${card.status}/${formatInterval(card.currentInterval)}`,
        to: `${expectedStatus}/${formatInterval(interval)}`,
        reason: `replay of ${history.length} reviewHistory entries`,
      });
      patchedFromHistory++;
    }

    db.close();
    console.log("Recalibration complete:", {
      scanned: cards.length,
      patchedFromHistory,
      patchedNoHistory,
      skippedNoHistory,
    });
    if (changes.length > 0) {
      console.log("Changes:");
      console.table(changes);
    }
    console.log("Reload the page to see updated state in the UI.");
  } catch (e) {
    console.error("Recalibration failed:", e);
  }
})();
