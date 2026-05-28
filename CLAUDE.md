# Claude instructions

## When the user pushes back, update THIS FILE

If the user says "stop doing X", "X is becoming a problem", "I told you already", or otherwise corrects a behavior — add a rule to this CLAUDE.md immediately. Don't only save to `~/.claude/projects/.../memory/` — memory is per-user across projects, but CLAUDE.md is what gets loaded into every conversation in THIS repo. Project-specific corrections belong here. Add the rule, then continue the task. Skipping this step means the same mistake recurs next session.

## Use zod for all external-boundary validation

Never hand-roll validators — no `typeof x === "string"` chains, `Array.isArray` ladders, or `if (!raw || typeof raw !== "object") return null` parsing. Use a zod schema with `.safeParse()` or `.parse()` and let TypeScript infer the type from the schema. This applies to: imported JSON files, LLM/HTTP API responses, file uploads, and any other data crossing a system boundary. Dexie is NOT a boundary (we own that storage and have migrations); zod isn't needed there.

## Don't comment TypeScript interface fields

When adding a new field to a TS interface or zod schema, don't write a paragraph above it explaining what it's for. The field name plus its type should communicate intent. Only comment when the role is genuinely ambiguous from the name (e.g. an opaque numeric flag, a field with a non-obvious lifecycle, an invariant that crosses files). Default to no comment.

## Comments are a code smell

If you reach for a comment to explain WHY code exists, ask whether the design is wrong. Two adjacent statements that need a paragraph to justify their adjacency probably belong in a single named function. A long "this happens here because…" comment usually means the structure failed to communicate intent. Fix the structure first. Only keep a comment when the WHY genuinely can't be encoded in names or structure (e.g. a workaround for an external bug, a non-local invariant). Never write history-explainer comments ("this used to be here, it's now elsewhere").

## One-off scripts live in `scripts/`

Browser-console scripts to repair stale state, recalibrate data, or perform a manual migration go in the `scripts/` directory at the repo root (see `scripts/recalibrate-flashcards.js`, `scripts/clean-level-descriptions.cjs`). Pattern: a self-contained IIFE that opens the IndexedDB directly, no app imports. Header comment with USAGE block explaining how to run it. Never paste these into chat — write the file.

## Keep LLM prompt additions terse

When editing `src/utils/prompts.ts`, one short line per rule or field. Aim for ≤15 words per rule. If a field is genuinely self-explanatory or optional, don't add an instruction for it at all.

## Backend location

The active backend is **Convex** at `../language-learning-backend-convex/`. The Express backend at `../language-learning-backend/` is deprecated — do not edit it. Frontend talks to Convex via `VITE_BACKEND_URL` (typically `http://127.0.0.1:3211` for local dev). HTTP routes live in `convex/http.ts`; backing actions live alongside (`convex/generate.ts`, `convex/onboarding.ts`, etc.). Start with `npx convex dev` from the convex backend repo.

## No useEffect

`useEffect` is forbidden unless there is absolutely no other option. If something happens because a user clicked something, it must be triggered by that click handler — not by a reactive effect watching state. Before reaching for `useEffect`, ask: what user action caused this? Put the logic there instead.

## Tests must be written BEFORE the change they're for

This rule applies to any task that calls for tests — bug fixes, refactors, behavior changes the user asks to be tested.

The forbidden action: writing tests AFTER the source change they're meant to verify. Tests written after implementation are biased by it — the writer subconsciously matches the test to what was built, not to what should be built. A passing-on-first-run test is meaningless.

Order:
1. Write the test first.
2. Run it. Confirm it FAILS against the current code. Paste the failure in your response.
3. Only then change the source.
4. Re-run. Confirm it now passes.

Escape hatch if this rule is somehow violated (e.g. you wrote source first by accident):
- Clone the repo to a separate working directory WITHOUT applying the source change.
- Spawn a subagent with NO knowledge of the change. Brief it only on what behavior should be tested.
- Have the subagent write tests against the unmodified copy.
- Run those tests; they must fail.
- Bring the tests back into the main repo and verify they now pass with the change.

Do NOT just write the tests yourself after the fact and demonstrate they fail by temporarily reverting source. That doesn't remove the bias.

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

## Use <Button> instead of <button> for actions

`onClick` waits for both mousedown AND mouseup before firing — a perceivable ~100ms lag on every press. Use the `<Button>` component in `src/components/Button.tsx` instead of native `<button>`. It fires on mousedown for instant feedback and still activates on Enter/Space for keyboard users.

```tsx
import { Button } from "../components/Button";

<Button onClick={handleSubmit} className="bg-green-600 ...">Submit</Button>
```

The `onClick` prop on `<Button>` is typed `() => void` (no event arg) — it's wired to `onMouseDown` and `onKeyDown` internally. Pass the same className and other props you'd pass to a native button.

When to keep native `<button>`: form submit buttons that must be triggered by Enter inside an input (`type="submit"` inside `<form>`), and the rare case where you need the click event object. When to keep `<a>` with `onClick`: browser-navigated links.

## Never use window.confirm or window.alert

Native browser dialogs are not allowed. They can't be styled, they break the app's visual language, and they're not testable or i18n-friendly. Build an in-app modal instead — the `ConfirmModal` component in `src/components/ConfirmModal.tsx` is the established pattern for confirmations. Same rule applies to `window.prompt`.

## Never write language-specific logic

The app supports any language the user types in, not a fixed list. Don't hardcode behavior, regexes, or heuristics that only work for certain languages — no "if French, do X", no per-language string-match tables ("Forme de verbe" | "Verb form" | "Konjugierte Form"), no per-language fallback chains. Find a structural / language-agnostic signal instead (HTML structure, ISO codes, token length, etc.). If a language-agnostic solution genuinely doesn't exist, stop and ask before adding a partial one.

## Don't invent probabilistic logic

If a function picks from a pool, pick uniformly from that pool. Don't add an artificial 50/50 gate before the pick unless the user specifically asked for stratified sampling. Uniform random over the actual options is the default.

## No explanatory comments above function bodies

Don't write `// This function does X because Y.` above a function. The name, signature, and contents should communicate. Only write comments where the WHY is non-obvious from the code itself (a workaround, a non-local invariant, a bug fix tied to a specific incident).

## Reuse exported types instead of redeclaring inline unions

If `NarratorGender` is exported from `types.ts`, import it. Don't write `"male" | "female"` inline in another file. The compiler won't catch the drift if the union changes.
