import { beforeEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { loadSettings, saveSettings } from "./settings";

beforeEach(async () => {
  await Dexie.delete(`language-lab`);
  vi.stubEnv(`VITE_OPENAI_API_KEY`, ``);
});

describe("loadSettings", () => {
  it("returns null providers and empty backendUrl when nothing saved and no env key", async () => {
    const s = await loadSettings();
    expect(s).toEqual({ textGen: null, tts: null, backendUrl: `` });
  });

  it("falls back to VITE_OPENAI_API_KEY for both providers when nothing else is saved", async () => {
    vi.stubEnv(`VITE_OPENAI_API_KEY`, `sk-env-fallback`);
    const s = await loadSettings();
    expect(s.textGen).toEqual({ provider: `openai`, key: `sk-env-fallback` });
    expect(s.tts).toEqual({ provider: `openai`, key: `sk-env-fallback` });
  });

  it("round-trips saved provider configs and backendUrl", async () => {
    await saveSettings({
      textGen: { provider: `openai`, key: `sk-text` },
      tts: { provider: `openai`, key: `sk-tts` },
      backendUrl: `http://example.com`,
    });
    const s = await loadSettings();
    expect(s.textGen).toEqual({ provider: `openai`, key: `sk-text` });
    expect(s.tts).toEqual({ provider: `openai`, key: `sk-tts` });
    expect(s.backendUrl).toBe(`http://example.com`);
  });

  it("saving null providers clears them and falls back to env", async () => {
    vi.stubEnv(`VITE_OPENAI_API_KEY`, `sk-env`);
    await saveSettings({
      textGen: { provider: `openai`, key: `sk-explicit` },
      tts: null,
      backendUrl: ``,
    });
    let s = await loadSettings();
    expect(s.textGen?.key).toBe(`sk-explicit`);
    expect(s.tts?.key).toBe(`sk-env`);

    await saveSettings({ textGen: null, tts: null, backendUrl: `` });
    s = await loadSettings();
    expect(s.textGen?.key).toBe(`sk-env`);
    expect(s.tts?.key).toBe(`sk-env`);
  });
});
