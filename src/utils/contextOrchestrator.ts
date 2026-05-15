import { Flashcard, FlashcardContext, updateFlashcardContexts } from "./flashcards";
import { VocabSettings } from "./vocabSettings";
import { generateContexts } from "../hooks/useGenerateContexts";
import { callTTS } from "./api";
import { saveAudio, deleteAudioByPrefix } from "./audioStore";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

function pickVoice(): string {
  return VOICES[Math.floor(Math.random() * VOICES.length)];
}

function audioKey(cardId: string, contextIndex: number): string {
  return `flashcard-${cardId}-ctx-${contextIndex}`;
}

export async function regenerateContextsFor(
  card: Flashcard,
  settings: VocabSettings,
): Promise<void> {
  // Clear any previous audio blobs for this card
  await deleteAudioByPrefix(`flashcard-${card.id}-ctx-`);

  const generated = await generateContexts({
    word: card.source,
    translation: card.translation,
    language: card.language,
    count: settings.contextsPerCard,
  });

  const voice = pickVoice();
  const contexts: FlashcardContext[] = await Promise.all(
    generated.map(async (g, i) => {
      let key: string | null = null;
      if (settings.generateAudio) {
        try {
          const blob = await callTTS({ model: "tts-1", voice, input: g.source });
          key = audioKey(card.id, i);
          await saveAudio(key, blob);
        } catch {
          key = null;
        }
      }
      return { source: g.source, translation: g.translation, audioKey: key };
    }),
  );

  updateFlashcardContexts(card.id, contexts, Date.now());
}
