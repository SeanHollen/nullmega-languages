import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import type { Mode } from "../hooks/useAbility";
import {
  getHistory,
  pointsForRecord,
  type AssessmentRecord,
  type ListeningBody,
  type PronunciationBody,
  type WritingBody,
} from "../utils/history";
import { deltaColor } from "../utils/colors";
import { loadAudio } from "../utils/db";
import { useLoading } from "../contexts/LoadingContext";

interface Props {
  mode: Mode;
  language: string;
  limit?: number;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return `Just now`;
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function scoreColor(pct: number): string {
  if (pct >= 0.9) return `text-green-600`;
  if (pct >= 0.6) return `text-yellow-600`;
  return `text-red-500`;
}

function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ``);
}

async function blobUrl(key: string): Promise<string | null> {
  const blob = await loadAudio(key);
  return blob ? URL.createObjectURL(blob) : null;
}

export interface ResumeState {
  record: AssessmentRecord;
  listeningAudio?: { passageUrl: string | null; questionUrls: (string | null)[] };
  pronunciationAudioUrls?: (string | null)[];
  writingPassageUrl?: string | null;
}

export function HistoryList({ mode, language, limit = 10 }: Props) {
  const records =
    useLiveQuery(
      async () => (await getHistory(mode, language)).slice(0, limit),
      [mode, language, limit],
    ) ?? [];
  const navigate = useNavigate();
  const { beginLoading } = useLoading();
  if (records.length === 0) return null;

  async function handleResume(r: AssessmentRecord) {
    if (!r.body) {
      void navigate(`/${r.mode}`);
      return;
    }
    const task = beginLoading(`Resuming…`);
    const state: ResumeState = { record: r };
    if (r.mode === `listening`) {
      const body = r.body as ListeningBody;
      const passageUrl = body.audioKeyPassage ? await blobUrl(body.audioKeyPassage) : null;
      const questionUrls = await Promise.all(body.audioKeyQuestions.map(blobUrl));
      state.listeningAudio = { passageUrl, questionUrls };
    } else if (r.mode === `pronunciation`) {
      const body = r.body as PronunciationBody;
      state.pronunciationAudioUrls = await Promise.all(body.audioKeys.map(blobUrl));
    } else if (r.mode === `writing`) {
      const body = r.body as WritingBody;
      if (body.audioKeyPassage) {
        state.writingPassageUrl = await blobUrl(body.audioKeyPassage);
      }
    }
    void navigate(`/${r.mode}`, { state });
    task.done();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{`Recent exercises`}</h3>
        <Link
          to={`/stats/${mode}`}
          className="text-xs text-green-600 hover:text-green-700 font-medium"
        >
          {`View stats →`}
        </Link>
      </div>
      <div className="divide-y divide-gray-50">
        {records.map((r) => {
          const inProgress = r.completedAt === null;
          const pct = r.scoreMax > 0 ? r.scoreEarned / r.scoreMax : 0;
          const showRating = !inProgress && typeof r.ratingAfter === `number`;
          const hasBefore = typeof r.ratingBefore === `number`;
          const delta = showRating && hasBefore ? r.ratingAfter! - r.ratingBefore! : 0;
          const ratingClass = deltaColor(delta);
          const points = inProgress ? 0 : pointsForRecord(r);

          const inner = (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-700 truncate">{r.title || `Untitled`}</p>
                <p className="text-xs text-gray-400">
                  {inProgress ? `In progress` : relativeTime(r.completedAt!)}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs shrink-0">
                <span className="text-gray-500">{`Complexity ${r.difficulty}`}</span>
                {!inProgress && (
                  <>
                    <span className={points > 0 ? `text-green-600 font-medium` : `text-gray-400`}>
                      {`${formatScore(points)} pts`}
                    </span>
                    {showRating && (
                      <span className={`font-medium ${ratingClass}`}>
                        {hasBefore ? `${r.ratingBefore} → ${r.ratingAfter}` : `→ ${r.ratingAfter}`}
                      </span>
                    )}
                    <span className={`font-semibold ${scoreColor(pct)}`}>
                      {`${formatScore(r.scoreEarned)}/${r.scoreMax}`}
                    </span>
                  </>
                )}
                {inProgress && <span className="text-yellow-600 font-medium">{`Resume →`}</span>}
              </div>
            </>
          );

          const className =
            "flex items-center justify-between gap-3 py-2 text-sm hover:bg-gray-50 rounded-lg -mx-2 px-2 transition w-full text-left cursor-pointer";

          if (inProgress) {
            return (
              <button key={r.id} onClick={() => void handleResume(r)} className={className}>
                {inner}
              </button>
            );
          }
          return (
            <Link key={r.id} to={`/history/${r.id}`} className={className}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
