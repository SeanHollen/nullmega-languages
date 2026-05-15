import { useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { patchFlashcard, Flashcard } from "../utils/flashcards";
import { loadVocabSettings, VocabSettings } from "../utils/vocabSettings";
import { loadAudio } from "../utils/audioStore";
import { AudioPlayer } from "../components/listening/AudioPlayer";
import { BoldWord } from "../components/BoldWord";
import {
  StudySessionData,
  INITIAL_INTERVAL,
  nextInterval,
  pickRandom,
} from "../utils/studySession";

type StudyMode = "learn" | "review";

export function StudyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode: modeParam } = useParams<{ mode: string }>();
  const mode: StudyMode = modeParam === "review" ? "review" : "learn";

  const [settings] = useState<VocabSettings>(() => loadVocabSettings());
  const sessionData = location.state as StudySessionData | null;

  const [remaining, setRemaining] = useState<Flashcard[]>(() => sessionData?.cards ?? []);
  const [current, setCurrent] = useState<Flashcard | null>(() => sessionData?.current ?? null);
  const [revealed, setRevealed] = useState(false);
  const [contextIndex, setContextIndex] = useState(() => sessionData?.contextIndex ?? 0);
  const [stats, setStats] = useState({ right: 0, wrong: 0 });
  const [audioUrl, setAudioUrl] = useState<string | null>(() => sessionData?.audioUrl ?? null);

  const cancelAudio = useRef<() => void>(() => {});

  function showCard(card: Flashcard) {
    cancelAudio.current();
    setRevealed(false);
    if (card.contexts.length === 0) {
      setContextIndex(0);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const ci = Math.floor(Math.random() * card.contexts.length);
    setContextIndex(ci);
    const key = card.contexts[ci]?.audioKey;
    if (!settings.generateAudio || !key) {
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
    loadAudio(key).then((blob) => {
      if (cancelled) return;
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return blob ? URL.createObjectURL(blob) : null;
      });
    });
  }

  function handleAnswer(right: boolean) {
    if (!current) return;
    const now = Date.now();
    if (mode === "learn") {
      if (right) {
        patchFlashcard(current.id, {
          status: "scheduled",
          lastReviewed: now,
          currentInterval: INITIAL_INTERVAL,
        });
      }
    } else {
      if (right) {
        patchFlashcard(current.id, {
          status: "scheduled",
          lastReviewed: now,
          currentInterval: nextInterval(current.currentInterval),
          contexts: [],
          dateContextGenerated: null,
        });
      } else {
        patchFlashcard(current.id, {
          status: "learning",
          lastReviewed: now,
          currentInterval: INITIAL_INTERVAL,
        });
      }
    }
    setStats((p) => ({
      right: p.right + (right ? 1 : 0),
      wrong: p.wrong + (right ? 0 : 1),
    }));
    if (right) {
      const next = remaining.filter((c) => c.id !== current.id);
      setRemaining(next);
      const nextCard = next.length > 0 ? pickRandom(next) : null;
      setCurrent(nextCard);
      if (nextCard) showCard(nextCard);
    } else {
      const nextCard = pickRandom(remaining);
      setCurrent(nextCard);
      showCard(nextCard);
    }
  }

  const ctx = current && current.contexts[contextIndex];
  const sessionDone = current === null && (stats.right > 0 || stats.wrong > 0);
  const nothingToStudy = current === null && stats.right === 0 && stats.wrong === 0;
  const title = mode === "learn" ? `Learn new words` : `Review`;

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
          {remaining.length > 0 && (
            <span className="text-sm text-gray-500">{`${remaining.length} left`}</span>
          )}
        </div>

        {nothingToStudy ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-500">
              {mode === "learn"
                ? `No new flashcards to learn. Save more words from any exercise.`
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
              onClick={() => navigate(`/vocabulary`)}
              className="mt-4 bg-green-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
            >
              {`Back to vocabulary`}
            </button>
          </div>
        ) : current && ctx ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 space-y-6 text-center">
            <p className="text-2xl text-gray-800 break-words leading-relaxed">
              <BoldWord text={ctx.source} target={current.source} />
            </p>
            {audioUrl && (
              <div className="flex justify-center">
                <AudioPlayer src={audioUrl} autoplay={settings.autoplayAudio} />
              </div>
            )}
            {revealed && settings.showText && (
              <div className="border-t border-gray-100 pt-6">
                <p className="text-xl text-gray-600 italic break-words leading-relaxed">
                  <BoldWord text={ctx.translation} target={current.translation} />
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
                    className="flex-1 border-2 border-gray-400 bg-white text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-100 transition cursor-pointer"
                  >
                    {`Wrong`}
                  </button>
                  <button
                    onClick={() => handleAnswer(true)}
                    className="flex-1 border-2 border-gray-400 bg-white text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-100 transition cursor-pointer"
                  >
                    {`Right`}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
