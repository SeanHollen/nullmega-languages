import { useState } from "react";
import { FaThumbsUp, FaThumbsDown } from "react-icons/fa";
import { updateFeedback } from "../utils/history";
import { submitFeedback } from "../utils/api";

interface Props {
  assessmentId: string;
}

export function AssessmentFeedback({ assessmentId }: Props) {
  const [voted, setVoted] = useState<boolean | null>(null);

  function vote(helpful: boolean) {
    if (voted !== null) return;
    setVoted(helpful);
    updateFeedback(assessmentId, helpful);
    submitFeedback({ id: assessmentId, helpful });
  }

  return (
    <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 flex items-center justify-between gap-4">
      <p className="text-sm text-gray-600">
        {voted === null ? `Was this assessment helpful?` : `Thanks for the feedback!`}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => vote(true)}
          disabled={voted !== null}
          className={`p-2 rounded-lg transition cursor-pointer ${
            voted === true
              ? `bg-green-100 text-green-600`
              : voted === null
                ? `text-gray-400 hover:text-green-600 hover:bg-green-50`
                : `text-gray-300 cursor-not-allowed`
          }`}
          title={`Helpful`}
        >
          <FaThumbsUp />
        </button>
        <button
          onClick={() => vote(false)}
          disabled={voted !== null}
          className={`p-2 rounded-lg transition cursor-pointer ${
            voted === false
              ? `bg-red-100 text-red-600`
              : voted === null
                ? `text-gray-400 hover:text-red-600 hover:bg-red-50`
                : `text-gray-300 cursor-not-allowed`
          }`}
          title={`Not helpful`}
        >
          <FaThumbsDown />
        </button>
      </div>
    </div>
  );
}
