import { useRef, useState } from "react";

interface RecognitionAlternative {
  transcript: string;
}
export interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
export interface RecognitionResultList {
  length: number;
  [index: number]: RecognitionResult;
}
export interface RecognitionEvent {
  resultIndex: number;
  results: RecognitionResultList;
}
export interface RecognitionErrorEvent {
  error: string;
}
export interface RecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
export interface RecognitionConstructor {
  new (): RecognitionInstance;
}

function getRecognitionCtor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LANG_TO_BCP47: Record<string, string> = {
  English: `en-US`,
  French: `fr-FR`,
  Spanish: `es-ES`,
  German: `de-DE`,
  Italian: `it-IT`,
  Portuguese: `pt-PT`,
  Japanese: `ja-JP`,
  "Chinese (Mandarin)": `zh-CN`,
  Korean: `ko-KR`,
  Arabic: `ar-SA`,
  Russian: `ru-RU`,
  Dutch: `nl-NL`,
  Swedish: `sv-SE`,
  Polish: `pl-PL`,
  Turkish: `tr-TR`,
  Hindi: `hi-IN`,
};

function friendlyError(code: string): string {
  if (code === `no-speech`) return `No speech detected`;
  if (code === `not-allowed`) return `Microphone permission denied`;
  if (code === `audio-capture`) return `Microphone not available`;
  if (code === `network`) return `Network error during transcription`;
  if (code === `aborted`) return `Recording cancelled`;
  return code || `Recording failed`;
}

interface SessionConfig {
  lang: string;
  onTranscript: (text: string) => void;
  onError: (msg: string) => void;
  onEnd: () => void;
}

export function configureRecognition(
  recognition: RecognitionInstance,
  config: SessionConfig,
): RecognitionInstance {
  recognition.lang = config.lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  let pendingInterim = ``;
  recognition.onresult = (e) => {
    let finalText = ``;
    let interim = ``;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (finalText) {
      pendingInterim = ``;
      config.onTranscript(finalText);
    } else if (interim) {
      pendingInterim = interim;
    }
  };
  recognition.onerror = (e) => {
    pendingInterim = ``;
    config.onError(friendlyError(e.error));
  };
  recognition.onend = () => {
    if (pendingInterim.trim()) {
      const flush = pendingInterim;
      pendingInterim = ``;
      config.onTranscript(flush);
    }
    config.onEnd();
  };
  return recognition;
}

interface SessionCallbacks {
  onTranscript: (text: string, key: string) => void;
  onError: (msg: string, key: string) => void;
  onEnd: (key: string) => void;
}

export interface SpeechSession {
  start: (key: string) => void;
  stop: () => void;
}

// Non-hook session manager: tracks the active key in a local closure variable so callbacks
// see the correct key even if React state hasn't propagated yet. Each call to `start(key)`
// stops any current recognition and creates a new one whose callbacks capture `key`.
export function createSpeechSession(
  Ctor: RecognitionConstructor,
  lang: string,
  callbacks: SessionCallbacks,
): SpeechSession {
  let current: RecognitionInstance | null = null;

  function start(key: string): void {
    current?.stop();
    const recognition = configureRecognition(new Ctor(), {
      lang,
      onTranscript: (text) => callbacks.onTranscript(text, key),
      onError: (msg) => callbacks.onError(msg, key),
      onEnd: () => {
        current = null;
        callbacks.onEnd(key);
      },
    });
    recognition.start();
    current = recognition;
  }

  function stop(): void {
    current?.stop();
  }

  return { start, stop };
}

interface Options {
  language: string;
  onTranscript: (text: string, key: string) => void;
  onError?: (msg: string, key: string) => void;
}

interface Handle {
  isSupported: boolean;
  activeKey: string | null;
  start: (key: string) => void;
  stop: () => void;
}

// React-facing hook. Delegates session management to `createSpeechSession` so the closure
// always sees the correct key, regardless of React state propagation order.
export function useSpeechToText({ language, onTranscript, onError }: Options): Handle {
  const Ctor = getRecognitionCtor();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const sessionRef = useRef<SpeechSession | null>(null);

  function ensureSession(): SpeechSession | null {
    if (!Ctor) return null;
    if (sessionRef.current) return sessionRef.current;
    sessionRef.current = createSpeechSession(Ctor, LANG_TO_BCP47[language] ?? language, {
      onTranscript,
      onError: (msg, key) => onError?.(msg, key),
      onEnd: () => setActiveKey(null),
    });
    return sessionRef.current;
  }

  function start(key: string): void {
    const session = ensureSession();
    if (!session) {
      onError?.(`Speech recognition not supported in this browser`, key);
      return;
    }
    session.start(key);
    setActiveKey(key);
  }

  function stop(): void {
    sessionRef.current?.stop();
  }

  return { isSupported: Ctor !== null, activeKey, start, stop };
}
