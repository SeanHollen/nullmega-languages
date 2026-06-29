import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_DIR = join(__dirname, "fixtures");

interface Rule {
  fixture: string;
  match: (prompt: string) => boolean;
}

const RULES: Rule[] = [
  {
    fixture: "reading-japanese-medium.json",
    match: (p) => /reading comprehension/i.test(p) && /Japanese/.test(p),
  },
];

function loadFixture(name: string): unknown {
  const path = join(FIXTURE_DIR, name);
  if (!existsSync(path)) throw new Error(`fixture not found: ${name}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function summarise(body: unknown): string {
  if (!body || typeof body !== "object") return "<empty>";
  const b = body as Record<string, unknown>;
  const msgs = Array.isArray(b.messages) ? b.messages : [];
  const first = msgs[0] as { content?: unknown } | undefined;
  const content = typeof first?.content === "string" ? first.content : "";
  return `model=${String(b.model)} prompt[0..120]="${content.slice(0, 120).replace(/\s+/g, " ")}"`;
}

const app = express();
app.use(express.json({ limit: "10mb" }));

app.post(["/chat/completions", "/v1/chat/completions"], (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const prompt = messages
    .map((m: { content?: unknown }) => (typeof m.content === "string" ? m.content : ""))
    .join("\n");
  const rule = RULES.find((r) => r.match(prompt));
  console.log(`[mock] /chat/completions  ${summarise(req.body)}`);
  if (!rule) {
    console.log(`[mock] ↳ NO MATCH — add a rule for this prompt`);
    res.status(500).json({
      error: { message: "mock: no fixture matched this prompt; add a rule in mock-server/server.ts" },
    });
    return;
  }
  console.log(`[mock] ↳ ${rule.fixture}`);
  res.json(loadFixture(rule.fixture));
});

app.post(["/audio/speech", "/v1/audio/speech"], (_req, res) => {
  const path = join(FIXTURE_DIR, "silent.mp3");
  if (!existsSync(path)) {
    res.status(500).json({ error: { message: "mock: fixtures/silent.mp3 missing" } });
    return;
  }
  res.setHeader("Content-Type", "audio/mpeg");
  res.send(readFileSync(path));
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT ?? 8788);
app.listen(PORT, () => {
  console.log(`[mock] listening on http://localhost:${PORT}`);
  console.log(`[mock] fixture dir: ${FIXTURE_DIR}`);
  console.log(`[mock] rules: ${RULES.map((r) => r.fixture).join(", ")}`);
});
