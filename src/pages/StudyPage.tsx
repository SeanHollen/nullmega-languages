import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { FaEllipsisV } from "react-icons/fa";
import { BackHeader } from "../components/BackHeader";
import { StudyEmptyState } from "../components/StudyEmptyState";
import type { Flashcard } from "../utils/flashcards";
import { patchFlashcard, computeStatus, pickNextContext } from "../utils/flashcards";
import { loadVocabSettings } from "../utils/vocabSettings";
import { loadSrsSettings } from "../utils/srsSettings";
import { loadAudio, deleteAudio } from "../utils/db";
import { AudioPlayer } from "../components/listening/AudioPlayer";
import { BoldWord } from "../components/BoldWord";
import type { StudySessionData } from "../utils/studySession";
import {
  incrementedInterval,
  pickNextCard,
  buildTierFn,
  computeAnswerPatch,
  computeRemoveContextPatch,
} from "../utils/studySession";
import { Button } from "../components/Button";

type StudyMode = "learn" | "review";

interface CardSourceProps {
  source: string;
  mode: "show" | "hide" | "cloze";
  revealedFull: boolean;
  onRevealText: () => void;
}

function CardSource({ source, mode, revealedFull, onRevealText }: CardSourceProps) {
  const { t } = useTranslation();
  const revealButton = (
    <Button
      onClick={onRevealText}
      className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition cursor-pointer"
    >
      {t(`Show text`)}
    </Button>
  );
  if (mode === `show` || revealedFull) {
    return (
      <p
        className={`text-2xl text-gray-800 break-words leading-relaxed ${mode === `show` ? `` : `opacity-70`}`}
      >
        <BoldWord text={source} />
      </p>
    );
  }
  if (mode === `cloze`) {
    return (
      <>
        <p className="text-2xl text-gray-800 break-words leading-relaxed">
          <BoldWord text={source} cloze />
        </p>
        {revealButton}
      </>
    );
  }
  return revealButton;
}

export function StudyPage() {
  const location = useLocation();
  const { t } = useTranslation();
  const { mode: modeParam } = useParams<{ mode: string }>();
  const mode: StudyMode = modeParam === "review" ? "review" : "learn";

  const settings = useLiveQuery(() => loadVocabSettings(), []);
  const srsSettings = useLiveQuery(() => loadSrsSettings(), []);
  const sessionData = location.state as StudySessionData | null;

  const [remaining, setRemaining] = useState<Flashcard[]>(() => sessionData?.cards ?? []);
  const [current, setCurrent] = useState<Flashcard | null>(() => sessionData?.current ?? null);
  const [revealed, setRevealed] = useState(false);
  const [textRevealed, setTextRevealed] = useState(false);
  const [contextIndex, setContextIndex] = useState(() => sessionData?.contextIndex ?? 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(() => sessionData?.audioUrl ?? null);

  const cancelAudio = useRef<() => void>(() => {});
  const replayAudio = useRef<(() => void) | null>(null);

  const tierFn = buildTierFn(
    mode,
    srsSettings?.showUpcomingBeforeLearning ?? false,
    srsSettings?.showDueBeforeRelearning ?? true,
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
    // Sync-set the index to the cursor the card already carries so the new card never
    // renders with the previous card's stale index. The async pickNextContext below
    // will land on the same value (and advance the persisted cursor).
    setContextIndex((card.contextCursor ?? 0) % card.contexts.length);
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
    const useEase = srsSettings?.useEaseFromHistory ?? true;
    const { patch, graduate } = computeAnswerPatch(current, mode, right, Date.now(), useEase);
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

  // Anki-style keyboard shortcuts: Space to show the answer, then 1=Wrong, 3=Right.
  // useEffect is necessary here — there's no JSX equivalent for a document-level
  // keydown listener. Deps include the gating state so the closure sees current values.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === `INPUT` || target.tagName === `TEXTAREA`)) return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === `r` || e.key === `R`) {
        if (replayAudio.current) {
          e.preventDefault();
          replayAudio.current();
        }
        return;
      }
      if (!revealed) {
        if (e.key === ` `) {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (e.key === `1`) {
        e.preventDefault();
        handleAnswer(false);
      } else if (e.key === `3`) {
        e.preventDefault();
        handleAnswer(true);
      }
    }
    document.addEventListener(`keydown`, onKey);
    return () => document.removeEventListener(`keydown`, onKey);
  });

  function handleShowEarlier() {
    if (!current) return;
    const now = Date.now();
    if (mode === "learn") {
      void patchFlashcard(current.id, {
        status: "scheduled",
        lastReviewed: now,
        currentInterval: incrementedInterval(current, {
          mode: "hard",
          useEase: srsSettings?.useEaseFromHistory ?? true,
        }),
        learningCorrectCount: 0,
        relearningStartedAt: null,
        contextsRefreshedAt: null,
      });
    } else {
      void patchFlashcard(current.id, {
        status: "scheduled",
        lastReviewed: now,
        currentInterval: incrementedInterval(current, {
          mode: "hard",
          useEase: srsSettings?.useEaseFromHistory ?? true,
        }),
        relearningStartedAt: null,
        contextsRefreshedAt: null,
      });
    }
    setMenuOpen(false);
    advanceCard();
  }

  function handleEasy() {
    if (!current) return;
    const now = Date.now();
    if (mode === "learn") {
      void patchFlashcard(current.id, {
        status: "scheduled",
        lastReviewed: now,
        currentInterval: incrementedInterval(current, {
          mode: "easy",
          useEase: srsSettings?.useEaseFromHistory ?? true,
        }),
        learningCorrectCount: 0,
        relearningStartedAt: null,
        contextsRefreshedAt: null,
      });
    } else {
      void patchFlashcard(current.id, {
        status: "scheduled",
        lastReviewed: now,
        currentInterval: incrementedInterval(current, {
          mode: "easy",
          useEase: srsSettings?.useEaseFromHistory ?? true,
        }),
        relearningStartedAt: null,
        contextsRefreshedAt: null,
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
    // Put the card back in the queue (as if the user never saw it) and pick a
    // different card to show next. If this card is the only one left, we'll see it
    // again — that's fine.
    const updatedCard = { ...current, ...patch };
    const updatedRemaining = remaining.map((c) => (c.id === current.id ? updatedCard : c));
    setRemaining(updatedRemaining);
    const others = updatedRemaining.filter((c) => c.id !== current.id);
    const nextCard = pickNextCard(others.length > 0 ? others : updatedRemaining, tierFn);
    setCurrent(nextCard);
    if (nextCard) showCard(nextCard);
  }

  const ctx = current && current.contexts[contextIndex];
  const title = mode === "learn" ? t(`Learn new words`) : t(`Review`);

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
  if (counts.reviewing > 0) countParts.push(t(`{{count}} reviewing`, { count: counts.reviewing }));
  if (counts.upcoming > 0) countParts.push(t(`{{count}} upcoming`, { count: counts.upcoming }));
  if (counts.learning > 0) countParts.push(t(`{{count}} learning`, { count: counts.learning }));
  if (counts.relearning > 0)
    countParts.push(t(`{{count}} relearning`, { count: counts.relearning }));

  if (!settings) return null;

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <BackHeader
          title={title}
          to="/vocabulary"
          right={
            countParts.length > 0 ? (
              <span className="text-sm text-gray-500">{countParts.join(` · `)}</span>
            ) : undefined
          }
        />

        {current === null && <StudyEmptyState mode={mode} learnSuggestsAddingCards />}
        {current !== null && ctx && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 space-y-6 text-center">
            <CardSource
              source={ctx.source}
              mode={settings.textDisplay}
              revealedFull={textRevealed || revealed}
              onRevealText={() => setTextRevealed(true)}
            />
            {audioUrl && (
              <div className="flex justify-center">
                <AudioPlayer
                  src={audioUrl}
                  autoplay={settings.autoplayAudio}
                  replayRef={replayAudio}
                />
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
                <Button
                  onClick={() => setRevealed(true)}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition cursor-pointer"
                >
                  {t(`Show answer`)}
                </Button>
              ) : (
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAnswer(false)}
                    className="flex-1 border-2 border-red-200 bg-red-50 text-gray-700 py-3 rounded-xl font-semibold hover:bg-red-100 transition cursor-pointer"
                  >
                    {t(`Wrong`)}
                  </Button>
                  <Button
                    onClick={() => handleAnswer(true)}
                    className="flex-1 border-2 border-blue-200 bg-blue-50 text-gray-700 py-3 rounded-xl font-semibold hover:bg-blue-100 transition cursor-pointer"
                  >
                    {t(`Right`)}
                  </Button>
                  <div className="relative">
                    {menuOpen && (
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    )}
                    <Button
                      onClick={() => setMenuOpen((p) => !p)}
                      className="h-full px-3 border-2 border-gray-400 bg-white text-gray-500 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                    >
                      <FaEllipsisV />
                    </Button>
                    {menuOpen && (
                      <div className="absolute right-0 bottom-full mb-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-[180px]">
                        <Button
                          onClick={handleShowEarlier}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 cursor-pointer"
                        >
                          {t(`Show earlier`)}
                        </Button>
                        <Button
                          onClick={handleEasy}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 cursor-pointer"
                        >
                          {t(`Show later`)}
                        </Button>
                        <Button
                          onClick={handleSuspend}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          {t(`Suspend`)}
                        </Button>
                        <Button
                          onClick={handleRemoveContext}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          {t(`Remove this context`)}
                        </Button>
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
