import type { WritingExercise } from "../../hooks/useGenerateWriting";

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function wordCountColor(count: number, minWords: number, maxWords: number): string {
  if (count < minWords) return `text-red-400`;
  if (count > maxWords) return `text-orange-400`;
  return `text-green-600`;
}

interface Props {
  exercise: WritingExercise;
  language: string;
  languageComplexity: number;
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
  onSubmit: () => void;
}

export function WritingPassageView({
  exercise,
  language,
  languageComplexity,
  answers,
  onAnswerChange,
  onSubmit,
}: Props) {
  const essayIndex = exercise.questions.findIndex((q) => q.type === "essay");
  const essayQ = exercise.questions[essayIndex];
  const essayCount = wordCount(answers[essayIndex] ?? "");

  const canSubmit = exercise.questions.every((q, i) => {
    if (q.type === "essay") return wordCount(answers[i] ?? "") >= (q.minWords ?? 0);
    return (answers[i] ?? "").trim().length > 0;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">
          {`${language} · Complexity ${languageComplexity}`}
        </p>
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{exercise.passage}</p>
        {exercise.difficultWords.length > 0 && (
          <div className="mt-5 pt-4 border-t border-green-100">
            <p className="text-xs text-gray-300 uppercase tracking-wide mb-2">{`Vocabulary`}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {exercise.difficultWords.map((w, i) => (
                <span key={i} className="text-sm text-gray-400">
                  <span className="text-gray-600">{w.source}</span>
                  {` — `}
                  {w.translation}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {exercise.questions.map((q, i) => {
        const isEssay = q.type === "essay";
        const count = isEssay ? wordCount(answers[i] ?? "") : 0;
        const countColor = wordCountColor(count, q.minWords ?? 0, q.maxWords ?? Infinity);

        return (
          <div
            key={i}
            className="bg-white rounded-2xl border border-green-100 shadow-sm p-6 space-y-3"
          >
            <p className="font-medium text-gray-800">{`${i + 1}. ${q.question}`}</p>
            {isEssay && (
              <p className="text-xs text-gray-400">{`${q.minWords}–${q.maxWords} words required`}</p>
            )}
            <textarea
              value={answers[i] ?? ""}
              onChange={(e) => onAnswerChange(i, e.target.value)}
              rows={isEssay ? 7 : 2}
              placeholder={
                isEssay ? `Write your response in ${language}…` : `Answer in ${language}…`
              }
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none placeholder:text-gray-300"
            />
            {isEssay && (
              <p className={`text-xs font-medium ${countColor}`}>
                {`${count} / ${q.minWords}–${q.maxWords} words`}
              </p>
            )}
          </div>
        );
      })}

      <div className={`relative group ${!canSubmit ? `cursor-not-allowed` : ``}`}>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          {`Submit Answers`}
        </button>
        {!canSubmit && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
            {essayCount < (essayQ?.minWords ?? 0)
              ? `Essay needs at least ${essayQ?.minWords} words`
              : `Answer all questions before submitting`}
          </div>
        )}
      </div>
    </div>
  );
}
