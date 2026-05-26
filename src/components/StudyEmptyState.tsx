import { useTranslation } from "react-i18next";
import { FaCheckCircle } from "react-icons/fa";

interface Props {
  mode: "learn" | "review";
  // Vocab's learn-mode message mentions "add more cards if you ran out" because
  // users can add flashcards manually; grammar can't. This flag opts into that suffix.
  learnSuggestsAddingCards?: boolean;
}

export function StudyEmptyState({ mode, learnSuggestsAddingCards = false }: Props) {
  const { t } = useTranslation();
  const heading = mode === `learn` ? t(`You're all caught up!`) : t(`Nothing due — nice work!`);
  let subtext: string;
  if (mode === `learn`) {
    subtext = learnSuggestsAddingCards
      ? t(`No new cards to learn right now. Come back tomorrow, or add more cards if you ran out.`)
      : t(`No new cards to learn right now. Come back tomorrow for more.`);
  } else {
    subtext = t(`No cards are due for review. Your future self will thank you.`);
  }

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl border border-green-200 shadow-sm p-10 text-center space-y-3">
      <FaCheckCircle className="mx-auto text-green-500 text-5xl" />
      <p className="text-xl font-bold text-gray-800">{heading}</p>
      <p className="text-sm text-gray-600">{subtext}</p>
    </div>
  );
}
