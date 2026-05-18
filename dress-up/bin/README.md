# dress-up bin/

Deterministic tooling for the `/dress-up` pipeline. Stage 1 of the
five-stage pipeline calls these scripts; Stages 2-4 stay LLM-driven.

## mp-to-next.mjs

Ports a Magic Patterns Vite + react-router app into Next.js 16 App
Router shape. Zero LLM. ~10 seconds for a typical 4-route MP, where
the LLM-driven equivalent took ~7 minutes of sequential file writes.

### Usage

```bash
node ~/.claude/skills/dress-up/bin/mp-to-next.mjs <mp-clone-root> <out-root> [--slug <slug>]
```

- `<mp-clone-root>` — directory containing `src/App.tsx` (the shallow
  clone of the MP repo).
- `<out-root>` — the freshly-rsync'd peer-design-system clone where
  the ported app will land.
- `--slug` — name written into `package.json` and the layout title.
  Defaults to `basename(out-root)`.

Writes:

- `<out-root>/src/app/<route>/page.tsx` per MP `<Route>` declaration.
- `<out-root>/src/app/page.tsx` for any `<Route path="/" element={<Navigate to="..."/>}>`.
- `<out-root>/src/components/peer/<Name>.tsx` per MP `src/components/*.tsx`.
- `<out-root>/src/lib/store.tsx` from MP `src/AppContext.tsx` (with
  `'use client';` and a `ReactNode` import added if missing).
- `<out-root>/src/lib/mock-data.ts` from MP `src/mockData.ts`
  (overwrites the DS stub).
- `<out-root>/src/lib/types.ts` — appends MP types under a marker;
  preserves the DS's existing `Tone` / `Size` / `AgentState` types.
- `<out-root>/.dress-up/port-report.json` with the route map.

Patches:

- `<out-root>/src/app/layout.tsx` to wrap `{children}` in
  `<AppProvider>` and update the metadata title.
- `<out-root>/package.json` to add MP deps (lucide-react, framer-motion,
  etc.) and rename `prebuild` → `prebuild:audit-disabled` so Stage 1-3
  builds skip the composition audit.

### Idempotency

Rerunning the codemod overwrites pages and the mock-data file. The
types file dedupes via the `// --- MP domain types (codemod append) ---`
marker. Safe to rerun.

### Assumptions

- MP follows the Magic Patterns Vite template conventions
  (`src/App.tsx`, `src/pages/`, `src/components/`, `src/AppContext.tsx`,
  `src/mockData.ts`, `src/types.ts`).
- The output is a fresh peer-design-system clone with stub
  `src/lib/{types,mock-data}.ts` and a DS landing in
  `src/app/{layout,page}.tsx`.
- No nested `<Route>` with `<Outlet>` (codemod skips fallback Navigate
  on `path="*"` and doesn't translate `<Outlet>` to `?modal=NAME` —
  use the agent-based fallback for those).

### When the codemod doesn't fit

Use the agent-based literal-port fallback documented in `SKILL.md`'s
Beat 1.2 if:

- MP uses `<Outlet>` for nested routes.
- MP layout doesn't match the Magic Patterns Vite template.
- A specific component file has patterns the codemod's regexes don't
  catch.

The codemod is opinionated about MP shape on purpose. Don't generalize
it; if a new MP breaks it, prefer running the agent fallback for that
exercise and adding a focused fix to the codemod after.
