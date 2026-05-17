import { describe, expect, it } from "vitest";
import {
  configureRecognition,
  createSpeechSession,
  type RecognitionInstance,
  type RecognitionEvent,
  type RecognitionConstructor,
} from "./useSpeechToText";

function makeFake(): RecognitionInstance {
  return {
    lang: ``,
    continuous: false,
    interimResults: false,
    onresult: null,
    onerror: null,
    onend: null,
    start: () => {},
    stop: () => {},
  };
}

function makeMockCtor(): { Ctor: RecognitionConstructor; instances: RecognitionInstance[] } {
  const instances: RecognitionInstance[] = [];
  const Ctor = function () {
    const inst = makeFake();
    instances.push(inst);
    return inst;
  } as unknown as RecognitionConstructor;
  return { Ctor, instances };
}

function resultEvent(transcript: string, isFinal: boolean): RecognitionEvent {
  return {
    resultIndex: 0,
    results: {
      length: 1,
      0: { isFinal, 0: { transcript } },
    },
  };
}

describe(`configureRecognition`, () => {
  it(`delivers a final transcript when received`, () => {
    const recognition = makeFake();
    const transcripts: string[] = [];
    configureRecognition(recognition, {
      lang: `fr-FR`,
      onTranscript: (t) => transcripts.push(t),
      onError: () => {},
      onEnd: () => {},
    });
    recognition.onresult!(resultEvent(`bonjour`, true));
    expect(transcripts).toEqual([`bonjour`]);
  });

  it(`flushes a pending interim transcript when recording ends with no final result`, () => {
    const recognition = makeFake();
    const transcripts: string[] = [];
    configureRecognition(recognition, {
      lang: `fr-FR`,
      onTranscript: (t) => transcripts.push(t),
      onError: () => {},
      onEnd: () => {},
    });
    recognition.onresult!(resultEvent(`hello world`, false));
    recognition.onend!();
    expect(transcripts).toEqual([`hello world`]);
  });

  it(`surfaces a friendly error for no-speech`, () => {
    const recognition = makeFake();
    let errorMsg = ``;
    configureRecognition(recognition, {
      lang: `fr-FR`,
      onTranscript: () => {},
      onError: (msg) => (errorMsg = msg),
      onEnd: () => {},
    });
    recognition.onerror!({ error: `no-speech` });
    expect(errorMsg).toBe(`No speech detected`);
  });

  it(`enables interim results so non-final transcripts arrive`, () => {
    const recognition = makeFake();
    configureRecognition(recognition, {
      lang: `fr-FR`,
      onTranscript: () => {},
      onError: () => {},
      onEnd: () => {},
    });
    expect(recognition.interimResults).toBe(true);
  });
});

describe(`createSpeechSession`, () => {
  it(`invokes onTranscript with the key from start() even after end fires`, () => {
    const { Ctor, instances } = makeMockCtor();
    const calls: { text: string; key: string }[] = [];
    const session = createSpeechSession(Ctor, `fr-FR`, {
      onTranscript: (text, key) => calls.push({ text, key }),
      onError: () => {},
      onEnd: () => {},
    });

    session.start(`textarea-0`);
    const inst = instances[0];
    inst.onresult!({
      resultIndex: 0,
      results: { length: 1, 0: { isFinal: false, 0: { transcript: `bonjour` } } },
    });
    inst.onend!();

    expect(calls).toEqual([{ text: `bonjour`, key: `textarea-0` }]);
  });

  it(`routes transcripts from concurrent sessions to their own keys`, () => {
    const { Ctor, instances } = makeMockCtor();
    const calls: { text: string; key: string }[] = [];
    const session = createSpeechSession(Ctor, `fr-FR`, {
      onTranscript: (text, key) => calls.push({ text, key }),
      onError: () => {},
      onEnd: () => {},
    });

    session.start(`0`);
    session.start(`1`); // starts a new recognition; old one is stopped
    instances[1].onresult!({
      resultIndex: 0,
      results: { length: 1, 0: { isFinal: true, 0: { transcript: `salut` } } },
    });
    expect(calls).toEqual([{ text: `salut`, key: `1` }]);
  });

  it(`forwards the key on errors`, () => {
    const { Ctor, instances } = makeMockCtor();
    const errors: { msg: string; key: string }[] = [];
    const session = createSpeechSession(Ctor, `fr-FR`, {
      onTranscript: () => {},
      onError: (msg, key) => errors.push({ msg, key }),
      onEnd: () => {},
    });

    session.start(`X`);
    instances[0].onerror!({ error: `no-speech` });
    expect(errors).toEqual([{ msg: `No speech detected`, key: `X` }]);
  });
});
