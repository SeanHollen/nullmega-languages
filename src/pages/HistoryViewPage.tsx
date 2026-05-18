import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { FaArrowLeft } from "react-icons/fa";
import { useLanguage } from "../contexts/LanguageContext";
import { ResultsView } from "../components/reading/ResultsView";
import { WritingResultsView } from "../components/writing/WritingResultsView";
import { PronunciationResultsView } from "../components/pronunciation/PronunciationResultsView";
import {
  getAssessment,
  type AssessmentRecord,
  type ReadingBody,
  type ListeningBody,
  type WritingBody,
  type PronunciationBody,
} from "../utils/history";
import { rebuildRatingResult } from "../hooks/useAbility";
import { loadAudio } from "../utils/db";

// Loads audio Blobs from IndexedDB into URLs once per unique key array. Pattern: track the
// "loaded for" key signature and re-run when it changes — no useEffect needed since the
// trigger is the page mounting with a given record.
function useAudioUrls(keys: (string | null | undefined)[]): (string | null)[] {
  const signature = keys.join(`|`);
  const [urls, setUrls] = useState<(string | null)[]>(() => keys.map(() => null));
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (signature !== loadedFor) {
    setLoadedFor(signature);
    setUrls(keys.map(() => null));
    void (async () => {
      const next = await Promise.all(
        keys.map(async (k) => {
          if (!k) return null;
          const blob = await loadAudio(k);
          return blob ? URL.createObjectURL(blob) : null;
        }),
      );
      setUrls(next);
    })();
  }
  return urls;
}

function ReadingHistory({
  record,
  body,
  language,
  onGoAgain,
  onHome,
}: {
  record: AssessmentRecord;
  body: ReadingBody;
  language: string;
  onGoAgain: () => void;
  onHome: () => void;
}) {
  return (
    <ResultsView
      exercise={body.exercise}
      language={language}
      selected={body.selected}
      ratingResult={rebuildRatingResult(record)}
      assessmentId={record.id}
      translations={null}
      onGoAgain={onGoAgain}
      onHome={onHome}
    />
  );
}

function ListeningHistory({
  record,
  body,
  language,
  onGoAgain,
  onHome,
}: {
  record: AssessmentRecord;
  body: ListeningBody;
  language: string;
  onGoAgain: () => void;
  onHome: () => void;
}) {
  const keys = [body.audioKeyPassage, ...body.audioKeyQuestions];
  const urls = useAudioUrls(keys);
  const passageUrl = urls[0];
  const questionUrls = urls.slice(1);
  return (
    <ResultsView
      exercise={body.exercise}
      language={language}
      selected={body.selected}
      ratingResult={rebuildRatingResult(record)}
      assessmentId={record.id}
      translations={null}
      audio={{ passageUrl, questionUrls }}
      onGoAgain={onGoAgain}
      onHome={onHome}
    />
  );
}

function WritingHistory({
  record,
  body,
  language,
  onGoAgain,
  onHome,
}: {
  record: AssessmentRecord;
  body: WritingBody;
  language: string;
  onGoAgain: () => void;
  onHome: () => void;
}) {
  return (
    <WritingResultsView
      exercise={body.exercise}
      language={language}
      answers={body.answers}
      grades={body.grades}
      ratingResult={rebuildRatingResult(record)}
      assessmentId={record.id}
      onGoAgain={onGoAgain}
      onHome={onHome}
    />
  );
}

function PronunciationHistory({
  record,
  body,
  language,
  onGoAgain,
  onHome,
}: {
  record: AssessmentRecord;
  body: PronunciationBody;
  language: string;
  onGoAgain: () => void;
  onHome: () => void;
}) {
  const audioUrls = useAudioUrls(body.audioKeys);
  return (
    <PronunciationResultsView
      phrases={body.phrases}
      language={language}
      title={body.title}
      ratings={body.ratings}
      ratingResult={rebuildRatingResult(record)}
      assessmentId={record.id}
      audioUrls={audioUrls}
      onGoAgain={onGoAgain}
      onHome={onHome}
    />
  );
}

const PAGE_TITLE: Record<AssessmentRecord["mode"], string> = {
  reading: `Reading Comprehension`,
  listening: `Listening Comprehension`,
  writing: `Writing Practice`,
  pronunciation: `Pronunciation Practice`,
};

export function HistoryViewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const record = useLiveQuery(async () => (id ? await getAssessment(id) : null), [id]);

  // useLiveQuery returns undefined until the first read resolves; treat that as "loading"
  // separately from "not found" so we don't flash the not-found state on initial paint.
  if (record === undefined) return null;

  if (!record) {
    return (
      <div className="min-h-screen bg-green-100 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(`/`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer mb-6"
          >
            <FaArrowLeft />
          </button>
          <p className="text-gray-500">{`Assessment not found.`}</p>
        </div>
      </div>
    );
  }

  const onGoAgain = () => navigate(`/${record.mode}`);
  const onHome = () => navigate(`/`);

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/${record.mode}`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{PAGE_TITLE[record.mode]}</h1>
        </div>

        {record.body ? (
          <BodyView record={record} language={language} onGoAgain={onGoAgain} onHome={onHome} />
        ) : (
          <p className="text-gray-400 italic text-center">
            {`This assessment was completed before full bodies were saved, so only the summary is available.`}
          </p>
        )}
      </div>
    </div>
  );
}

function BodyView({
  record,
  language,
  onGoAgain,
  onHome,
}: {
  record: AssessmentRecord;
  language: string;
  onGoAgain: () => void;
  onHome: () => void;
}) {
  if (!record.body) return null;
  switch (record.mode) {
    case "reading":
      return (
        <ReadingHistory
          record={record}
          body={record.body as ReadingBody}
          language={language}
          onGoAgain={onGoAgain}
          onHome={onHome}
        />
      );
    case "listening":
      return (
        <ListeningHistory
          record={record}
          body={record.body as ListeningBody}
          language={language}
          onGoAgain={onGoAgain}
          onHome={onHome}
        />
      );
    case "writing":
      return (
        <WritingHistory
          record={record}
          body={record.body as WritingBody}
          language={language}
          onGoAgain={onGoAgain}
          onHome={onHome}
        />
      );
    case "pronunciation":
      return (
        <PronunciationHistory
          record={record}
          body={record.body as PronunciationBody}
          language={language}
          onGoAgain={onGoAgain}
          onHome={onHome}
        />
      );
  }
}
