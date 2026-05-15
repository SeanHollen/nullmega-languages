# Claude instructions

## No useEffect

`useEffect` is forbidden unless there is absolutely no other option. If something happens because a user clicked something, it must be triggered by that click handler — not by a reactive effect watching state. Before reaching for `useEffect`, ask: what user action caused this? Put the logic there instead.

## Plans

Before starting any feature work, check `~/.claude/plans/` for a plan file related to this project. Read it before touching code. If the user references "the plan" or asks why something doesn't match expectations, read the plan first.

## After every prompt completion, run:

```
npm run check
```

This runs oxlint (linting) and oxfmt (formatting) across the `src/` directory and auto-fixes issues in place.
