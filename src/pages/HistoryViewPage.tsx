import type { ReactElement } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCheck, FaTimes, FaMinus } from "react-icons/fa";
import { useLanguage } from "../contexts/LanguageContext";
import { AudioPlayer } from "../components/listening/AudioPlayer";
import { ClickableText } from "../components/ClickableText";
import {
  getAssessment,
  type AssessmentRecord,
  type ReadingBody,
  type ListeningBody,
  type WritingBody,
  type PronunciationBody,
} from "../utils/history";
import { loadAudio } from "../utils/audioStore";

function formatDate(ts: number | null): string {
  if (ts === null) return `In progress`;
  return new Date(ts).toLocaleString();
}

function optionStyle(
  optionIndex: number,
  correctIndex: number,
  selectedIndex: number | null,
): string {
  if (optionIndex === correctIndex) return `bg-green-50 text-green-800 font-medium`;
  if (optionIndex === selectedIndex) return `bg-red-50 text-red-700`;
  return `text-gray-500`;
}

function gradeColor(score: number): string {
  if (score >= 4) return `bg-green-100 text-green-700`;
  if (score >= 3) return `bg-yellow-100 text-yellow-700`;
  return `bg-red-100 text-red-700`;
}

function useBlobUrl(audioKey: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  if (audioKey && loaded !== audioKey) {
    setLoaded(audioKey);
    void (async () => {
      const blob = await loadAudio(audioKey);
      setUrl(blob ? URL.createObjectURL(blob) : null);
    })();
  }
  return url;
}

function ReadingView({
  record,
  body,
  language,
}: {
  record: AssessmentRecord;
  body: ReadingBody;
  language: string;
}) {
  const { exercise, selected } = body;
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 space-y-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{`Passage`}</p>
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          <ClickableText
            text={exercise.passage}
            boldWords={exercise.difficultWords.map((w) => w.source)}
            language={language}
          />
        </p>
        {exercise.translation && (
          <div className="border-t border-green-100 pt-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{`English Translation`}</p>
            <p className="text-gray-500 leading-relaxed italic text-sm whitespace-pre-wrap">
              {exercise.translation}
            </p>
          </div>
        )}
      </div>

      {exercise.questions.map((q, qi) => (
        <div key={qi} className="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
          <p className="font-medium text-gray-800 mb-3">
            {`${qi + 1}. `}
            <ClickableText text={q.question} language={language} />
          </p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <div
                key={oi}
                className={`text-sm px-3 py-2 rounded-lg ${optionStyle(oi, q.correct, selected[qi])}`}
              >
                <ClickableText text={opt} language={language} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <ScoreFooter record={record} />
    </div>
  );
}

function ListeningView({
  record,
  body,
  language,
}: {
  record: AssessmentRecord;
  body: ListeningBody;
  language: string;
}) {
  const passageUrl = useBlobUrl(body.audioKeyPassage);
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 space-y-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{`Passage`}</p>
        {passageUrl && <AudioPlayer src={passageUrl} label={`Play passage`} />}
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          <ClickableText
            text={body.exercise.passage}
            boldWords={body.exercise.difficultWords.map((w) => w.source)}
            language={language}
          />
        </p>
      </div>

      {body.exercise.questions.map((q, qi) => (
        <ListeningQuestion
          key={qi}
          index={qi}
          question={q}
          selectedIndex={body.selected[qi]}
          audioKey={body.audioKeyQuestions[qi]}
          language={language}
        />
      ))}

      <ScoreFooter record={record} />
    </div>
  );
}

function ListeningQuestion({
  index,
  question,
  selectedIndex,
  audioKey,
  language,
}: {
  index: number;
  question: { question: string; options: string[]; correct: number };
  selectedIndex: number | null;
  audioKey: string | undefined;
  language: string;
}) {
  const url = useBlobUrl(audioKey);
  return (
    <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-3">
        <p className="font-medium text-gray-800">{`${index + 1}.`}</p>
        {url && <AudioPlayer src={url} label={`Question ${index + 1}`} small />}
      </div>
      <p className="text-sm text-gray-500 mb-3">
        <ClickableText text={question.question} language={language} />
      </p>
      <div className="space-y-2">
        {question.options.map((opt, oi) => (
          <div
            key={oi}
            className={`text-sm px-3 py-2 rounded-lg ${optionStyle(oi, question.correct, selectedIndex)}`}
          >
            <ClickableText text={opt} language={language} />
          </div>
        ))}
      </div>
    </div>
  );
}

function WritingView({
  record,
  body,
  language,
}: {
  record: AssessmentRecord;
  body: WritingBody;
  language: string;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{`Passage`}</p>
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          <ClickableText
            text={body.exercise.passage}
            boldWords={body.exercise.difficultWords.map((w) => w.source)}
            language={language}
          />
        </p>
      </div>

      {body.exercise.questions.map((q, qi) => {
        const grade = body.grades[qi];
        return (
          <div
            key={qi}
            className="bg-white rounded-2xl border border-green-100 shadow-sm p-6 space-y-3"
          >
            <p className="font-medium text-gray-800">
              {`${qi + 1}. `}
              <ClickableText text={q.question} language={language} />
            </p>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
              <ClickableText text={body.answers[qi] ?? ``} language={language} />
            </div>
            {grade && (
              <div className="flex items-start gap-3 text-sm">
                <span
                  className={`shrink-0 font-semibold px-2 py-0.5 rounded-full ${gradeColor(grade.score)}`}
                >
                  {`${grade.score}/5`}
                </span>
                <span className="text-gray-600 italic">{grade.notes}</span>
              </div>
            )}
          </div>
        );
      })}

      <ScoreFooter record={record} />
    </div>
  );
}

const PRON_BORDER_BY_RATING = {
  good: `border-green-200`,
  medium: `border-yellow-200`,
  bad: `border-red-200`,
};

const PRON_ICON_BY_RATING: Record<"good" | "medium" | "bad", ReactElement> = {
  good: <FaCheck className="text-green-500" />,
  medium: <FaMinus className="text-yellow-500" />,
  bad: <FaTimes className="text-red-500" />,
};

function PronunciationView({
  record,
  body,
  language,
}: {
  record: AssessmentRecord;
  body: PronunciationBody;
  language: string;
}) {
  return (
    <div className="space-y-3">
      {body.phrases.map((p, i) => (
        <PronunciationPhraseCard
          key={i}
          index={i}
          phrase={p.phrase}
          translation={p.translation}
          audioKey={body.audioKeys[i]}
          rating={body.ratings[i]}
          language={language}
        />
      ))}
      <ScoreFooter record={record} />
    </div>
  );
}

function PronunciationPhraseCard({
  index,
  phrase,
  translation,
  audioKey,
  rating,
  language,
}: {
  index: number;
  phrase: string;
  translation: string;
  audioKey: string | undefined;
  rating: "good" | "medium" | "bad" | null;
  language: string;
}) {
  const url = useBlobUrl(audioKey);
  const border = rating ? PRON_BORDER_BY_RATING[rating] : `border-gray-100`;
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${border}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-gray-400 font-medium">{`Phrase ${index + 1}`}</span>
        {url && <AudioPlayer src={url} small />}
        {rating && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-gray-500">
            {PRON_ICON_BY_RATING[rating]}
            <span className="capitalize">{rating}</span>
          </span>
        )}
      </div>
      <p className="text-gray-800 font-medium">
        <ClickableText text={phrase} language={language} />
      </p>
      <p className="text-gray-500 text-sm italic mt-1">{translation}</p>
    </div>
  );
}

function ScoreFooter({ record }: { record: AssessmentRecord }) {
  if (record.completedAt === null) {
    return (
      <div className="text-sm text-gray-400 italic text-center">{`This assessment is still in progress.`}</div>
    );
  }
  const pct = record.scoreMax > 0 ? record.scoreEarned / record.scoreMax : 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between flex-wrap gap-3">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{`Score`}</p>
        <p className="text-2xl font-bold text-gray-800">
          {`${record.scoreEarned}/${record.scoreMax}`}
          <span className="text-base text-gray-400 font-normal ml-2">
            {`(${Math.round(pct * 100)}%)`}
          </span>
        </p>
      </div>
      {record.ratingAfter !== null && (
        <div className="text-right">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{`Rating`}</p>
          <p className="text-2xl font-bold text-gray-800">
            {record.ratingBefore !== null
              ? `${record.ratingBefore} → ${record.ratingAfter}`
              : `→ ${record.ratingAfter}`}
          </p>
        </div>
      )}
    </div>
  );
}

export function HistoryViewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const record = id ? getAssessment(id) : null;

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

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate(`/${record.mode}`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{record.title || `Untitled`}</h1>
        </div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-6 ml-9">
          {`${record.mode} · ${record.language} · Complexity ${record.difficulty} · ${formatDate(record.completedAt ?? null)}`}
        </p>

        {record.body ? (
          <BodyView record={record} language={language} />
        ) : (
          <p className="text-gray-400 italic text-center">
            {`This assessment was completed before full bodies were saved, so only the summary is available.`}
          </p>
        )}
      </div>
    </div>
  );
}

function BodyView({ record, language }: { record: AssessmentRecord; language: string }) {
  if (!record.body) return null;
  switch (record.mode) {
    case "reading":
      return <ReadingView record={record} body={record.body as ReadingBody} language={language} />;
    case "listening":
      return (
        <ListeningView record={record} body={record.body as ListeningBody} language={language} />
      );
    case "writing":
      return <WritingView record={record} body={record.body as WritingBody} language={language} />;
    case "pronunciation":
      return (
        <PronunciationView
          record={record}
          body={record.body as PronunciationBody}
          language={language}
        />
      );
  }
}
