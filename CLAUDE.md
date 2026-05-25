# Claude instructions

## Backend location

The active backend is **Convex** at `../language-learning-backend-convex/`. The Express backend at `../language-learning-backend/` is deprecated — do not edit it. Frontend talks to Convex via `VITE_BACKEND_URL` (typically `http://127.0.0.1:3211` for local dev). HTTP routes live in `convex/http.ts`; backing actions live alongside (`convex/generate.ts`, `convex/onboarding.ts`, etc.). Start with `npx convex dev` from the convex backend repo.

## No useEffect

`useEffect` is forbidden unless there is absolutely no other option. If something happens because a user clicked something, it must be triggered by that click handler — not by a reactive effect watching state. Before reaching for `useEffect`, ask: what user action caused this? Put the logic there instead.

## Reproduce bugs with a test before fixing

If the user points out a bad behavior or bug, it is unacceptable to fix it without first writing a test that reproduces it. The test must fail against the current code, then pass after the fix. This applies to every reported bug, no matter how obvious the fix seems.

## Plans

Before starting any feature work, check `~/.claude/plans/` for a plan file related to this project. Read it before touching code. If the user references "the plan" or asks why something doesn't match expectations, read the plan first.

## After every prompt completion, run:

```
npm run check
```

This runs oxlint (linting) and oxfmt (formatting) across the `src/` directory and auto-fixes issues in place.

## Don't write defensive runtime validation in internal code

No `throw new Error(...)` for "unexpected value" branches on parameters whose type the compiler already constrains. Trust the type system.

Validate at the boundary where the data actually comes from outside our control: user-pasted JSON, external API responses, file uploads. Dexie is NOT that boundary — it's our own storage with migrations. Reading from Dexie, trust the type. If the on-disk shape changes, write a migration; don't sprinkle `typeof raw.x === "number" ? raw.x : DEFAULTS.x` checks in load functions. Those checks are noise that obscures intent and never actually fires in practice.

## Use `undefined`, not `null`, for absent/optional values

Optional parameters are `gender?: NarratorGender`, not `gender: NarratorGender | null`. Use `null` only when an existing API forces it.

## Never write language-specific logic

The app supports any language the user types in, not a fixed list. Don't hardcode behavior, regexes, or heuristics that only work for certain languages — no "if French, do X", no per-language string-match tables ("Forme de verbe" | "Verb form" | "Konjugierte Form"), no per-language fallback chains. Find a structural / language-agnostic signal instead (HTML structure, ISO codes, token length, etc.). If a language-agnostic solution genuinely doesn't exist, stop and ask before adding a partial one.

## Don't invent probabilistic logic

If a function picks from a pool, pick uniformly from that pool. Don't add an artificial 50/50 gate before the pick unless the user specifically asked for stratified sampling. Uniform random over the actual options is the default.

## No explanatory comments above function bodies

Don't write `// This function does X because Y.` above a function. The name, signature, and contents should communicate. Only write comments where the WHY is non-obvious from the code itself (a workaround, a non-local invariant, a bug fix tied to a specific incident).

## Reuse exported types instead of redeclaring inline unions

If `NarratorGender` is exported from `types.ts`, import it. Don't write `"male" | "female"` inline in another file. The compiler won't catch the drift if the union changes.
