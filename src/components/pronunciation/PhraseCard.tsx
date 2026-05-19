import { useState, useRef } from "react";
import { FaMicrophone, FaStop, FaQuestion } from "react-icons/fa";
import { AudioPlayer } from "../listening/AudioPlayer";
import { useSpeechToText } from "../../hooks/useSpeechToText";

interface Props {
  index: number;
  phrase: string;
  translation: string;
  language: string;
  audioUrl: string;
  rating: "good" | "medium" | "bad" | null;
  defaultTextRevealed?: boolean;
  defaultTranslationRevealed?: boolean;
  onRate: (rating: "good" | "medium" | "bad") => void;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ``)
    .replace(/\s+/g, ` `)
    .trim();
}

export function PhraseCard({
  index,
  phrase,
  translation,
  language,
  audioUrl,
  rating,
  defaultTextRevealed = false,
  defaultTranslationRevealed = false,
  onRate,
}: Props) {
  const [textRevealed, setTextRevealed] = useState(defaultTextRevealed);
  const [trackedTextDefault, setTrackedTextDefault] = useState(defaultTextRevealed);
  const [translationRevealed, setTranslationRevealed] = useState(defaultTranslationRevealed);
  const [trackedTranslationDefault, setTrackedTranslationDefault] = useState(
    defaultTranslationRevealed,
  );

  // When the master "show by default" toggles change, re-apply to this card
  if (trackedTextDefault !== defaultTextRevealed) {
    setTrackedTextDefault(defaultTextRevealed);
    setTextRevealed(defaultTextRevealed);
  }
  if (trackedTranslationDefault !== defaultTranslationRevealed) {
    setTrackedTranslationDefault(defaultTranslationRevealed);
    setTranslationRevealed(defaultTranslationRevealed);
  }
  const [isRecording, setIsRecording] = useState(false);
  const [userRecordingUrl, setUserRecordingUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState(``);
  const [checkRevealed, setCheckRevealed] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const sttKey = `phrase-${index}`;
  const stt = useSpeechToText({
    language,
    onTranscript: (text, key) => {
      if (key !== sttKey) return;
      setTranscript((prev) => (prev ? `${prev} ${text}` : text));
    },
  });

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
    setTranscript(``);
    setCheckRevealed(false);
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    if (stt.isSupported) stt.start(sttKey);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    stt.stop();
    setIsRecording(false);
  }

  const transcriptMatches = transcript && normalize(transcript) === normalize(phrase);

  const BORDER_BY_RATING = {
    good: `border-green-200`,
    medium: `border-yellow-200`,
    bad: `border-red-200`,
  };
  const borderColor = rating ? BORDER_BY_RATING[rating] : `border-gray-100`;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-6 space-y-4 ${borderColor}`}>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
        <span className="text-xs text-gray-400 font-medium">{`Phrase ${index + 1}`}</span>
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

      <div className="flex">
        <AudioPlayer src={audioUrl} />
      </div>

      <div className="space-y-2 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {userRecordingUrl && !isRecording && (
              <AudioPlayer src={userRecordingUrl} label={`Your recording`} small />
            )}
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
            {userRecordingUrl && !isRecording && stt.isSupported && (
              <button
                onClick={() => setCheckRevealed(true)}
                className="cursor-pointer flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition"
              >
                <FaQuestion className="shrink-0" />
                {`Check`}
              </button>
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
              onClick={() => onRate("medium")}
              className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
                rating === "medium"
                  ? `bg-yellow-100 border-yellow-300 text-yellow-700`
                  : `border-gray-200 text-gray-500 hover:border-yellow-300 hover:text-yellow-600`
              }`}
            >
              {`Medium`}
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

        {checkRevealed && (
          <p
            className={`text-sm italic ${transcriptMatches ? `text-green-600` : `text-yellow-600`}`}
          >
            {transcript || `(no speech detected)`}
          </p>
        )}
      </div>
    </div>
  );
}
