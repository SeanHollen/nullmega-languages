import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { loadSrsSettings } from "../utils/srsSettings";
import { StudyEmptyState } from "../components/StudyEmptyState";
import { BackHeader } from "../components/BackHeader";
import type { GrammarCard } from "../utils/grammarCards";
import { acceptedAnswers, patchGrammarCard } from "../utils/grammarCards";
import { computeSrsStatus } from "../utils/srs";
import {
  type GrammarSessionData,
  computeGrammarAnswerPatch,
  pickNextGrammarCard,
} from "../utils/grammarSession";
import { Button } from "../components/Button";

type Phase = "answering" | "results";

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase();
}

function matchesAnyAnswer(user: string, accepted: string[]): boolean {
  const u = normalizeAnswer(user);
  return accepted.some((a) => normalizeAnswer(a) === u);
}

export function GrammarStudyPage() {
  const location = useLocation();
  const { mode: modeParam } = useParams<{ mode: string }>();
  const { t } = useTranslation();
  const mode = modeParam === `review` ? `review` : `learn`;

  const sessionData = location.state as GrammarSessionData | null;
  const srsSettings = useLiveQuery(() => loadSrsSettings(), []);

  const [remaining, setRemaining] = useState<GrammarCard[]>(() => sessionData?.cards ?? []);
  const [current, setCurrent] = useState<GrammarCard | null>(() => sessionData?.current ?? null);
  const [phase, setPhase] = useState<Phase>(`answering`);
  const [answers, setAnswers] = useState<string[]>(() =>
    Array(sessionData?.current?.questions.length ?? 0).fill(``),
  );
  const [questionResults, setQuestionResults] = useState<boolean[]>([]);

  const title = mode === `learn` ? t(`Learn Grammar`) : t(`Review Grammar`);

  const allAnswered = current !== null && answers.every((a) => a.trim() !== ``);

  function setAnswer(index: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function submitAnswers() {
    if (!current) return;
    const results = current.questions.map((q, i) =>
      matchesAnyAnswer(answers[i] ?? ``, acceptedAnswers(q)),
    );
    setQuestionResults(results);
    setPhase(`results`);
  }

  function handleCardAnswer(right: boolean) {
    if (!current) return;
    const now = Date.now();
    // Grammar uses N=1 — a single right answer in learn mode graduates the card.
    const derivedStatus = computeSrsStatus(current);
    const mode: "learn" | "review" = derivedStatus === `learning` ? `learn` : `review`;
    const useEase = srsSettings?.useEaseFromHistory ?? true;
    const { patch } = computeGrammarAnswerPatch(current, mode, right, now, 1, useEase);
    void patchGrammarCard(current.id, patch);

    // Reflect the patch in our in-memory session state so subsequent answers on the same
    // card don't operate on stale values.
    const updatedCurrent: GrammarCard = { ...current, ...patch };
    const remainingAfterPatch = remaining.map((c) => (c.id === current.id ? updatedCurrent : c));
    const { card: nextCard, nextRemaining } = pickNextGrammarCard(
      remainingAfterPatch,
      updatedCurrent,
      right,
    );

    setRemaining(nextRemaining);
    setCurrent(nextCard);
    setAnswers(Array(nextCard?.questions.length ?? 0).fill(``));
    setPhase(`answering`);
    setQuestionResults([]);
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <BackHeader
          title={title}
          to="/grammar"
          right={
            remaining.length > 0 ? (
              <span className="text-sm text-gray-500">
                {t(`{{count}} left`, { count: remaining.length })}
              </span>
            ) : undefined
          }
        />

        {current === null && <StudyEmptyState mode={mode} />}
        {current !== null && phase === `answering` && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
            <div className="space-y-1">
              <p className="text-lg font-bold text-gray-800">{current.title}</p>
              <p className="text-sm text-gray-500">{current.prompt}</p>
            </div>

            <div className="space-y-6">
              {current.questions.map((q, i) => (
                <div
                  key={i}
                  className={`space-y-2${i > 0 ? ` pt-6 border-t border-gray-100` : ``}`}
                >
                  <p className="text-base text-gray-700 leading-relaxed">{q.prompt}</p>
                  {q.type === `multiple-choice` && q.choices ? (
                    <div className="flex flex-col gap-2">
                      {q.choices.map((choice) => (
                        <Button
                          key={choice}
                          onClick={() => setAnswer(i, choice)}
                          className={`text-left px-4 py-3 rounded-xl border-2 transition cursor-pointer ${
                            answers[i] === choice
                              ? `border-green-400 bg-green-50 text-green-800`
                              : `border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50`
                          }`}
                        >
                          {choice}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <input
                      value={answers[i] ?? ``}
                      onChange={(e) => setAnswer(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === `Enter` && allAnswered) submitAnswers();
                      }}
                      placeholder={t(`Type your answer…`)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
                    />
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={submitAnswers}
              disabled={!allAnswered}
              title={!allAnswered ? t(`Not all questions answered`) : undefined}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              {t(`Check answers →`)}
            </Button>
          </div>
        )}
        {current !== null && phase === `results` && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
            <div className="space-y-1">
              <p className="text-lg font-bold text-gray-800">{current.title}</p>
            </div>

            <div className="text-center py-2">
              <p className="text-3xl font-bold text-gray-800">
                {`${questionResults.filter(Boolean).length} / ${questionResults.length}`}
              </p>
              <p className="text-sm text-gray-500 mt-1">{t(`questions correct`)}</p>
            </div>

            <div className="space-y-2">
              {current.questions.map((q, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${questionResults[i] ? `bg-green-50 text-green-800` : `bg-red-50 text-red-800`}`}
                >
                  <span className="font-bold flex-shrink-0">{questionResults[i] ? `✓` : `✗`}</span>
                  <span className="flex-1">{q.prompt}</span>
                  {questionResults[i] ? (
                    <span className="text-xs flex-shrink-0 opacity-60">{answers[i]}</span>
                  ) : (
                    <span className="text-xs flex-shrink-0 font-medium">
                      <span className="line-through opacity-60">{answers[i]}</span>
                      {` → ${acceptedAnswers(q)[0]}`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={() => handleCardAnswer(questionResults.every(Boolean))}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
            >
              {t(`Continue →`)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
