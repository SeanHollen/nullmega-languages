import { shiftLearnSessionDate } from "./vocabSettings";

export function setupDevTools(): void {
  (window as unknown as Record<string, unknown>).simulateTimePassing = (numDays: number) => {
    const shift = numDays * 24 * 60 * 60 * 1000;
    try {
      const cards = JSON.parse(localStorage.getItem("flashcards") ?? "[]");
      for (const card of cards) {
        if (typeof card.lastReviewed === "number") card.lastReviewed -= shift;
        if (typeof card.addedAt === "number") card.addedAt -= shift;
        if (typeof card.dateContextGenerated === "number") card.dateContextGenerated -= shift;
      }
      localStorage.setItem("flashcards", JSON.stringify(cards));

      const history = JSON.parse(localStorage.getItem("assessment_history") ?? "[]");
      for (const record of history) {
        if (typeof record.completedAt === "number") record.completedAt -= shift;
      }
      localStorage.setItem("assessment_history", JSON.stringify(history));

      shiftLearnSessionDate(numDays);

      console.log(`Simulated ${numDays} day(s) passing. Reload the page to see updated statuses.`);
    } catch (e) {
      console.error("simulateTimePassing failed:", e);
    }
  };
}
