# Nullmega Languages — frontend

Vite + React + TypeScript SPA. Practices reading, listening, writing,
pronunciation, vocabulary, and grammar in any language the user types in,
adaptively calibrated to their level via an ELO-style rating per mode.

## Sibling repositories

This project is one of three:

| Repo | Path | What lives there |
|---|---|---|
| **Frontend** (this) | `language-learning/` | UI, BYOK path, local Dexie persistence, all client-side prompt logic. |
| **Convex backend** | `../language-learning-backend-convex/` | Convex deployment, server-side prompt builders, cached `assessment` table, OpenAI key, per-user rate-limit table. |
| **Synthetic data seeder** | `../language-learning-datagen/` | Operator-only CLI that pre-populates the `assessment` table via an admin endpoint on the Convex backend. |

The frontend talks to the Convex deployment via HTTPS over `VITE_BACKEND_URL`.
BYOK users bypass it and call OpenAI directly with their own key.

## Running locally

```
npm install
npm run dev
```

Set `VITE_BACKEND_URL` in `.env.local` (or rely on the production default in
`src/utils/api.ts`).

## Check

```
npm run check
```

Runs `oxlint`, `oxfmt`, `tsc --noEmit`, ESLint, and the Vitest suite.

## Generating synthetic data

When the `assessment` pool is sparse for a given language/difficulty, new users
pay live OpenAI costs on cache miss. To pre-seed the pool, use the sidecar tool:

```
cd ../language-learning-datagen
npm install
cp .env.example .env
# fill in CONVEX_URL and DATAGEN_ADMIN_SECRET (one-time setup in its README)

npm run gen -- \
  --language Japanese \
  --mode reading \
  --length medium \
  --levels 1-100 \
  --count 2
```

This generates 2 medium-length Japanese reading passages per difficulty level
(200 total) and writes them into the live Convex `assessment` table. The seeder
bypasses the per-user rate limit and the cache-check path; it always generates.

Full docs in `../language-learning-datagen/README.md`.
