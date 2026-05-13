import { useState, useRef } from "react";
import { FaMicrophone, FaStop } from "react-icons/fa";
import { AudioPlayer } from "../listening/AudioPlayer";

interface Props {
  index: number;
  phrase: string;
  translation: string;
  audioUrl: string;
  rating: "good" | "bad" | null;
  onRate: (rating: "good" | "bad") => void;
}

export function PhraseCard({ index, phrase, translation, audioUrl, rating, onRate }: Props) {
  const [textRevealed, setTextRevealed] = useState(false);
  const [translationRevealed, setTranslationRevealed] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [userRecordingUrl, setUserRecordingUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current);
      setUserRecordingUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      stream.getTracks().forEach((t) => t.stop());
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }

  const borderColor =
    rating === "good"
      ? `border-green-200`
      : rating === "bad"
        ? `border-red-200`
        : `border-gray-100`;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-6 space-y-4 ${borderColor}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-400 font-medium">{`Phrase ${index + 1}`}</span>
        <AudioPlayer src={audioUrl} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTextRevealed((p) => !p)}
          className="cursor-pointer text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition"
        >
          {textRevealed ? `Hide phrase` : `Show phrase`}
        </button>
        <button
          onClick={() => setTranslationRevealed((p) => !p)}
          className="cursor-pointer text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition"
        >
          {translationRevealed ? `Hide translation` : `Show translation`}
        </button>
      </div>

      {(textRevealed || translationRevealed) && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
          {textRevealed && <p className="text-gray-800 font-medium">{phrase}</p>}
          {translationRevealed && <p className="text-gray-500 text-sm italic">{translation}</p>}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="cursor-pointer flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition font-medium"
            >
              <FaStop className="shrink-0" />
              {`Stop`}
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="cursor-pointer flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition"
            >
              <FaMicrophone className="shrink-0" />
              {userRecordingUrl ? `Re-record` : `Record`}
            </button>
          )}
          {userRecordingUrl && !isRecording && (
            <AudioPlayer src={userRecordingUrl} label={`Your recording`} />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onRate("good")}
            className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
              rating === "good"
                ? `bg-green-100 border-green-300 text-green-700`
                : `border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600`
            }`}
          >
            {`Easy`}
          </button>
          <button
            onClick={() => onRate("bad")}
            className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
              rating === "bad"
                ? `bg-red-100 border-red-300 text-red-700`
                : `border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600`
            }`}
          >
            {`Hard`}
          </button>
        </div>
      </div>
    </div>
  );
}
