import { useTranslation } from "react-i18next";
import type { Exercise } from "../../types";
import type { ExerciseAudio } from "../../hooks/useTTS";
import { AudioPlayer } from "./AudioPlayer";
import { QuestionCard } from "../reading/QuestionCard";
import { Button } from "../Button";
import { TermList } from "../TermList";

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
  const { t } = useTranslation();
  const allAnswered = selected.every((s) => s !== null);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8">
        {exercise.title && (
          <h2 className="text-xl font-semibold text-gray-800 mb-1">{exercise.title}</h2>
        )}
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">
          {t(`{{language}} · Complexity {{complexity}}`, {
            language,
            complexity: languageComplexity,
          })}
        </p>
        <p className="text-sm text-gray-400 mb-4">
          {t(`Listen to the passage, then answer the questions below.`)}
        </p>
        <AudioPlayer src={audio.passageUrl} label={t(`Play passage`)} />
        <TermList
          title={t(`Vocabulary`)}
          items={exercise.difficultWords.map((w) => ({ left: w.source, right: w.translation }))}
          variant="passage"
          className="mt-5"
        />
        <TermList
          title={t(`Proper nouns`)}
          items={exercise.properNouns.map((p) => ({ left: p.name, right: p.description }))}
          variant="passage"
          className="mt-5"
        />
      </div>

      {exercise.questions.map((q, qi) => (
        <QuestionCard
          key={qi}
          question={{ ...q, question: `` }}
          index={qi}
          selected={selected[qi]}
          onSelect={(oi) => onSelect(qi, oi)}
          headerSlot={
            <AudioPlayer src={audio.questionUrls[qi]} label={t(`Question {{n}}`, { n: qi + 1 })} />
          }
        />
      ))}

      <Button
        onClick={onSubmit}
        disabled={!allAnswered}
        title={!allAnswered ? t(`Not all questions answered`) : undefined}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 transition cursor-pointer"
      >
        {t(`Submit Answers`)}
      </Button>
    </div>
  );
}
