# dress-up bin/

Deterministic tooling for the `/dress-up` pipeline. Three scripts cover
the mechanical work that doesn't need LLM judgment: the Stage 1 port,
the Stage 4 inventory, and the Stage 4 semantic gate. Stages 2-3 stay
LLM-driven.

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

## inventory-ds.mjs

Pre-flight inventory of the peer-design-system clone for Stage 4. Extracts:
- Every primitive name + props interface + tone/variant enum, organized by
  category (ui, layout, patterns, typography, charts, agent).
- Color tokens from the DS's `globals.css`, including semantic tokens
  (warning, danger, success, info) when present.
- The Glyph icon roster (the curated icon set the DS supports) when
  present.
- The audit-script path coverage (so we know whether the audit will
  actually flag violations in `src/app/` or only `src/app/templates/`).

### Usage

```bash
node ~/.claude/skills/dress-up/bin/inventory-ds.mjs <ds-clone-root> [--out <inventory-path>]
```

- `<ds-clone-root>` — absolute path to the DS clone, e.g.
  `~/Projects/adarsh-design-system`.
- `--out <path>` — optional. Writes inventory JSON to this path. If
  omitted, prints to stdout.

Output is cached at `~/.claude/skills/dress-up/cache/ds-inventory-<hash>.json`
keyed on the DS clone's mtime hash. Re-runs against the same DS state are
~1s (cache hit). After a DS update, the next run regenerates in ~10-20s.

Stage 4 Beat 4.1 calls this script as a pre-flight step. Two outputs
feed downstream:

- If `audit_script.covers_src_app` is false, Beat 4.1 logs a warning and
  Beat 4.3 runs `stage4-primitive-check.mjs` as the gate instead.
- If `has_semantic_colors` is false, Stage 4 agents are told to KEEP raw
  Tailwind semantic colors (`bg-amber-50` etc.) rather than flatten the
  visual hierarchy.

### Assumptions

- DS uses Tailwind v4 `@theme` tokens (or `:root` CSS variables) for
  colors. If the DS uses a different convention, semantic token detection
  may miss.
- Primitives live under `src/components/{ui,layout,patterns,typography,charts,agent}/`.
- The audit script (if present) is at `scripts/audit-composition.mjs`.

## stage4-primitive-check.mjs

Semantic enforcement gate run after Stage 4's build succeeds. Catches
the "agent rolled its own Card-like div using token classes" class of
failure that the mechanical audit doesn't catch.

### Usage

```bash
node ~/.claude/skills/dress-up/bin/stage4-primitive-check.mjs <out-root> [--strict] [--json]
```

- `<out-root>` — absolute path to the dressed-up app folder.
- `--strict` — optional. Exit non-zero when violations are found.
  Default: exit 0 regardless.
- `--json` — optional. Emit JSON instead of a markdown table. Default:
  markdown.

Scans `<out-root>/src/app/` and `<out-root>/src/components/peer/` for:

- Raw `<h1>`-`<h6>` (should be `<Heading>`)
- Raw `<p className=...>` (should be `<Body>` or `<Prose>`)
- `<div>` with `border + rounded + p-N` (probably should be `<Card>`)
- `<div>` with `flex flex-col gap-N` (should be `<Stack>`)
- `<div>` with `flex items-* gap-N` (should be `<Cluster>`)
- Hex codes in className or `style={{}}` (use DS color tokens)
- `text-[Npx]` arbitrary font sizes (use `<Heading>` / `<Body>` typed sizes)
- External UI kit imports (radix, shadcn, headlessui, mantine, react-aria)

### When to run

Beat 4.3 calls this after `npm run build` passes. Violations get surfaced
to the user as a markdown table. If <10 violations, a focused cleanup
agent round can fix them; if more, the orchestrator stops and surfaces
for user review (probably means agents went rogue OR the DS is missing a
needed primitive class).

### Assumptions

- Stage 4 has already run. The script only flags patterns that should
  have been primitives by now.
- The DS exposes `<Heading>`, `<Body>`, `<Card>`, `<Stack>`, `<Cluster>`.
  If your DS uses different names, rename the suggestions in this
  script (or use the manifest to choose alternative names).
