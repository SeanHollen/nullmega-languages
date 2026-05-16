import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import type { GrammarCard } from "../utils/grammarCards";
import { computeGrammarStatus, patchGrammarCard } from "../utils/grammarCards";
import type { GrammarSessionData } from "../utils/grammarSession";
import { INITIAL_INTERVAL, nextInterval, pickRandom } from "../utils/studySession";

type Phase = "answering" | "results";

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase();
}

export function GrammarStudyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode: modeParam } = useParams<{ mode: string }>();
  const mode = modeParam === `review` ? `review` : `learn`;

  const sessionData = location.state as GrammarSessionData | null;

  const [remaining, setRemaining] = useState<GrammarCard[]>(() => sessionData?.cards ?? []);
  const [current, setCurrent] = useState<GrammarCard | null>(() => sessionData?.current ?? null);
  const [phase, setPhase] = useState<Phase>(`answering`);
  const [answers, setAnswers] = useState<string[]>(() =>
    Array(sessionData?.current?.questions.length ?? 0).fill(``),
  );
  const [questionResults, setQuestionResults] = useState<boolean[]>([]);

  const title = mode === `learn` ? `Learn Grammar` : `Review Grammar`;

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
    const results = current.questions.map(
      (q, i) => normalizeAnswer(answers[i] ?? ``) === normalizeAnswer(q.answer),
    );
    setQuestionResults(results);
    setPhase(`results`);
  }

  function handleCardAnswer(right: boolean) {
    if (!current) return;
    const now = Date.now();
    const cardStatus = computeGrammarStatus(current);

    if (right) {
      const interval =
        cardStatus === `due` ? nextInterval(current.currentInterval) : INITIAL_INTERVAL;
      patchGrammarCard(current.id, {
        status: `scheduled`,
        lastReviewed: now,
        currentInterval: interval,
      });
    } else if (cardStatus === `due`) {
      patchGrammarCard(current.id, {
        status: `learning`,
        lastReviewed: now,
        currentInterval: INITIAL_INTERVAL,
      });
    }

    const nextRemaining = right ? remaining.filter((c) => c.id !== current.id) : remaining;
    const nextCard = nextRemaining.length > 0 ? pickRandom(nextRemaining) : null;

    setRemaining(nextRemaining);
    setCurrent(nextCard);
    setAnswers(Array(nextCard?.questions.length ?? 0).fill(``));
    setPhase(`answering`);
    setQuestionResults([]);
  }

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate(`/grammar`)}
              className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <FaArrowLeft />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          </div>
          {remaining.length > 0 && (
            <span className="text-sm text-gray-500">{`${remaining.length} left`}</span>
          )}
        </div>

        {current === null && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-500">
              {mode === `learn`
                ? `No cards to learn right now.`
                : `No cards due for review. Come back later.`}
            </p>
          </div>
        )}
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
                        <button
                          key={choice}
                          onClick={() => setAnswer(i, choice)}
                          className={`text-left px-4 py-3 rounded-xl border-2 transition cursor-pointer ${
                            answers[i] === choice
                              ? `border-green-400 bg-green-50 text-green-800`
                              : `border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50`
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      value={answers[i] ?? ``}
                      onChange={(e) => setAnswer(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === `Enter` && allAnswered) submitAnswers();
                      }}
                      placeholder={`Type your answer…`}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700"
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={submitAnswers}
              disabled={!allAnswered}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              {`Check answers →`}
            </button>
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
              <p className="text-sm text-gray-500 mt-1">{`questions correct`}</p>
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
                      {` → ${q.answer}`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => handleCardAnswer(questionResults.every(Boolean))}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
            >
              {`Continue →`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
