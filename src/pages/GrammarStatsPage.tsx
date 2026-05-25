import { loadGrammarCards } from "../utils/grammarCards";
import { SrsStatsPageShell } from "../components/stats/SrsStatsPageShell";

export function GrammarStatsPage() {
  return (
    <SrsStatsPageShell
      title="Grammar Stats"
      backTo="/grammar"
      loadCards={loadGrammarCards}
      emptyMessage={(lang) => `No grammar cards yet for ${lang}.`}
    />
  );
}
