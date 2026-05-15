import { useState, useRef, useEffect } from "react";
import { FaPlay, FaPause, FaUndo } from "react-icons/fa";

interface Props {
  src: string;
  label?: string;
}

export function AudioPlayer({ src, label }: Props) {
  const [trackedSrc, setTrackedSrc] = useState(src);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset playing/progress during render when src changes (not in an effect)
  if (trackedSrc !== src) {
    setTrackedSrc(src);
    setPlaying(false);
    setProgress(0);
  }

  useEffect(() => {
    const audio = new Audio(src);
    audio.addEventListener(`timeupdate`, () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    });
    audio.addEventListener(`ended`, () => {
      setPlaying(false);
      setProgress(0);
    });
    audio.addEventListener(`pause`, () => {
      setPlaying(false);
    });
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [src]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  function restart() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setProgress(0);
  }

  return (
    <div
      className="inline-flex items-center gap-3 px-4 py-2 rounded-xl border border-green-200 text-green-700 text-sm font-medium overflow-hidden"
      style={{
        background: `linear-gradient(to right, #bbf7d0 ${progress * 100}%, #f0fdf4 ${progress * 100}%)`,
      }}
    >
      <button
        onClick={toggle}
        className="hover:brightness-90 transition cursor-pointer"
        aria-label={playing ? `Pause` : `Play`}
      >
        {playing ? <FaPause className="shrink-0" /> : <FaPlay className="shrink-0" />}
      </button>
      <button
        onClick={restart}
        disabled={progress === 0}
        className="transition enabled:hover:brightness-90 enabled:cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        title={`Restart`}
        aria-label={`Restart`}
      >
        <FaUndo className="shrink-0" />
      </button>
      {label && (
        <button onClick={toggle} className="cursor-pointer hover:brightness-90 transition">
          {label}
        </button>
      )}
    </div>
  );
}
