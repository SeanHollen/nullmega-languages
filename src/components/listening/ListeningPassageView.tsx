import type { Exercise } from "../../types";
import type { ExerciseAudio } from "../../hooks/useTTS";
import { AudioPlayer } from "./AudioPlayer";
import { QuestionCard } from "../reading/QuestionCard";

interface Props {
  exercise: Exercise;
  language: string;
  languageComplexity: number;
  audio: ExerciseAudio;
  selected: (number | null)[];
  onSelect: (qi: number, oi: number) => void;
  onSubmit: () => void;
}

export function ListeningPassageView({
  exercise,
  language,
  languageComplexity,
  audio,
  selected,
  onSelect,
  onSubmit,
}: Props) {
  const allAnswered = selected.every((s) => s !== null);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">
          {`${language} · Complexity ${languageComplexity}`}
        </p>
        <p className="text-sm text-gray-400 mb-4">
          {`Listen to the passage, then answer the questions below.`}
        </p>
        <AudioPlayer src={audio.passageUrl} label={`Play passage`} />
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

      {exercise.questions.map((q, qi) => (
        <QuestionCard
          key={qi}
          question={{ ...q, question: `` }}
          index={qi}
          selected={selected[qi]}
          onSelect={(oi) => onSelect(qi, oi)}
          headerSlot={<AudioPlayer src={audio.questionUrls[qi]} label={`Question ${qi + 1}`} />}
        />
      ))}

      <button
        onClick={onSubmit}
        disabled={!allAnswered}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 transition cursor-pointer"
      >
        {`Submit Answers`}
      </button>
    </div>
  );
}
