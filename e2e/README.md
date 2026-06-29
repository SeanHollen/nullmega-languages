# End-to-end tests

Drives the real Vite frontend in Chromium against a real Convex deployment.
Every backend code path (validators, mutations, actions, persistence, rate
limit, error log) runs unchanged. The **only** thing mocked is the outbound
HTTP call to `api.openai.com` — that's the seam, via the `OPENAI_BASE_URL`
env var on the test deployment.

The point of this suite is to catch frontend/backend type drift bugs (e.g.
the `narratorGender: "neutral"` regression that shipped to prod) before
deploy.

## One-time setup

1. **Create a dedicated `e2e` Convex deployment**, separate from prod and dev:

   ```
   cd ../../language-learning-backend-convex
   # Create one via the Convex dashboard, OR `npx convex deploy` after
   # configuring CONVEX_DEPLOYMENT in .env.local.
   ```

   Set the deployment name to something obvious like `e2e-<something>`.

2. **Set the e2e deployment's secrets**:

   ```
   npx convex env set --deployment <e2e-deployment-name> OPENAI_API_KEY anything-the-mock-ignores
   npx convex env set --deployment <e2e-deployment-name> ALLOWED_ORIGIN http://localhost:5173
   npx convex env set --deployment <e2e-deployment-name> E2E_AUTH_BACKDOOR 1
   ```

3. **Install cloudflared** (free, no account for quick tunnels):

   ```
   brew install cloudflared
   ```

4. **Frontend env** — create `language-learning/.env.test`:

   ```
   VITE_BACKEND_URL=https://<e2e-deployment>.convex.site
   VITE_OPENAI_API_KEY=
   ```

   The empty `VITE_OPENAI_API_KEY` is required: it overrides the value in
   `.env` so the frontend does NOT run in BYOK mode (which bypasses the
   backend by calling OpenAI directly from the browser).

5. **Install Playwright browsers** (once):

   ```
   cd language-learning/e2e
   npm install
   npx playwright install chromium
   ```

6. **For the listening spec** (later) — create a silent MP3 fixture:

   ```
   ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -q:a 9 -acodec libmp3lame \
     mock-server/fixtures/silent.mp3
   ```

## Per-run workflow

Four terminals (or one tmux). The cloudflared URL changes every session — the
only mechanical step is pasting it into `npx convex env set`.

```
# Terminal 1: mock server (returns OpenAI-shaped fixtures)
cd language-learning/e2e
npm run mock                          # http://localhost:8788

# Terminal 2: cloudflared tunnel — copy the printed https://...trycloudflare.com URL
cloudflared tunnel --url http://localhost:8788

# Terminal 3: point the e2e Convex deployment at the tunnel (the /v1 suffix
# is required — the real OpenAI base is api.openai.com/v1 and the backend
# appends /chat/completions to it).
cd ../../language-learning-backend-convex
npx convex env set --deployment <e2e-deployment-name> OPENAI_BASE_URL https://<random>.trycloudflare.com/v1

# Also make sure ALLOWED_ORIGIN on the e2e deployment matches whichever
# port Vite settles on (5173, 5176, etc — Vite bumps if 5173 is taken):
npx convex env set --deployment <e2e-deployment-name> ALLOWED_ORIGIN http://localhost:5173

# Terminal 4: frontend + tests
cd ../language-learning
npm run dev -- --mode test            # picks up .env.test → e2e Convex deployment
# (in another shell, or stop & resume in this one)
cd e2e
npm run test                          # Playwright drives the frontend
```

When done, `Ctrl-C` everything. The tunnel URL dies with cloudflared.

## Adding a new spec

1. Add a fixture to `mock-server/fixtures/<scenario>.json` shaped like a real
   OpenAI chat completion response. The `content` field inside
   `choices[0].message.content` should be a JSON-stringified passage payload
   matching the schema the frontend expects (title, passage, questions, etc).

2. Add a routing rule to `mock-server/server.ts` `RULES`:

   ```ts
   { fixture: "writing-french-short.json",
     match: (p) => /writing exercise/i.test(p) && /French/.test(p) }
   ```

3. Write `tests/<flow>.spec.ts`. Drive the UI by role/text; assert against
   fields from your fixture (title, options, etc).

## Drift-catch test

The whole point. Locally edit `src/utils/tts.ts` so `pickNarratorGender()`
returns `"neutral"` always. Re-run `npm run test`. The reading spec should
fail with the 400 the frontend got in prod
(`narratorGender does not match validator`) — unless you've already fixed
that union on the backend. Revert; the suite passes again.

## What this doesn't catch

- Anything the backend handles before the OpenAI call but doesn't validate
  (e.g. silent semantic drift inside a free-form `v.string()`).
- Frontend rendering bugs that don't surface as backend errors.
- Real OpenAI behavior changes (fixtures are static).

This isn't a substitute for unit tests or a shared types package — it's the
runtime backstop. Once a shared types package lands, most type-drift bugs
won't survive `tsc`, and this suite stays useful for the runtime-only stuff.
