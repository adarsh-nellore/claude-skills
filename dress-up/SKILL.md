---
name: dress-up
description: |
  Use when the user wants to convert a Magic Patterns (or any
  React+Vite+Tailwind) prototype into a high-fidelity Next.js prototype
  using the peer-design-system. Pulls the source repo from GitHub,
  preserves its IA / routes / mock-data / state management, then
  translates the visual layer into design-system primitives and enriches
  the content. Optionally reasons over a PRD + brief to expand the IA
  (add missing screens, widgets, edge cases) via a short
  AskUserQuestion gate before generation. Spawns per-screen agents in
  one parallel batch. Target wall-clock: 10-15 min, vs /build-hifi's
  25-35 min. Triggers: "dress up", "translate this MP prototype",
  "make this MP repo feel like a real product", "polish this magic
  patterns app". Composes upstream from any Magic Patterns export.
  Out of scope: synthesizing a design system, inventing IA from a PRD
  alone (use /build-hifi for that), reverse direction
  (peer-DS -> Magic Patterns).
license: MIT
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---

## Role

Translator + expander. The user has generated a working but visually
plain prototype in Magic Patterns (or similar). The IA, flows, and
component decomposition are good enough to keep. This skill replaces
the visual layer with peer-design-system primitives, ports the data /
state verbatim, and enriches sparse content. If a PRD is provided, the
skill also identifies IA gaps and offers to expand them with the
user's input.

## Why this exists (vs /build-hifi)

`/build-hifi` asks the LLM to invent everything from a PRD: routes,
screen list, component decomposition, mock-data shape, state
management, content prose. That's expensive (~25-35 min) and the IA
often doesn't match the user's actual intent. Magic Patterns
generates a working IA + components + mock data in seconds. This
skill flips the labor split:

- **Magic Patterns owns**: IA, routes, components, mock-data shape,
  state management, flow logic.
- **/dress-up owns**: clone the MP repo, port to Next.js + peer-DS,
  reason over PRD for gaps, generate hi-fi screens with rich copy.

Use `/build-hifi` when there's no MP seed (greenfield PRD).
Use `/dress-up` when there is an MP seed (or any working
React+Vite+Tailwind prototype).

## Inputs

```
/dress-up <github-url> [--prd <path>] [--brief <path>] [--out <folder>]
```

- `<github-url>` (required): the MP repo. Skill clones it.
- `--prd <path>` (optional): a code-ready PRD to drive IA expansion.
- `--brief <path>` (optional): a short notes file (extra context,
  feedback to apply).
- `--out <folder>` (optional): output folder. Default:
  `~/Documents/{slug}-dressup-<YYYY-MM-DD>/` where `<slug>` comes
  from the MP repo name.

If no PRD or brief is provided, the skill skips Beat 3 (gap analysis)
and translates MP verbatim.

## When to run

- An MP prototype exists on GitHub (or equivalent React+Vite+Tailwind
  prototype). Pure HTML or Figma-only inputs don't qualify.
- The user has the peer-design-system cloned to
  `~/Projects/adarsh-design-system`.
- The user wants design-system fidelity, not a redesign.

## When NOT to run

- The MP IA is wrong and the user wants to redesign — use `/build-hifi`
  with a fresh PRD instead.
- The user wants a static HTML sketch — use `/build-lofi`.
- The source app isn't React (e.g., Vue, Svelte) — out of scope.

## Pipeline

Target wall-clock: 10-15 min. Six beats, only one of which is open-ended
LLM reasoning (Beat 3 — and only when a PRD is provided).

### Beat 0 — Bootstrap (~30s, deterministic)

1. Parse args. Resolve `<slug>` from the GitHub repo name.
2. `git clone <github-url> /tmp/dress-up-<slug>-<timestamp>` to read MP source.
3. Resolve `<out>` folder. If it exists, error and stop (don't overwrite
   user work).
4. `cp -r ~/Projects/adarsh-design-system <out>` to seed the target
   codebase. Skip `node_modules`.
5. `cd <out>` and run `node -e` to rename the package.json `name` to
   `<slug>` (mirrors `setup.sh`).
6. Strip showcase pages that shouldn't ship in a product app:
   `rm -rf <out>/src/app/templates <out>/src/app/components`.
   (Documented bloat: /build-hifi runs ship ~12 demo pages per
   project. This is the cleanest fix.)
7. Clear `<out>/src/lib/mock-data.ts` (will be replaced from MP).
8. Reset `<out>/src/app/page.tsx` and `<out>/src/app/layout.tsx` to
   minimal stubs (will be regenerated).
9. `mkdir <out>/.dress-up` for skill working files.

### Beat 1 — Inventory the MP repo (~30s, main thread, deterministic)

Read MP repo structure without LLM calls. Magic Patterns commonly
uses a nested `src/src/` layout — handle both `src/` and `src/src/`.

Files to read:

- `package.json` — record dependencies (zustand, jotai, redux,
  react-router-dom, react-hot-toast, framer-motion, lucide-react).
- The router file (`App.tsx` / `main.tsx`) — extract `<Route>`
  elements. Map react-router paths to Next.js App Router file paths:
  - `path="/"` → `src/app/page.tsx`
  - `path="/archive"` → `src/app/archive/page.tsx`
  - `path="/archive/:taskId"` → `src/app/archive/[taskId]/page.tsx`
  - Nested `<Route>` with `<Outlet>` → use URL-param overlays
    (`?modal=launcher&taskId=...`) rather than parallel routes. This
    matches the /build-hifi cornerstone pattern and avoids Next.js
    parallel-route complexity.
- `pages/*.tsx` — record page files and their default exports.
- `components/*.tsx` — list component files. Don't read contents yet
  (Beat 5 agents read the pages they translate; component files are
  inlined into pages most of the time in MP output).
- `store.ts` / `store/*.ts` — record state management.
- `types.ts` — record type definitions.
- `lib/cn.ts` or similar utility files — record. Note if it imports
  `tailwind-merge` (MP commonly does; the DS template does not ship
  `tailwind-merge`).
- `docs/*.md` — record if present (sometimes MP includes a PRD copy).
- Any mock-data file — record path and approximate size.
- **Grep every MP `.tsx`/`.ts` file for `^import` statements** and
  collect the unique external module names (not `./` or `../`).
  Compare against the DS `package.json` `dependencies` keys. Any MP
  import not in the DS deps must be added to the install list in
  Beat 4. Common additions: `zustand`, `react-hot-toast`,
  `tailwind-merge`, `react-hook-form`, `zod`. DO NOT add
  `react-router-dom` — Next.js App Router replaces it.

Write `<out>/.dress-up/inventory.json`:

```json
{
  "mp_repo": "...",
  "mp_commit": "abc1234",
  "stack": { "react_router": true, "zustand": true, "framer_motion": true },
  "routes": [
    { "path": "/", "next_file": "src/app/page.tsx", "mp_source": "src/src/pages/Workspace.tsx", "has_outlet": true, "overlays": ["tasks/new", "tasks/:taskId/evidence", "tasks/:taskId/gaps", "tasks/:taskId/actions", "tasks/:taskId/draft"] },
    { "path": "/archive", "next_file": "src/app/archive/page.tsx", "mp_source": "src/src/pages/Archive.tsx" },
    { "path": "/archive/[taskId]", "next_file": "src/app/archive/[taskId]/page.tsx", "mp_source": "src/src/pages/Archive.tsx", "default_export": "TaskArchiveDetail" }
  ],
  "components": [...],
  "mock_data_path": "src/src/store.ts",
  "types_path": "src/src/types.ts"
}
```

### Beat 2 — DS manifest (~10s, main thread)

Glob and list the peer-DS primitives the agents will use. Don't read
component file bodies — only directory listings + the `index.ts` re-exports.

Build a static manifest block (~1500 tokens) listing every primitive
with its closed-enum props. Append this block to every per-screen
agent prompt in Beat 5. The block is the same for every agent —
build it once, reuse N times.

Write `<out>/.dress-up/ds-manifest.md`. Required sections:

**Per-primitive tone enums (CRITICAL — agents will silently regress on these).**
Each typography/tone-bearing primitive has its OWN tone union. They
are NOT interchangeable:

- `<Heading tone>`: `"ink" | "muted"`
- `<Body tone>`: `"ink" | "muted" | "faint"`
- `<MetaText tone>`: `"default" | "faint" | "faintest" | "ink"` — NO `"muted"`
- `<MetaLabel tone>`: `"default" | "muted"`
- `<Pill variant>`: `"outlined" | "filled" | "accent" | "ghost"`

Read the actual `export type ...Tone` lines from each primitive file
when building the manifest. If an enum changes upstream, the manifest
must reflect it. **Do not paraphrase. Copy verbatim.**

- Typography primitives: `<Heading size>`, `<Body size>`, `<MetaLabel>`,
  `<MetaText size>`, `<Caption size>`, `<PeerBrand size>`.
- Layout: `<Stack gap>`, `<Cluster gap>`, `<AppShell>`, `<PageContainer>`,
  `<TopNav>`, `<LeftNav>`, `<DocFrame>`, `<Drawer>`, `<Popover>`,
  `<RightRail>`, `<SplitFrame>`, `<LinkButton>`.
- UI: `<Accordion>`, `<Alert>`, `<Avatar>`, `<Badge>`, `<Banner>`,
  `<Button>`, `<Card>`, `<Checkbox>`, `<Dot>`, `<DropdownMenu>`,
  `<EmptyState>`, `<FormField>`, `<Glyph>`, `<Hairline>`,
  `<IconButton>`, `<Input>`, `<KeyChip>`, `<Modal>`, `<Pagination>`,
  `<Pill>`, `<ProgressBar>`, `<ProgressDots>`, `<Radio>`, `<Row>`,
  `<SearchInput>`, `<Select>`, `<Skeleton>`, `<Slider>`, `<Spinner>`,
  `<Stat>`, `<Stepper>`, `<Switch>`, `<Tab>`, `<TabBar>`, `<Table>`,
  `<Tabs>`, `<Tag>`, `<Textarea>`, `<TextLink>`, `<Tile>`, `<Toast>`,
  `<Tooltip>`.
- Patterns: `<PageHeader>`, `<Prose>`, `<ActionBar>`, `<FilterBar>`,
  `<KeyValue>`.
- Charts: `<BarChart>`, `<DonutChart>`, `<LineChart>`, `<Sparkline>`.
- Color tokens: `ink`, `muted`, `faint`, `faintest`, `hairline`,
  `hairline-strong`, `soft`, `stripe`, `paper`, `coral`, `coral-soft`,
  `green`, `green-soft`, `gold`, `gold-soft`, `info`, `accent-indigo`.
- Spacing buckets: `tight`, `cozy`, `comfortable`, `block`, `section`,
  `page`, `hero`.

### Beat 3 — Structural clarification questions (REQUIRED, ~1-2 min, AskUserQuestion + ONE light LLM reasoning pass)

**This beat is REQUIRED on every run. Do not skip it.** Even if no
PRD is provided, the inventory itself surfaces structural questions
the user should weigh in on before generation.

The premise: the user can't usefully answer brand/persona/density
questions blind, but they CAN answer concrete structural questions
grounded in what MP produced. Keep questions problem-focused and
short. The user's job here is to flag IA/UX decisions, not to write
a spec.

### What to ask

After Beat 1 inventory + optional PRD/brief read, the skill picks
2-4 questions from these buckets, only including a bucket if the
inventory shows a real decision in it:

1. **Missing routes / surfaces**.
   - "MP shipped N routes ({list}). Looking at the cornerstone's
     scope, it likely needs one of: a notifications view, a
     settings page, an analytics/reports view. Add any?"
   - If PRD is provided, ground the options in PRD's persona
     surfaces instead of generic guesses.
   - `multiSelect: true`.

2. **Nested flow shape**.
   - "MP's cornerstone has N nested routes ({list of overlays}).
     Should these be: ?modal= overlays (default), Drawer panels,
     or full top-level routes?"
   - One choice applies to all overlays unless the user types a
     mixed answer.

3. **Edge-case states to ship**.
   - "MP only renders the happy path. Want me to add
     ?state=empty|error|stress branches to the cornerstone? Which?"
   - `multiSelect: true`. Options: empty, error, stress, none.

4. **Cornerstone polish weighting**.
   - "Of the {N} routes, which 1-2 are the cornerstone you want
     polished hardest? I'll spend extra agent budget there
     (sub-component split, denser content, more motion)."
   - Single-select with multi-route option.

5. **Specific missing widget (only if PRD lists one MP omits)**.
   - "PRD's component inventory for {route} lists {component}
     which MP doesn't render. Add it?"

### Rules

- Cap at **4 questions total** per run. Pick the buckets with the
  highest information value for this specific MP repo. If MP shipped
  rich nested flows, bucket 2 is high-value. If MP is barebones (1-2
  routes), bucket 1 is high-value.
- Use the `AskUserQuestion` tool. One call, multiple questions.
- **Default-with-flag on skip.** For each question, define a
  sensible default before asking. If the user picks the "skip / use
  default" option (always include one), proceed with the default
  AND write the assumption to `<out>/DRESS-UP-REPORT.md`'s
  Assumptions section ("Defaulted nested flow shape to ?modal=
  overlays — no user input"). The user can flip it in a re-run.
- Questions are STRUCTURAL only. NEVER ask about brand voice, color
  palette, persona personality, copy tone. The DS dictates voice;
  MP's domain vocabulary dictates persona; the skill should not
  defer those to the user mid-run.

### Output

Write `<out>/.dress-up/ia-plan.md`:

- `## Verbatim` — list of MP routes to translate as-is.
- `## Add routes` — list of new routes (path + intent + mock-data
  notes).
- `## Add widgets` — per existing route, widgets to add.
- `## Nested flow shape` — overlay style chosen (modal / drawer /
  route).
- `## Edge-case states` — per route, `?state=` params + what each
  branch shows.
- `## Cornerstone weighting` — which routes get sub-component split
  + extra agent budget in Beat 5.
- `## Assumptions (defaulted)` — every question the user skipped,
  with the default that was applied.

### Beat 4 — Port types + state + mock data (~1 min, mostly deterministic + 1 light LLM pass)

1. Copy MP `types.ts` → `<out>/src/lib/types.ts` verbatim.
2. Copy MP store → `<out>/src/lib/store.ts`. Prepend `'use client';`
   on line 1. Zustand works in Next.js client components untouched.
   If MP uses jotai or redux, same treatment.
3. Copy MP mock data → `<out>/src/lib/mock-data.ts`. If the store and
   mock data are inlined in one file (common in MP output), keep
   them inlined.
4. Copy MP `lib/cn.ts` or equivalent → `<out>/src/lib/cn.ts`.
   If MP's `cn.ts` imports `tailwind-merge`, you have two options:
   (a) keep it and add `tailwind-merge` to deps, or
   (b) replace the file with a `clsx`-only version:
   `import clsx from 'clsx'; export const cn = clsx;`.
   Default to (a) — preserves MP behavior. Use (b) only if the user
   explicitly wants a leaner dep set.
5. If Beat 3 added new routes, widgets, or edge-case states that need
   new mock-data entries: launch ONE general-purpose agent to append
   entries to the existing arrays in `<out>/src/lib/mock-data.ts`.
   Agent must not change types or rename existing fields. Cap: one
   Edit call.
6. Update `<out>/package.json` from the Beat 1 dep-grep results.
   Common additions you'll need to install yourself (npm i):
   - `zustand` (if MP uses it)
   - `react-hot-toast` (if MP uses it)
   - `tailwind-merge` (if MP's `cn.ts` imports it)
   - `lucide-react` — **NOT in DS deps by default**, but MP commonly
     uses it for icons. Install it; the per-screen agents will use
     `import { X, Y } from 'lucide-react'` heavily.
   - `framer-motion` — already in DS; verify present
   - **Do NOT add `react-router-dom`** — Next.js App Router replaces it.
7. Run `npm install` ONCE here (before Beat 5), not in Beat 6. If
   you wait until Beat 6, the build fails with "Module not found"
   errors for every newly-added dep and you'll have to re-build.

### Beat 5 — Parallel per-screen translation (~3-5 min, N parallel LLM agents)

Spawn N agents in **one tool-call batch**. N is NOT just the route
count. It's the count after applying the cornerstone-split rule
below.

**Cornerstone-split rule (the most important rule in this skill).**
A single agent translating ~2700 LOC of MP source in one shot
produces ~2000 LOC of output, blows the LOC cap, hits ~30 audit
violations, and takes 8-10 minutes. The fix is to split the agent's
work, not to give one agent more rules.

Before spawning, compute each route's translation surface:

```
route_surface = LOC(mp_page) + sum(LOC(imported_mp_components))
```

If `route_surface > 800`:
- Split into N+1 agents for that route:
  - One **shell agent**: writes the page wrapper (TopNav, layout,
    main content frame, side panel structure). Doesn't render the
    modal bodies or the heaviest sub-panels.
  - One agent per **modal / overlay / heavy sub-panel** (typically
    the items that were nested routes in MP). Each writes a single
    sub-component file at `src/components/screens/<route>/<Name>.tsx`.
- The shell agent imports the sub-component files and renders them
  conditionally based on `?modal=` etc.
- For the Peer AI cornerstone this means: 1 shell + 1 each for
  Launcher, Evidence, Gaps, Actions, Draft → **6 agents in
  parallel** at ~150-250 LOC each, instead of 1 agent at ~2000 LOC.
  Wall-clock for the slowest agent: ~2-3 min vs the monolithic
  agent's 8-10 min.

If `route_surface ≤ 800`: one agent for the whole route is fine.

Each agent receives:

1. The **original MP page file** as a concrete reference. (This is
   the killer advantage: vastly more precise than a PRD section.
   Each agent sees exactly what to translate.)
2. The MP component files relevant to ITS scope ONLY. A modal agent
   gets the modal source + the small set of MP UI primitives it
   needs. The shell agent gets the page + sidebar source. Splitting
   the input matters — don't feed every modal source to the shell
   agent.
3. `<out>/.dress-up/ds-manifest.md` (the DS primitive inventory with
   per-primitive tone enums).
4. The relevant `ia-plan.md` excerpt for this route (widgets to add,
   edge-case states to handle).
5. The **hard contract**, **motion rules**, **voice rules**, and
   **Next 16 Suspense rule** — inlined in the agent prompt (see
   "Per-screen agent prompt template" below).
6. The **known DS quirks** block (Table generic cast, type-import
   rule — see below).

Each agent receives:

1. The **original MP page file** as a concrete reference. (This is
   the killer advantage: vastly more precise than a PRD section.
   Each agent sees exactly what to translate.)
2. The MP component files that the page imports — included inline in
   the prompt if total < 1500 lines, else just the function
   signatures.
3. `<out>/.dress-up/ds-manifest.md` (the DS primitive inventory).
4. The relevant `ia-plan.md` excerpt for this route (widgets to add,
   edge-case states to handle).
5. The **hard contract**, **motion rules**, **voice rules**, and
   **Next 16 Suspense rule** — inlined in the agent prompt (see
   "Per-screen agent prompt template" below).

Per-agent output: ONE TSX file. For shell agents that's the route's
`page.tsx`. For sub-component agents that's
`src/components/screens/<route>/<Name>.tsx`. The file must:

- **Enforce the LOC cap with teeth.** Shell pages: 200-400 LOC.
  Sub-component files: 150-300 LOC. Single-agent (non-split) pages:
  300-500 LOC. If the agent would exceed the cap, instruct it to
  STOP, return a note "needs sub-split", and not write the file.
  (Empirically: agents that go 2x over the cap also produce 5-30
  audit violations. The cap is a quality proxy, not just an
  aesthetic constraint.)
- Use peer-DS primitives only (no raw `<h1>`, `<p>`, `<div
  className="flex flex-col gap-N">`).
- Preserve MP's layout structure, modal stack pattern, banner
  pattern. Translate `<Outlet>` + nested routes to `?modal=`-driven
  overlays using `useSearchParams()`.
- Replace generic Tailwind (`bg-blue-600`, `text-zinc-900`) with
  semantic tokens applied as utility classes (`text-ink`, `bg-coral`,
  `border-hairline-strong`, `bg-soft`). NOT as `tone=` props unless
  the primitive's tone union actually includes that value (check the
  per-primitive enums in the manifest — MetaText does NOT accept
  `"muted"`, it accepts `"faint"`).
- Enrich copy: where MP renders placeholder text or thin labels,
  write domain-specific prose using the rich mock data (named
  entities, dates, counters). Don't invent new entities; use what
  exists in `mock-data.ts`.
- Add edge-case `?state=` branches identified in Beat 3.
- Wrap any default export that calls `useSearchParams()` in
  `<Suspense fallback={null}>`.
- Apply page entrance stagger via `anim-fade-in` / `anim-fade-in-1` /
  `anim-fade-in-2` classNames on top-level sections. (Note: the base
  class is `anim-fade-in` without a number suffix; numbered variants
  are 1-5.)

### Known DS quirks (must be in every agent prompt)

These trip the build deterministically. Tell every per-screen agent:

- **Table generic constraint.** `<Table<T>>` requires
  `T extends Record<string, unknown>`. Domain types from
  `@/lib/types` don't satisfy this. Cast at the use site:

  ```tsx
  const columns: TableColumn<MyType & Record<string, unknown>>[] = [...];
  // ...
  <Table<MyType & Record<string, unknown>>
    columns={columns}
    rows={rows as (MyType & Record<string, unknown>)[]}
    rowKey={(r) => r.id}
  />
  ```

- **Type-import rule.** NEVER use
  `ReturnType<typeof useTaskStore>['x'][string]` to type panel
  props or function parameters. The zustand selector type doesn't
  infer through index access cleanly and the TS check fails. Import
  the named types from `@/lib/types` directly:

  ```tsx
  import type { EvidenceItem, GapItem, ActionItem } from '@/lib/types';
  function EvidencePanel({ items }: { items: EvidenceItem[] }) { ... }
  ```

- **Fixed-width sidebars.** The DS audit fails `w-[400px]` (or any
  `w-[N≥300px]`). Use `w-[clamp(320px,28vw,420px)]` or `<SplitFrame>`
  for the 2-column shell.

- **No `framer-motion` in NEW code.** MP relies on it; replace
  `motion.div` with regular `<div>` + `anim-fade-in*` classes.
  AnimatePresence on banner stacks → conditional render with the
  fade classes. (The DS still ships framer-motion as a dep, but the
  contract is "DS owns motion, screens don't".)

### Beat 6 — Build + audit + report (~1-2 min, deterministic + 1 targeted cleanup if needed)

1. `npm install` already ran in Beat 4.7; skip it here unless Beat 5
   agents added new deps. (They shouldn't — the prompt forbids it.)
2. `npm run build` (prebuild runs the audit automatically). Capture
   output to `<out>/.dress-up/build.log`.
3. **If audit fails with mechanical violations** (text-[Npx], raw
   flex gap-N, MetaText tone="muted", etc.) — spawn ONE focused
   cleanup agent per offending file in parallel, scoped to "fix
   these N audit violations, change nothing else". This is the
   one place auto-fix is allowed because the violations are
   deterministic and the fix is mechanical. Cap: one round of
   cleanup agents. If audit still fails after that, stop and
   report.
4. **If build fails with type errors** — surface the first 30 lines
   of the error verbatim. Do not loop. The user can paste the error
   back and ask for a targeted fix. Common root causes (check
   first): missing dep that wasn't grepped in Beat 1, Table generic
   cast missing, useSearchParams without Suspense wrapper.
5. Write `<out>/DRESS-UP-REPORT.md`:
   - MP source URL + commit SHA
   - Inputs (PRD path, brief path)
   - Route map (verbatim routes + added routes)
   - Widgets added per route
   - Edge-case coverage matrix
   - **Assumptions section** — every Beat 3 question the user
     skipped + the default applied (so re-runs can target them).
   - Build status, audit violations
   - Wall-clock timing
   - `npm run dev` command + port
6. Print to user: report path + dev command. Stop.

## Per-screen agent prompt template

Each Beat 5 agent receives a prompt of this shape. Build it once with
shared sections + per-screen variable parts.

```
You are translating a Magic Patterns React page into a Next.js 16
App Router page using the peer-design-system.

## The MP source (verbatim — translate this)
{MP_PAGE_TSX_CONTENT}

## MP component files this page imports
{MP_COMPONENT_FILES}

## peer-design-system manifest (the only primitives you may import)
{DS_MANIFEST}

## Routing translation
Original react-router path: {RR_PATH}
Target Next.js file: {NEXT_FILE}
{IF_HAS_OUTLET: "Translate <Outlet>+nested-routes to ?modal=NAME
overlays driven by useSearchParams()."}

## Widgets to add (from PRD gap analysis)
{IA_PLAN_EXCERPT_WIDGETS}

## Edge-case states to handle
{IA_PLAN_EXCERPT_STATES}

## Hard contract (every rule applies)
- No new color values. All colors via DS tokens (text-ink, bg-coral, ...).
- No hex codes in className or style. No arbitrary Tailwind like [#abc].
- No new fonts. No next/font imports.
- No external UI kits (radix, shadcn, headlessui, mantine, react-aria).
- No new chart libraries. Use DS BarChart / DonutChart / LineChart /
  Sparkline only.
- No inline style={{...}} except one-off positioning (top/left/transform).
- No raw <h1>-<h6>. Use <Heading size="display|h1|h2|h3|h4">.
- No raw <p className=...>. Use <Body size="lead|body|small">.
- No raw flex flex-col gap-N. Use <Stack gap="...">.
- No raw flex items-* gap-N. Use <Cluster gap="...">.
- No <Button href>. Use <LinkButton href>.
- No new files outside src/app/{route}/ and src/lib/.
- Domain vocabulary from the mock data and PRD. Never lorem ipsum.

## Motion rules
- Page entrance stagger: top-level sections get className
  "anim-fade-in-0", "anim-fade-in-1", "anim-fade-in-2" by depth.
- Card / Button / TableRow primitives carry hover transitions
  intrinsically. Don't override.
- No framer-motion imports in NEW code. (Existing MP framer-motion
  usage may be preserved if it's already in the source file and
  removing it would break layout; prefer DS motion utilities when
  possible.)
- No inline style={{ animation: ... }} or style={{ transition: ... }}.
- No new @keyframes.

## Voice rules
- No em dashes in YOUR prose. Use periods, semicolons, colons, parens.
  (Em dashes inside string literals copied from the MP source or
  mock data are fine.)
- No "you" in product copy unless the MP source already uses second
  person. Rewrite by naming the persona or using passive voice.
- No AI slop: no decorative arrows, no fake quotes, no punchy 4-7
  word headers, no aphoristic openers, no "X, not Y" parallels.
- No filler ("essentially", "ultimately", "at its core").

## Next 16 Suspense rule
If your default export calls useSearchParams() (directly or via a
child component), wrap the export in <Suspense fallback={null}>:

  function ScreenInner() { /* all the body */ }
  export default function Screen() {
    return <Suspense fallback={null}><ScreenInner /></Suspense>;
  }

If you skip this, the build will fail with a CSR-bailout error.

## Output contract
- Write ONE file: {NEXT_FILE}
- Single self-contained TSX file (no new component files unless > 600 LOC).
- File must import only from "@/components/{ui,layout,charts,patterns,typography}",
  "@/lib/...", "next/...", "react", "react-dom", "lucide-react",
  "clsx", and (if MP used them) "zustand", "react-hot-toast",
  "framer-motion".
- Top of file: 'use client'; if the page uses any hooks (useState,
  useSearchParams, zustand store, etc.).
- Use the mock data from @/lib/mock-data and types from @/lib/types.
- Preserve MP's domain specificity in copy. Enrich where MP was thin.

Use Write, not Edit. The target file is a fresh stub.
```

## Hard contract for the main thread (the skill itself)

- **Never run `git push`, `gh pr create`, `gh repo create`, or any
  remote write.** Local clone + local generation only.
- **Never overwrite an existing `<out>` folder.** If it exists,
  error and stop.
- **Never delete the user's `~/Projects/adarsh-design-system` clone.**
  Always `cp -r` from it to `<out>`, never `mv`.
- **Never auto-loop a build-fix-rebuild cycle.** Print the error,
  stop, let the user drive.
- **Never edit MP's `/tmp/dress-up-...` clone.** Read-only.
- **Never invoke `/build-hifi` from within this skill.** They are
  separate workflows.

## Stop condition

After Beat 6 prints the report path + `npm run dev` command, end the
turn. Do not offer to start the dev server, open browsers, or take
next steps. The user drives.

## Out of scope

- Synthesizing a design system from scratch (use /build-hifi for
  greenfield).
- Inverting the direction (peer-DS → Magic Patterns).
- Auto-fixing build errors in a retry loop.
- Migrating an existing MP project in-place (always goes into a
  fresh DS clone).
- Sources that aren't React (Vue, Svelte, plain HTML).
- Authentication, user accounts, multi-tenancy, real APIs.
