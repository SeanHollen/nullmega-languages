import { useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { FaArrowLeft, FaEllipsisV } from "react-icons/fa";
import { StudyEmptyState } from "../components/StudyEmptyState";
import type { Flashcard } from "../utils/flashcards";
import { patchFlashcard, computeStatus, pickNextContext } from "../utils/flashcards";
import { loadVocabSettings } from "../utils/vocabSettings";
import { loadAudio, deleteAudio } from "../utils/db";
import { AudioPlayer } from "../components/listening/AudioPlayer";
import { BoldWord } from "../components/BoldWord";
import type { StudySessionData } from "../utils/studySession";
import {
  easyInterval,
  pickNextCard,
  buildTierFn,
  computeAnswerPatch,
  computeRemoveContextPatch,
} from "../utils/studySession";

type StudyMode = "learn" | "review";

export function StudyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode: modeParam } = useParams<{ mode: string }>();
  const mode: StudyMode = modeParam === "review" ? "review" : "learn";

  const settings = useLiveQuery(() => loadVocabSettings(), []);
  const sessionData = location.state as StudySessionData | null;

  const [remaining, setRemaining] = useState<Flashcard[]>(() => sessionData?.cards ?? []);
  const [current, setCurrent] = useState<Flashcard | null>(() => sessionData?.current ?? null);
  const [revealed, setRevealed] = useState(false);
  const [textRevealed, setTextRevealed] = useState(false);
  const [contextIndex, setContextIndex] = useState(() => sessionData?.contextIndex ?? 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(() => sessionData?.audioUrl ?? null);

  const cancelAudio = useRef<() => void>(() => {});

  const tierFn = buildTierFn(
    mode,
    settings?.showUpcomingBeforeLearning ?? true,
    settings?.showDueBeforeRelearning ?? true,
  );

  function showCard(card: Flashcard) {
    cancelAudio.current();
    setRevealed(false);
    setTextRevealed(false);
    if (card.contexts.length === 0) {
      setContextIndex(0);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    let cancelled = false;
    cancelAudio.current = () => {
      cancelled = true;
    };
    void (async () => {
      const ci = await pickNextContext(card);
      if (cancelled) return;
      setContextIndex(ci);
      const key = card.contexts[ci]?.audioKey;
      if (!settings?.generateAudio || !key) {
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        return;
      }
      const blob = await loadAudio(key);
      if (cancelled) return;
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return blob ? URL.createObjectURL(blob) : null;
      });
    })();
  }

  function handleAnswer(right: boolean) {
    if (!current) return;
    const { patch, graduate } = computeAnswerPatch(current, mode, right, Date.now());
    void patchFlashcard(current.id, patch);

    if (graduate) {
      advanceCard();
    } else {
      const updatedRemaining = remaining.map((c) => (c.id === current.id ? { ...c, ...patch } : c));
      setRemaining(updatedRemaining);
      const nextCard = pickNextCard(updatedRemaining, tierFn);
      setCurrent(nextCard);
      if (nextCard) showCard(nextCard);
    }
  }

  function advanceCard() {
    const next = remaining.filter((c) => c.id !== current!.id);
    setRemaining(next);
    const nextCard = pickNextCard(next, tierFn);
    setCurrent(nextCard);
    if (nextCard) showCard(nextCard);
  }

  function handleEasy() {
    if (!current) return;
    const now = Date.now();
    if (mode === "learn") {
      void patchFlashcard(current.id, {
        status: "scheduled",
        lastReviewed: now,
        currentInterval: easyInterval(current.currentInterval),
        learningCorrectCount: 0,
        relearningStartedAt: null,
        contexts: [],
        dateContextGenerated: null,
      });
    } else {
      void patchFlashcard(current.id, {
        status: "scheduled",
        lastReviewed: now,
        currentInterval: easyInterval(current.currentInterval),
        contexts: [],
        dateContextGenerated: null,
      });
    }
    setMenuOpen(false);
    advanceCard();
  }

  function handleSuspend() {
    if (!current) return;
    void patchFlashcard(current.id, { status: "dropped" });
    setMenuOpen(false);
    advanceCard();
  }

  function handleRemoveContext() {
    if (!current || !ctx) return;
    cancelAudio.current();
    setMenuOpen(false);
    const { patch, removedAudioKey } = computeRemoveContextPatch(current, contextIndex);
    if (removedAudioKey) void deleteAudio(removedAudioKey);
    void patchFlashcard(current.id, patch);
    if ((patch.contexts ?? []).length === 0) {
      advanceCard();
      return;
    }
    const updatedCard = { ...current, ...patch };
    setRemaining((rs) => rs.map((c) => (c.id === current.id ? updatedCard : c)));
    setCurrent(updatedCard);
    showCard(updatedCard);
  }

  const ctx = current && current.contexts[contextIndex];
  const title = mode === "learn" ? `Learn new words` : `Review`;

  const counts = { upcoming: 0, learning: 0, relearning: 0, reviewing: 0 };
  for (const c of remaining) {
    const s = computeStatus(c);
    if (s === "relearning") counts.relearning++;
    else if (s === "due") counts.reviewing++;
    else if (s === "learning" || s === "new") {
      if (c.learningCorrectCount === null) counts.upcoming++;
      else counts.learning++;
    }
  }
  const countParts: string[] = [];
  if (counts.reviewing > 0) countParts.push(`${counts.reviewing} reviewing`);
  if (counts.upcoming > 0) countParts.push(`${counts.upcoming} upcoming`);
  if (counts.learning > 0) countParts.push(`${counts.learning} learning`);
  if (counts.relearning > 0) countParts.push(`${counts.relearning} relearning`);

  if (!settings) return null;

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate(`/vocabulary`)}
              className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <FaArrowLeft />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          </div>
          {countParts.length > 0 && (
            <span className="text-sm text-gray-500">{countParts.join(` · `)}</span>
          )}
        </div>

        {current === null && <StudyEmptyState mode={mode} learnSuggestsAddingCards />}
        {current !== null && ctx && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 space-y-6 text-center">
            {(settings.showText || textRevealed || revealed) && (
              <p
                className={`text-2xl text-gray-800 break-words leading-relaxed ${settings.showText ? `` : `opacity-70`}`}
              >
                <BoldWord text={ctx.source} />
              </p>
            )}
            {!settings.showText && !textRevealed && !revealed && (
              <button
                onClick={() => setTextRevealed(true)}
                className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition cursor-pointer"
              >
                {`Show text`}
              </button>
            )}
            {audioUrl && (
              <div className="flex justify-center">
                <AudioPlayer src={audioUrl} autoplay={settings.autoplayAudio} />
              </div>
            )}
            {revealed && (
              <div className="border-t border-gray-100 pt-6">
                <p className="text-xl text-gray-600 italic break-words leading-relaxed">
                  <BoldWord text={ctx.translation} />
                </p>
              </div>
            )}
            <div className="pt-2">
              {!revealed ? (
                <button
                  onClick={() => setRevealed(true)}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
                >
                  {`Show answer`}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAnswer(false)}
                    className="flex-1 border-2 border-red-200 bg-red-50 text-gray-700 py-3 rounded-xl font-semibold hover:bg-red-100 transition cursor-pointer"
                  >
                    {`Wrong`}
                  </button>
                  <button
                    onClick={() => handleAnswer(true)}
                    className="flex-1 border-2 border-blue-200 bg-blue-50 text-gray-700 py-3 rounded-xl font-semibold hover:bg-blue-100 transition cursor-pointer"
                  >
                    {`Right`}
                  </button>
                  <div className="relative">
                    {menuOpen && (
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    )}
                    <button
                      onClick={() => setMenuOpen((p) => !p)}
                      className="h-full px-3 border-2 border-gray-400 bg-white text-gray-500 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                    >
                      <FaEllipsisV />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 bottom-full mb-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-[180px]">
                        <button
                          onClick={handleEasy}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 cursor-pointer"
                        >
                          {`Easy`}
                        </button>
                        <button
                          onClick={handleSuspend}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          {`Suspend`}
                        </button>
                        <button
                          onClick={handleRemoveContext}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          {`Remove this context`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
