import type { WritingExercise } from "../../hooks/useGenerateWriting";
import { AudioPlayer } from "../listening/AudioPlayer";

interface Props {
  exercise: WritingExercise;
  language: string;
  languageComplexity: number;
  audioUrl: string;
  onContinue: () => void;
}

export function DictoglossListeningView({
  exercise,
  language,
  languageComplexity,
  audioUrl,
  onContinue,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 space-y-4">
        {exercise.title && (
          <h2 className="text-xl font-semibold text-gray-800">{exercise.title}</h2>
        )}
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          {`${language} · Complexity ${languageComplexity}`}
        </p>
        <p className="text-sm text-gray-500">
          {`Listen as many times as you need. When you advance, the audio will be hidden — write a summary of the passage in as much detail as you can recall.`}
        </p>
        <div className="flex">
          <AudioPlayer src={audioUrl} label={`Listen to the passage`} />
        </div>
      </div>
      <button
        onClick={onContinue}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
      >
        {`Continue to summary`}
      </button>
    </div>
  );
}
