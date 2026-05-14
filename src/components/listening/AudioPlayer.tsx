import { useState, useRef, useEffect } from "react";
import { FaPlay, FaPause } from "react-icons/fa";

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

  return (
    <button
      onClick={toggle}
      className="relative overflow-hidden flex items-center gap-2 px-4 py-2 rounded-xl border border-green-200 text-green-700 hover:brightness-95 transition text-sm font-medium cursor-pointer"
      style={{
        background: `linear-gradient(to right, #bbf7d0 ${progress * 100}%, #f0fdf4 ${progress * 100}%)`,
      }}
    >
      {playing ? <FaPause className="shrink-0" /> : <FaPlay className="shrink-0" />}
      {label && <span>{label}</span>}
    </button>
  );
}
