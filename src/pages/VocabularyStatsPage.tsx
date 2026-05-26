import { useTranslation } from "react-i18next";
import { loadFlashcards } from "../utils/flashcards";
import { SrsStatsPageShell } from "../components/stats/SrsStatsPageShell";

export function VocabularyStatsPage() {
  const { t } = useTranslation();
  return (
    <SrsStatsPageShell
      title={t(`Vocabulary Stats`)}
      backTo="/vocabulary"
      loadCards={loadFlashcards}
      emptyMessage={(lang) => t(`No flashcards yet for {{lang}}.`, { lang })}
    />
  );
}
