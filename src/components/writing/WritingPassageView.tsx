import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaMicrophone, FaStop } from "react-icons/fa";
import type { WritingExercise } from "../../hooks/useGenerateWriting";
import { useSpeechToText } from "../../hooks/useSpeechToText";
import { Button } from "../Button";
import { TermList } from "../TermList";

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
  onAppendToAnswer: (index: number, text: string) => void;
  onSubmit: () => void;
}

export function WritingPassageView({
  exercise,
  language,
  languageComplexity,
  answers,
  onAnswerChange,
  onAppendToAnswer,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const essayIndex = exercise.questions.findIndex((q) => q.type === "essay");
  const essayQ = exercise.questions[essayIndex];
  const essayCount = wordCount(answers[essayIndex] ?? "");
  const [sttErrorByIndex, setSttErrorByIndex] = useState<Record<number, string>>({});
  const stt = useSpeechToText({
    language,
    onTranscript: (text, key) => {
      const idx = parseInt(key, 10);
      if (Number.isNaN(idx)) return;
      onAppendToAnswer(idx, text);
    },
    onError: (msg, key) => {
      const idx = parseInt(key, 10);
      if (Number.isNaN(idx)) return;
      setSttErrorByIndex((prev) => ({ ...prev, [idx]: msg }));
    },
  });

  function toggleRecording(index: number) {
    setSttErrorByIndex((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    const key = String(index);
    if (stt.activeKey === key) stt.stop();
    else stt.start(key);
  }

  const canSubmit = exercise.questions.every((q, i) => {
    if (q.type === "essay") return wordCount(answers[i] ?? "") >= (q.minWords ?? 0);
    return (answers[i] ?? "").trim().length > 0;
  });

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
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{exercise.passage}</p>
        <TermList
          title={t(`Vocabulary`)}
          items={exercise.difficultWords.map((w) => ({ left: w.source, right: w.translation }))}
          variant="passage"
          className="mt-5"
        />
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
              <p className="text-xs text-gray-400">
                {t(`{{min}}–{{max}} words required`, {
                  min: q.minWords,
                  max: q.maxWords,
                })}
              </p>
            )}
            <textarea
              value={answers[i] ?? ""}
              onChange={(e) => onAnswerChange(i, e.target.value)}
              rows={isEssay ? 7 : 2}
              placeholder={
                isEssay
                  ? t(`Write your response in {{language}}…`, { language })
                  : t(`Answer in {{language}}…`, { language })
              }
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none placeholder:text-gray-300"
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {stt.isSupported && (
                  <Button
                    onClick={() => toggleRecording(i)}
                    className={`cursor-pointer flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
                      stt.activeKey === String(i)
                        ? `bg-red-50 border-red-200 text-red-600 hover:bg-red-100`
                        : `border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700`
                    }`}
                    title={t(`Dictate in {{language}}`, { language })}
                  >
                    {stt.activeKey === String(i) ? (
                      <FaStop className="shrink-0" />
                    ) : (
                      <FaMicrophone className="shrink-0" />
                    )}
                    {stt.activeKey === String(i) ? t(`Listening…`) : t(`Dictate`)}
                  </Button>
                )}
                {sttErrorByIndex[i] && (
                  <span className="text-xs text-red-500 font-medium">{sttErrorByIndex[i]}</span>
                )}
              </div>
              {isEssay && (
                <p className={`text-xs font-medium ${countColor}`}>
                  {t(`{{count}} / {{min}}–{{max}} words`, {
                    count,
                    min: q.minWords,
                    max: q.maxWords,
                  })}
                </p>
              )}
            </div>
          </div>
        );
      })}

      <div className={`relative group ${!canSubmit ? `cursor-not-allowed` : ``}`}>
        <Button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
        >
          {t(`Submit Answers`)}
        </Button>
        {!canSubmit && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
            {essayCount < (essayQ?.minWords ?? 0)
              ? t(`Essay needs at least {{min}} words`, { min: essayQ?.minWords })
              : t(`Answer all questions before submitting`)}
          </div>
        )}
      </div>
    </div>
  );
}
