import type { Flashcard, FlashcardContext } from "./flashcards";
import { updateFlashcardContexts, patchFlashcard } from "./flashcards";
import type { VocabSettings } from "./vocabSettings";
import { recordLearnedToday } from "./vocabSettings";
import { generateContexts } from "../hooks/useGenerateContexts";
import { pickVoice, tts } from "./tts";
import { saveAudio, deleteAudio } from "./db";

// Unique audio-key suffix per context so newly-generated audio never collides with
// the audio of a kept (unseen) context that happens to occupy the same array index.
function audioKey(cardId: string): string {
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `flashcard-${cardId}-ctx-${rand}`;
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
    contexts.map(async (ctx) => {
      if (ctx.audioKey) return ctx;
      try {
        const blob = await tts(ctx.source, voice, `phrase`, language);
        const key = audioKey(cardId);
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
  await updateFlashcardContexts(card.id, updated, card.contextsRefreshedAt);
}

export async function generateContextsFor(card: Flashcard, settings: VocabSettings): Promise<void> {
  // Keep contexts the user has never been shown — regenerating them would burn LLM
  // and TTS spend on material they would have seen anyway. Only the seen ones (which
  // the user is already familiar with) get evicted to make room for fresh material.
  const kept = card.contexts.filter((ctx) => !ctx.seen);
  const dropped = card.contexts.filter((ctx) => ctx.seen);

  for (const ctx of dropped) {
    if (ctx.audioKey) await deleteAudio(ctx.audioKey);
  }

  const need = Math.max(0, settings.contextsPerCard - kept.length);

  let combined: FlashcardContext[];
  if (need === 0) {
    combined = kept;
  } else {
    const generated = await generateContexts({
      word: card.source,
      translation: card.translation,
      includeTranslation: settings.includeTranslationInContexts,
      language: card.language,
      count: need,
    });
    const fresh: FlashcardContext[] = generated.map((g) => ({
      source: g.source,
      translation: g.translation,
      audioKey: null,
    }));
    combined = [...kept, ...fresh];
  }

  const finalContexts = settings.generateAudio
    ? await populateAudio(card.id, combined, pickVoice(), card.language)
    : combined;

  await updateFlashcardContexts(card.id, finalContexts, Date.now());
  await patchFlashcard(card.id, { contextCursor: 0 });
  if (card.status === "new") await promoteToLearning(card.id);
}

async function promoteToLearning(cardId: string): Promise<void> {
  await patchFlashcard(cardId, { status: "learning" });
  await recordLearnedToday(1);
}
