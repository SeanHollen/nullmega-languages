import type { Flashcard, FlashcardContext } from "./flashcards";
import { updateFlashcardContexts, patchFlashcard } from "./flashcards";
import type { VocabSettings } from "./vocabSettings";
import { generateContexts } from "../hooks/useGenerateContexts";
import { callTTS } from "./api";
import { saveAudio, deleteAudioByPrefix } from "./db";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

function pickVoice(): string {
  return VOICES[Math.floor(Math.random() * VOICES.length)];
}

// ** markers are stored on the source text so the UI can render the target word in bold,
// but they would be read aloud as "asterisk asterisk" by TTS — strip them in transit only.
function stripBold(text: string): string {
  return text.split("**").join("");
}

function audioKey(cardId: string, contextIndex: number): string {
  return `flashcard-${cardId}-ctx-${contextIndex}`;
}

export async function addMissingAudioFor(card: Flashcard, settings: VocabSettings): Promise<void> {
  if (!settings.generateAudio) return;
  if (!card.contexts.some((ctx) => !ctx.audioKey)) return;

  const voice = pickVoice();
  const updated = await Promise.all(
    card.contexts.map(async (ctx, i) => {
      if (ctx.audioKey) return ctx;
      try {
        const blob = await callTTS({ model: `tts-1`, voice, input: stripBold(ctx.source) });
        const key = audioKey(card.id, i);
        await saveAudio(key, blob);
        return { ...ctx, audioKey: key };
      } catch {
        return ctx;
      }
    }),
  );
  await updateFlashcardContexts(card.id, updated, card.dateContextGenerated);
}

export async function generateContextsFor(card: Flashcard, settings: VocabSettings): Promise<void> {
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
          const blob = await callTTS({ model: "tts-1", voice, input: stripBold(g.source) });
          key = audioKey(card.id, i);
          await saveAudio(key, blob);
        } catch {
          key = null;
        }
      }
      return { source: g.source, translation: g.translation, audioKey: key };
    }),
  );

  await updateFlashcardContexts(card.id, contexts, Date.now());
  if (card.status === "new") await patchFlashcard(card.id, { status: "learning" });
}
