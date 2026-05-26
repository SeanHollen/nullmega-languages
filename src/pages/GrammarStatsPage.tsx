import { useTranslation } from "react-i18next";
import { loadGrammarCards } from "../utils/grammarCards";
import { SrsStatsPageShell } from "../components/stats/SrsStatsPageShell";

export function GrammarStatsPage() {
  const { t } = useTranslation();
  return (
    <SrsStatsPageShell
      title={t(`Grammar Stats`)}
      backTo="/grammar"
      loadCards={loadGrammarCards}
      emptyMessage={(lang) => t(`No grammar cards yet for {{lang}}.`, { lang })}
    />
  );
}
