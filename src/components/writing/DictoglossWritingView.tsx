import { useTranslation } from "react-i18next";
import type { WritingExercise } from "../../hooks/useGenerateWriting";
import { Button } from "../Button";

interface Props {
  exercise: WritingExercise;
  language: string;
  languageComplexity: number;
  summary: string;
  onSummaryChange: (s: string) => void;
  onSubmit: () => void;
}

function wordCount(s: string): number {
  const trimmed = s.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function DictoglossWritingView({
  exercise,
  language,
  languageComplexity,
  summary,
  onSummaryChange,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const count = wordCount(summary);
  const canSubmit = count > 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 space-y-4">
        {exercise.title && (
          <h2 className="text-xl font-semibold text-gray-800">{exercise.title}</h2>
        )}
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          {t(`{{language}} · Complexity {{complexity}}`, {
            language,
            complexity: languageComplexity,
          })}
        </p>
        <p className="text-gray-700">
          {t(`Summarize the passage in {{language}}, in as much detail as you can recall.`, {
            language,
          })}
        </p>
        <textarea
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
          placeholder={t(`Write your summary in {{language}}…`, { language })}
          rows={10}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
        />
        <p className="text-xs text-gray-400">
          {count === 1 ? t(`{{count}} word`, { count }) : t(`{{count}} words`, { count })}
        </p>
      </div>
      <Button
        onClick={onSubmit}
        disabled={!canSubmit}
        title={!canSubmit ? t(`Summary not written`) : undefined}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
      >
        {t(`Submit summary`)}
      </Button>
    </div>
  );
}
