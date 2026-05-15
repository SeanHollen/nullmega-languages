import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useLanguage } from "../contexts/LanguageContext";
import { GrammarCard, computeGrammarStatus, patchGrammarCard } from "../utils/grammarCards";
import { GrammarSessionData } from "../utils/grammarSession";
import { INITIAL_INTERVAL, nextInterval, pickRandom } from "../utils/studySession";

type Phase = "answering" | "results";

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase();
}

export function GrammarStudyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
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
  const [stats, setStats] = useState({ right: 0, wrong: 0 });

  const title = mode === `learn` ? `Learn Grammar` : `Review Grammar`;
  const sessionDone = current === null && (stats.right > 0 || stats.wrong > 0);
  const nothingToStudy = current === null && stats.right === 0 && stats.wrong === 0;

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

    setStats((p) => ({ right: p.right + (right ? 1 : 0), wrong: p.wrong + (right ? 0 : 1) }));

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
            <span className="text-sm text-gray-400">{`— ${language}`}</span>
          </div>
          {remaining.length > 0 && (
            <span className="text-sm text-gray-500">{`${remaining.length} left`}</span>
          )}
        </div>

        {nothingToStudy ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-500">
              {mode === `learn`
                ? `No cards to learn right now.`
                : `No cards due for review. Come back later.`}
            </p>
          </div>
        ) : sessionDone ? (
          <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-10 text-center space-y-3">
            <p className="text-2xl font-bold text-gray-800">{`Session complete!`}</p>
            <p className="text-sm text-gray-500">
              {`${stats.right} correct · ${stats.wrong} incorrect`}
            </p>
            <button
              onClick={() => navigate(`/grammar`)}
              className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
            >
              {`Back to grammar`}
            </button>
          </div>
        ) : current && phase === `answering` ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
            <div className="space-y-1">
              <p className="text-lg font-bold text-gray-800">{current.title}</p>
              <p className="text-sm text-gray-500">{current.prompt}</p>
            </div>

            <div className="space-y-4">
              {current.questions.map((q, i) => (
                <div key={i} className="space-y-2">
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
        ) : current && phase === `results` ? (
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
                  {!questionResults[i] && (
                    <span className="text-xs flex-shrink-0 font-medium">{`→ ${q.answer}`}</span>
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
        ) : null}
      </div>
    </div>
  );
}
