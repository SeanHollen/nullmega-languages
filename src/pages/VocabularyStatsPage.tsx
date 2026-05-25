import { loadFlashcards } from "../utils/flashcards";
import { SrsStatsPageShell } from "../components/stats/SrsStatsPageShell";

export function VocabularyStatsPage() {
  return (
    <SrsStatsPageShell
      title="Vocabulary Stats"
      backTo="/vocabulary"
      loadCards={loadFlashcards}
      emptyMessage={(lang) => `No flashcards yet for ${lang}.`}
    />
  );
}
