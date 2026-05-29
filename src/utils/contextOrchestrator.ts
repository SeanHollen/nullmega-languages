import type { Flashcard, FlashcardContext } from "./flashcards";
import { updateFlashcardContexts, patchFlashcard } from "./flashcards";
import type { VocabSettings } from "./vocabSettings";
import { recordLearnedToday } from "./vocabSettings";
import { generateContexts } from "../hooks/useGenerateContexts";
import { pickVoice, tts } from "./tts";
import { saveAudio, deleteAudioByPrefix } from "./db";

function audioKey(cardId: string, contextIndex: number): string {
  return `flashcard-${cardId}-ctx-${contextIndex}`;
}

// Ensure each context has an audioKey. Contexts whose audioKey is already set are left
// alone. TTS failures fall through silently and leave that context's audioKey unset, so
// a subsequent retry can fill it in.
async function populateAudio(
  cardId: string,
  contexts: FlashcardContext[],
  voice: string,
  language: string,
): Promise<FlashcardContext[]> {
  return await Promise.all(
    contexts.map(async (ctx, i) => {
      if (ctx.audioKey) return ctx;
      try {
        const blob = await tts(ctx.source, voice, `phrase`, language);
        const key = audioKey(cardId, i);
        await saveAudio(key, blob);
        return { ...ctx, audioKey: key };
      } catch {
        return ctx;
      }
    }),
  );
}

export async function addMissingAudioFor(card: Flashcard, settings: VocabSettings): Promise<void> {
  if (!settings.generateAudio) return;
  if (!card.contexts.some((ctx) => !ctx.audioKey)) return;
  const updated = await populateAudio(card.id, card.contexts, pickVoice(), card.language);
  await updateFlashcardContexts(card.id, updated, card.dateContextGenerated);
}

export async function generateContextsFor(card: Flashcard, settings: VocabSettings): Promise<void> {
  await deleteAudioByPrefix(`flashcard-${card.id}-ctx-`);

  const generated = await generateContexts({
    word: card.source,
    translation: card.translation,
    includeTranslation: settings.includeTranslationInContexts,
    language: card.language,
    count: settings.contextsPerCard,
  });

  const fresh: FlashcardContext[] = generated.map((g) => ({
    source: g.source,
    translation: g.translation,
    audioKey: null,
  }));
  const contexts = settings.generateAudio
    ? await populateAudio(card.id, fresh, pickVoice(), card.language)
    : fresh;

  await updateFlashcardContexts(card.id, contexts, Date.now());
  if (card.status === "new") await promoteToLearning(card.id);
}

async function promoteToLearning(cardId: string): Promise<void> {
  await patchFlashcard(cardId, { status: "learning" });
  await recordLearnedToday(1);
}
