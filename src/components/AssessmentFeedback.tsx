import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaThumbsUp, FaThumbsDown } from "react-icons/fa";
import { updateFeedback } from "../utils/history";
import { submitFeedback } from "../utils/api";
import { getUserId } from "../utils/user";

interface Props {
  assessmentId: string;
}

function voteButtonClass(
  selected: boolean,
  unvoted: boolean,
  selectedClasses: string,
  unvotedClasses: string,
): string {
  if (selected) return selectedClasses;
  if (unvoted) return unvotedClasses;
  return `text-gray-300 cursor-not-allowed`;
}

export function AssessmentFeedback({ assessmentId }: Props) {
  const { t } = useTranslation();
  const [voted, setVoted] = useState<boolean | null>(null);

  function vote(helpful: boolean) {
    if (voted !== null) return;
    setVoted(helpful);
    void (async () => {
      await updateFeedback(assessmentId, helpful);
      submitFeedback({ id: assessmentId, userId: await getUserId(), helpful });
    })();
  }

  const unvoted = voted === null;

  return (
    <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 flex items-center justify-between gap-4">
      <p className="text-sm text-gray-600">
        {unvoted ? t(`Was this assessment helpful?`) : t(`Thanks for the feedback!`)}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => vote(true)}
          disabled={voted !== null}
          className={`p-2 rounded-lg transition cursor-pointer ${voteButtonClass(
            voted === true,
            unvoted,
            `bg-green-100 text-green-600`,
            `text-gray-400 hover:text-green-600 hover:bg-green-50`,
          )}`}
          title={t(`Helpful`)}
        >
          <FaThumbsUp />
        </button>
        <button
          onClick={() => vote(false)}
          disabled={voted !== null}
          className={`p-2 rounded-lg transition cursor-pointer ${voteButtonClass(
            voted === false,
            unvoted,
            `bg-red-100 text-red-600`,
            `text-gray-400 hover:text-red-600 hover:bg-red-50`,
          )}`}
          title={t(`Not helpful`)}
        >
          <FaThumbsDown />
        </button>
      </div>
    </div>
  );
}
