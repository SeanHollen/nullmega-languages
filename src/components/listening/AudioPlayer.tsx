import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FaPlay, FaPause, FaUndo } from "react-icons/fa";
import { addListeningSeconds } from "../../utils/listeningStats";
import { Button } from "../Button";

const MIN_TRACKABLE_DURATION_SECONDS = 10;

interface Props {
  src: string;
  label?: string;
  autoplay?: boolean;
  small?: boolean;
  // Parent fills this with a callback that restarts and plays the audio. Used for
  // keyboard shortcuts (e.g. "r" to replay).
  replayRef?: React.RefObject<(() => void) | null>;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return `0:00`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, `0`)}`;
}

export function AudioPlayer({ src, label, autoplay = false, small = false, replayRef }: Props) {
  const { t } = useTranslation();
  const [trackedSrc, setTrackedSrc] = useState(src);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playStartedAtRef = useRef<number | null>(null);

  // Reset playing/progress during render when src changes (not in an effect)
  if (trackedSrc !== src) {
    setTrackedSrc(src);
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }

  useEffect(() => {
    const audio = new Audio(src);

    function flushSeconds() {
      if (playStartedAtRef.current === null) return;
      const seconds = (Date.now() - playStartedAtRef.current) / 1000;
      playStartedAtRef.current = null;
      if (audio.duration > MIN_TRACKABLE_DURATION_SECONDS) {
        void addListeningSeconds(seconds);
      }
    }

    audio.addEventListener(`loadedmetadata`, () => {
      setDuration(audio.duration);
    });
    audio.addEventListener(`timeupdate`, () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    });
    audio.addEventListener(`play`, () => {
      playStartedAtRef.current = Date.now();
      setPlaying(true);
    });
    audio.addEventListener(`ended`, () => {
      flushSeconds();
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    });
    audio.addEventListener(`pause`, () => {
      flushSeconds();
      setPlaying(false);
    });
    audioRef.current = audio;
    if (replayRef) {
      replayRef.current = () => {
        audio.currentTime = 0;
        void audio.play();
      };
    }
    if (autoplay) {
      void (async () => {
        try {
          await audio.play();
        } catch {
          // Browser autoplay policies may block; silently ignore — user can press play
        }
      })();
    }
    return () => {
      flushSeconds();
      audio.pause();
      audioRef.current = null;
      if (replayRef) replayRef.current = null;
    };
  }, [src, autoplay, replayRef]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
  }

  function restart() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setProgress(0);
    setCurrentTime(0);
  }

  return (
    <div
      className={`inline-flex items-center rounded-xl border border-green-200 text-green-700 font-medium overflow-hidden ${small ? `text-xs` : `text-sm`}`}
      style={{
        background: `linear-gradient(to right, #bbf7d0 ${progress * 100}%, #f0fdf4 ${progress * 100}%)`,
      }}
    >
      <Button
        onClick={toggle}
        className={`flex items-center gap-3 hover:brightness-90 transition cursor-pointer ${small ? `px-3 py-1.5` : `px-4 py-1`}`}
        aria-label={playing ? t(`Pause`) : t(`Play`)}
      >
        {playing ? <FaPause className="shrink-0" /> : <FaPlay className="shrink-0" />}
        {small
          ? label && <span>{label}</span>
          : label && (
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm">{label}</span>
                {duration > MIN_TRACKABLE_DURATION_SECONDS && (
                  <span className="tabular-nums text-[10px] text-green-600/80">
                    {`${formatTime(currentTime)} / ${formatTime(duration)}`}
                  </span>
                )}
              </span>
            )}
      </Button>
      <div className="w-px self-stretch bg-green-200" />
      <Button
        onClick={restart}
        disabled={progress === 0}
        className={`transition enabled:hover:brightness-90 enabled:cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${small ? `px-2 py-1.5` : `px-3 py-2`}`}
        title={t(`Restart`)}
        aria-label={t(`Restart`)}
      >
        <FaUndo className="shrink-0" />
      </Button>
    </div>
  );
}
