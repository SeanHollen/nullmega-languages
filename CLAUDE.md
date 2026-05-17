# Claude instructions

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
