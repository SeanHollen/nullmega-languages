import type { WritingExercise } from "../../hooks/useGenerateWriting";

interface Props {
  exercise: WritingExercise;
  language: string;
  languageComplexity: number;
  paragraph: string;
  onParagraphChange: (s: string) => void;
  onSubmit: () => void;
}

function wordCount(s: string): number {
  const trimmed = s.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function VocabParagraphWritingView({
  exercise,
  language,
  languageComplexity,
  paragraph,
  onParagraphChange,
  onSubmit,
}: Props) {
  const words = exercise.requiredWords ?? [];
  const count = wordCount(paragraph);
  const canSubmit = count > 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">{`Vocab paragraph`}</h2>
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          {`${language} · Complexity ${languageComplexity}`}
        </p>
        <p className="text-gray-700">
          {`Write a single paragraph in ${language} that uses all of the words below. Inflected forms are fine.`}
        </p>
        <div className="border-t border-green-100 pt-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{`Required words`}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {words.map((w, i) => (
              <li key={i} className="text-gray-700">
                <span className="font-medium">{w.source}</span>
                <span className="text-gray-400">{` — ${w.translation}`}</span>
              </li>
            ))}
          </ul>
        </div>
        <textarea
          value={paragraph}
          onChange={(e) => onParagraphChange(e.target.value)}
          placeholder={`Write your paragraph in ${language}…`}
          rows={10}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
        />
        <p className="text-xs text-gray-400">{`${count} word${count === 1 ? `` : `s`}`}</p>
      </div>
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        title={!canSubmit ? `Paragraph not written` : undefined}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
      >
        {`Submit paragraph`}
      </button>
    </div>
  );
}
