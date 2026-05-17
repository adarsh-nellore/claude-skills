---
name: build-hifi
description: |
  Use when the user wants a refined, high-fidelity, clickable Next.js
  prototype generated from a PRD inside a pre-built design-system
  codebase. Generator, not a thinking partner. Reads the codebase's
  existing tokens, UI primitives, layout shells, and chart components,
  then writes screens + mock data that USE those primitives. Never
  invents colors, fonts, radii, shadows, or animation keyframes; never
  imports external UI kits (shadcn, radix, headlessui). Spawns the
  mock-data agent and the per-screen agents in one parallel batch so
  wall-clock time is one agent's worth of work, not N. Built for
  founding-designer exercises where the design system already exists
  and the output must look designer-made, not AI-generated. Triggers:
  "build hi-fi", "build the prototype", "generate the screens",
  "build the high-fidelity prototype", "build hifi from PRD".
  Composes downstream from /build-lofi (consumes sketch.html if
  present) and reads ./PRD.md produced by /code-ready-prd if present
  (PRD provides component inventory, data schema, state transitions,
  and tech stack the hi-fi build needs). Out of scope: synthesizing a
  design system, picking a visual direction, deploying.
license: MIT
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

## Role

Generator. The user has cloned a pre-built design-system codebase
into a project folder and dropped a PRD into it. This skill writes
the prototype's screens, mock data, and routing on top of the
existing design system. The visual fidelity of the output comes from
the codebase, not from anything this skill invents.

## Why the design system must already exist

A model asked to "build a hi-fi prototype" from a blank slate invents
generic tokens (rounded-md, blue-500, system-ui) and generic
components (default-shadcn-flavor Card, Button) and the output looks
AI-generated. To clear the "designer-made" bar in a 2-hour exercise,
the design system has to exist before this skill runs. This skill's
job is to use it, not invent it.

## Speed is the constraint

This skill exists inside a 2-hour design exercise. Optimize for
wall-clock time, not token economy. Add agents before adding
sequential steps.

- Read the PRD and the codebase's design-system manifest once on the
  main thread.
- Decide the screen list and routing on the main thread. This is the
  only sequential thinking step.
- Spawn N+1 `general-purpose` Agent calls in **one tool-call batch**:
  one for mock data, one per screen. All run concurrently.
- After the batch returns, main thread wires routing/nav and runs
  the build.
- Skip exploratory tool calls. The PRD and the codebase are the only
  inputs.

If a future enhancement adds a new output (e.g., a README update or a
demo path doc), the default move is to add another parallel agent in
the same batch, not a sequential step.

## When to run

- The user is in a time-boxed design exercise.
- A clone of the design-system codebase is the current working
  directory.
- A PRD is available (file inside the folder, or pasted into the
  conversation).
- Optionally, a `sketch.html` from `/build-lofi` is present in
  the folder.

## When NOT to run

- The folder does not contain a design-system contract (see below).
  Report what is missing and stop.
- The user has not decided on a direction and wants to explore
  alternatives first. Send them to `/build-lofi`.
- The user wants a static HTML file, not a Next.js app. This skill
  only outputs Next.js code.

## Inputs

Accept either:

1. A file path to a PRD (e.g., `PRD.md` in the project folder).
2. Pasted PRD text in the user's message.

Also accept (optional):
- A path to `sketch.html` produced by `/build-lofi`. If present,
  read the picked option's "why this pattern" prose and screen list
  to seed the prototype's IA. If absent, derive the screen list from
  the PRD's core screens section.

## Design-system contract (required in the project folder)

Before doing anything, verify the project folder contains all of:

- `package.json` with `next` as a dependency at version 14 or higher.
- `src/app/globals.css` containing a Tailwind v4 `@theme` block with
  OKLCH color tokens and semantic aliases.
- `src/components/ui/` with at least 6 typed primitive components.
- `src/components/layout/` with at least `Shell.tsx` (or equivalent),
  `LeftNav.tsx`, `TopBar.tsx`.
- `src/lib/types.ts`.
- `src/lib/mock-data.ts` (may be empty or seed-only; this skill
  populates it).
- `src/lib/chart-utils.ts` with at least `monotoneCubicPath`.

If any are missing, abort with a single message listing what is
missing and pointing the user at the design-system codebase setup.
Do NOT invent defaults.

## Generation process

### Beats 1 + 2 run in parallel

Beat 1 (read the design system) and Beat 2 (read the PRD, decide
screen list) share no inputs. Dispatch all Beat 1 reads AND Beat 2's
PRD read in **one batch of parallel tool calls**, then assemble the
manifest (Beat 1's output) and decide the screen list (Beat 2's
output) in either order. Both must complete before spawning Beat 3.

### Beat 1: Detect the contract

On the main thread:

- **Manifest cache check first.** If
  `<ds-path>/docs/MANIFEST.md` exists AND its mtime is newer than the
  newest file in `src/components/**`, use it verbatim as the
  design-system manifest and SKIP the per-file glob/read pass below.
  If MANIFEST.md is missing or stale, do the glob/read pass below AND
  run `node scripts/generate-manifest.mjs` once (in the DS root) to
  populate the cache for next time. The script is provided by the DS;
  if it does not exist, just do the manual pass.

- Read `src/app/globals.css`. Extract:
  - Color tokens and semantic aliases.
  - Typography tokens.
  - Radii and shadows.
  - General utility classes (`.glass-card`, `.section-header`, etc.).
  - **Animation keyframes** (`@keyframes fadeInUp`, `subtlePulse`,
    `chartDrawLine`, etc.).
  - **Animation utility classes** that subagents actually attach to
    elements (`.anim-fade-in-0` through `.anim-fade-in-5`,
    `.card-hover`, `.tab-content`, any other motion utilities).
- List `src/components/ui/*` via Glob. For each file, read enough to
  capture the exported component name and its prop signature (use
  Grep on `export function` and `interface` / `type` lines if helpful
  to avoid full reads).
- List `src/components/layout/*` and `src/components/charts/*`.
- Read `src/lib/types.ts` and `src/lib/mock-data.ts` to learn the
  current type and data shape.

Assemble this into a single compact "design-system manifest" string
that gets pasted into every subagent prompt. Keep the manifest under
3000 tokens; truncate verbose token blocks, just list names + values.
The animation utility class list must be complete and explicit
because subagents are required to use these.

### Beat 2: Decide screen list and routing

If `sketch.html` is present in the project folder:
- Parse the option that the user picked (if a `selected` query
  parameter or a `picked.html` file points at one, use it; otherwise
  use the recommended option from the sketch's footer).
- Extract the 3 screen labels from that option section.
- Use those as the prototype's screens.

If `sketch.html` is absent:
- Read the PRD's IA section and "core screens" section.
- Pick 4 to 6 screens that cover the PRD's primary user journey.

For each screen, decide:
- The route path (e.g., `/inconsistencies`, `/inconsistencies/[id]`).
- A one-line intent (e.g., "Triage queue with severity, confidence,
  owner inline.").
- Which layout primitives wrap it (most screens use the same Shell;
  some may need a different layout).

Output: an ordered list of `{route, intent, layouts, sourceScreenName}`
records to feed into the per-screen agents.

**Modal-heavy PRD pre-flight.** If the PRD's core-screens section
has 4 or more items labeled as "modal" or "modal (overlay)",
default to ONE cornerstone route plus URL-param overlays (via the
DS's `Drawer` primitive or equivalent) rather than separate routes
per modal. Reference pattern: `~/Documents/claimvault/` uses
`?panel=`, `?memo=`, `?state=` overlays on a single working
surface. Separate routes per modal produce sparse pages that lose
the working-context the user is supposed to keep.

### Beat 3: Generate mock data, then screens

Beat 3 is two sequential phases. The split exists because per-screen
agents must import entity data from `src/lib/mock-data.ts`, and the
mock-data agent owns writing that file. Running them in parallel
(the pre-2026-05-17 spec) caused all per-screen agents to read the
empty stub file and silently fall back to inline data, breaking the
"import from `@/lib/mock-data`" hard rule and producing ~3000 LOC of
duplicated mock data across the screens. The split adds ~5-7 min
wall-clock and eliminates that duplication entirely.

#### Beat 3a: Mock data + types (single agent, blocking)

Spawn ONE `general-purpose` Agent call. Wait for it to return before
proceeding. Wall-clock: ~7 min.

**Agent 0 (mock data):** Reads the PRD, writes
`src/lib/mock-data.ts` with domain-modeled records. Hard rules:
- Reuse the type names from the existing `src/lib/types.ts` if they
  fit; extend `src/lib/types.ts` only where needed.
- 20 to 60 records per major entity (issues, documents, contracts,
  etc.). Not 3 to 5.
- ISO 8601 timestamps. Realistic dates spread over weeks or months.
- Real domain vocabulary from the PRD (e.g., "Module 2.7 Clinical
  Summary," not "Item 1"). No lorem ipsum.
- Nested relationships where the PRD implies them (issues link to
  documents, claims link to encounters).
- Typed exports. No `any`. No `unknown` without justification.
- **Edge-case state variants.** For each major entity, produce
  parallel exports alongside the happy-path mock: `mockData.happy`
  (default), `mockData.empty` (zero records), `mockData.error` (mock
  fetch error state), `mockData.stress` (~1000 records to test
  virtualization). Reference PRD Section 21 (Edge cases) for the
  specific scenarios that need data shapes.

Returns: the path to the written file plus a count of records per
entity (including edge-case variants).

#### Beat 3b: Per-screen agents (N agents, parallel batch)

After Beat 3a returns, spawn **N** `general-purpose` Agent calls in
**one tool-call batch**, where N is the number of screens decided in
Beat 2. All N run concurrently. Wall-clock: roughly one agent's
worth of work (~6-8 min depending on cornerstone density).

**Agents 1 through N (one per screen):** Each writes one
`src/app/<route>/page.tsx`. Each agent's prompt contains:

- The full PRD (pasted).
- If `sketch.html` is present, the picked option's "why this pattern"
  paragraph (1 short paragraph).
- The design-system manifest (see Beat 1), including the explicit
  list of animation utility classes available.
- The screen's route, intent, and one-line layout note.
- The edge cases from PRD Section 21 that name this screen as the UI
  surface. Each per-screen agent must implement a `?state=<name>`
  query param that swaps the screen into the named edge-case state
  using the corresponding `mockData.<name>` variant from Agent 0.
- Hard rules (see "Hard contract" below).
- Motion requirements (see "Motion requirements" below).
- A reference example: one screen file from the same codebase or
  from `rcm-observability/src/app/overview/page.tsx` (pasted as a
  pattern source).
- Output path: `src/app/<route>/page.tsx`.
- **Mock data source.** Import all entity data from `@/lib/mock-data`
  (which Agent 0 will have populated before this agent runs, see
  Beat 3 sequencing). Do NOT inline mock data in the page file. If
  the entities you need are missing from `@/lib/mock-data` at read
  time, STOP and report. Do not silently fall back to inline data.
  The `mockData.happy / empty / error / stress` variants are the
  contract for `?state=` rendering.
- Instruction: write the file directly, return only the path + a
  one-line summary of which components were used.

**Straggler handling.** If any single agent in the batch has not
returned after 6 minutes of wall-clock AND all other agents have
already returned, do NOT keep waiting silently. Surface a one-line
status to the user: `Agent for <route> exceeded 6 min; pausing for
guidance.` The user decides: keep waiting, re-spawn that agent with
a tighter prompt, or stub that screen and continue. Do NOT auto-fall
back to a skeleton — silent quality degradation was the v4-v7
mistake. The watchdog is a stop condition, not a fallback.

### Beat 4: Wire routing and nav

After the batch returns, on the main thread:

**Beat 4 is often a no-op.** If the DS's `LeftNav` primitive takes a
per-page `sections` prop (the peer-design-system pattern), per-screen
agents already configured their own nav inline and the main thread
has nothing to wire. In that case, skip the bullets below and proceed
to Beat 5. The bullets below apply only when the DS centralizes nav
in a single editable file (e.g., a `<NavSidebar>` component with
hardcoded routes that all screens import).

- Edit `src/components/layout/LeftNav.tsx` (or equivalent) to add
  the new routes, grouped by the IA from the sketch or PRD.
- Edit `src/app/page.tsx` to redirect to the primary route, OR
  render a brief greeting that links to the prototype's entry
  screen. Match the codebase's existing pattern (check the original
  before deciding).

If the design-system codebase has a `<TopBar>` with a page title
prop, update it to render the current route's name (read from a
small routes constant if the codebase has one; otherwise leave
existing behavior).

### Beat 5: Build check

Run `npx next build` (or `npm run build` if `next` is not on the
PATH directly). Capture the exit code and the first 30 lines of
output.

- **Build passes:** continue to Beat 6.
- **Build fails:** stop. Report the first error verbatim. Do not
  attempt blind retries. The user directs the fix.

### Beat 6: Report

Print:

1. Paths to all generated screen files.
2. Path to the mock-data file plus the record counts per entity.
3. The screen list with routes and intents.
4. The differentiation axis and pattern name (if carried forward
   from `sketch.html`).
5. The dev server command: `npm run dev`.

Then stop. Do not open a browser. Do not run lighthouse, do not run
`/ux-review`. The user directs the next step.

## Hard rules

- **Single primary persona.** Every screen this skill generates serves
  ONE primary persona (the one named in `./PRD.md` Section 7).
  Secondary personas populate mock data and activity timelines but
  NEVER get dedicated screens, dashboards, or routes. Per-screen
  agents receive only the primary persona's user stories (Section 11)
  in their prompts.
- **Generate edge-case states.** Each screen must support the edge
  cases listed in `./PRD.md` Section 21 for that screen's UI surface.
  Implementation pattern: a `?state=<name>` query param (e.g.,
  `?state=empty`, `?state=error`, `?state=stress`) that swaps the
  screen into the named edge-case state. The mock-data agent produces
  parallel variants — `mockData.happy`, `mockData.empty`,
  `mockData.error`, `mockData.stress` — alongside the default
  happy-path data. Production users never see the toggle; reviewers
  (and `/ux-review`) flip it via the URL.

---

## Hard contract (the rules every per-screen agent must follow)

- **No new color values.** All colors come from CSS variables
  defined in `globals.css` or via Tailwind utility classes that
  consume those variables. No hex codes in TSX. No arbitrary
  Tailwind values like `[#fef9c3]`.
- **No new fonts.** No `next/font` imports beyond what the codebase
  already has. No Google Fonts URLs.
- **No external UI kits.** No `@radix-ui`, no `@shadcn`, no
  `@headlessui`, no `@mantine`, no `react-aria`. Only the
  codebase's own components.
- **No external icon libraries except the one already in the
  codebase.** If the codebase uses `lucide-react`, keep using it.
  If it uses inline SVG, keep that.
- **No new chart libraries.** No Recharts, no Visx, no D3 imports.
  Use the codebase's existing custom SVG chart components and
  `monotoneCubicPath` / equivalent utilities.
- **No inline `style={{...}}` except for one-off positioning** (top,
  left, transform). Colors, fonts, sizes, radii, shadows all go
  through tokens or utility classes.
- **No new animation keyframes.** Reuse the codebase's
  `anim-fade-in-*` and chart-related keyframes. But subagents MUST
  apply the existing motion utility classes per the Motion
  requirements section below; static screens are not acceptable.
- **No new files outside `src/app/<route>/` and `src/lib/`** without
  matching the codebase's existing conventions. If a needed UI
  primitive does not exist, the agent creates it in
  `src/components/ui/` following the same shape as a sibling
  (typed, OKLCH-friendly via tokens, default + variant API).
- **Next 16 Suspense rule for `useSearchParams()`.** If a per-screen
  page reads URL state via `useSearchParams()`, the default export
  must wrap its body in `<Suspense fallback={null}>`. Pattern:
  extract the body into a `*Inner` component; default export returns
  `<Suspense fallback={null}><Inner /></Suspense>`. Required by Next
  16 prerender. Pages that call `useSearchParams()` without a
  Suspense boundary fail the build with a CSR-bailout error. Applies
  to every `?modal=`, `?taskId=`, `?state=` consumer.
- **No `export const dynamic` in client pages.** `dynamic =
  "force-dynamic"` is a server-component-only export. Putting it in a
  `"use client"` file does NOT bypass the Suspense requirement and
  WILL break Next 16's RSC bundler in dev mode (`Could not find the
  module ... in the React Client Manifest`). Use Suspense, not
  `dynamic`, for client-page CSR bailout.
- **Domain vocabulary from the PRD, never lorem ipsum or generic
  placeholder text.**

## Motion requirements

Static screens are one of the strongest "AI-generated" tells. Every
screen this skill writes must carry motion in the following surfaces:

1. **Page entrance with stagger.** Top-level sections on every page
   mount with a fade-up stagger using the codebase's existing utility
   classes (e.g., `.anim-fade-in-0` through `.anim-fade-in-5`). Order
   top-down with increasing delay index: hero/strip first
   (`anim-fade-in-0`), primary content second (`anim-fade-in-1`),
   secondary content third (`anim-fade-in-2`), tertiary/footer last.
   Apply as `className` additions to the top-level section wrappers
   inside the page component.

2. **Hover transitions on interactive surfaces.** Card, Button,
   ListItem, and TableRow primitives carry hover transitions in
   their CSS via tokens. Subagents rely on the primitives' built-in
   behavior; they do NOT add hover styles inline or via Tailwind
   utility classes that override the primitive.

3. **Tab and accordion swaps.** If a screen uses tabs or accordion
   sections, the content swap uses opacity transition via the
   codebase's existing utility (e.g., `.tab-content`). No
   JS-orchestrated motion.

4. **Chart draw-in.** Chart components (Sparkline, LineChartWithBand,
   MiniAreaChart) animate their path on mount via stroke-dasharray.
   This is built into the chart components. Subagents do not animate
   paths manually.

5. **Subtle state-change indicators.** Apply `subtlePulse` or
   equivalent only where the PRD's flow specifically calls for a
   state change worth noticing (a status pill flipping from
   "Detected" to "Assigned," a notification badge appearing).
   Otherwise leave it off; gratuitous pulsing reads as marketing.

**Hard motion bans (applies to subagents):**

- No `framer-motion`, `react-spring`, `auto-animate`, `motion-one`,
  or any motion library imports.
- No inline `style={{ animation: ... }}` or `style={{ transition: ... }}`.
- No new `@keyframes` rules anywhere.
- No reliance on browser default scroll-snap or scroll-driven
  animations unless the codebase already uses them.

If the codebase's `globals.css` does not provide a needed motion
utility (for example, `.anim-fade-in-3` does not exist), the agent
must fall back to a smaller stagger using only the indexes that DO
exist, not invent new classes.

Durations should stay short: 150 to 300 ms for transitions, 600 to
800 ms total for page entrance stagger. The codebase encodes these;
subagents do not need to think about durations.

**Speed cost of motion: effectively zero.** Motion lives in
classNames the subagent adds to elements it was already writing. No
new files, no new tool calls, no new build steps, no sequential
additions to the main thread. Each subagent's prompt grows by ~300
tokens of motion rules; the per-agent reasoning cost is small and
all subagents run inside the existing parallel batch, so wall-clock
is unchanged. If a future motion rule would require a sequential
step (e.g., a separate "motion audit" pass), redesign it as a
parallel subagent in the same batch first.

## Voice rules

Apply to UI copy, mock data prose (issue titles, summaries, comments),
README updates, and any subagent-written documentation.

- No em dashes in agent-authored prose. Use periods, semicolons,
  colons, parens. Exception: strings copied verbatim from the PRD
  (section titles like "Section 5.3.5.1 — Safety Summary",
  scope_confirmation_text quotes, mock-data examples) preserve their
  PRD punctuation. Em dashes generated by the agent in headers,
  captions, banner copy, button labels, error messages, or
  reasoning-entry narration must be replaced.
- No "you" in product copy unless the brief explicitly calls for
  second-person voice. Common slip points to watch:
  - Modal descriptions ("until you confirm" → "until Priya confirms"
    or "until the reviewer confirms")
  - EmptyState body text ("if you have it" → restructure passively)
  - Error message bodies and Banner copy
  - Tooltip and help text
  Rewrite each occurrence either by naming the primary persona
  explicitly or by restructuring to passive/third-person.
- No AI slop: no decorative arrows, no fake quotes, no punchy 4-7
  word section titles, no aphoristic openers, no "X, not Y"
  parallels, no "this isn't just X" intensifiers.
- No filler ("essentially," "ultimately," "at its core," "it's worth
  noting").

Exempt: column headers, function-label glyphs, technical constants.

## For AI/agent features

When the PRD involves an AI or agent feature, reference
`/agent-states` mentally when designing screens that need to express
low confidence, hallucination, fallback, or human-in-the-loop. Each
of those states has a named UX pattern. The skill does not invoke
`/agent-states`; it just uses the patterns when generating screens.

## Stop condition

After Beat 6 reports, end the turn. Do not offer to open files, run
lighthouse, deploy, or take next steps. The user drives.

## Out of scope

- Synthesizing a design system from scratch.
- Picking the aesthetic direction.
- Designing in Paper or any visual tool.
- Authentication, user accounts, multi-tenancy.
- Real API integration.
- Deployment to Vercel or any host.
- Multi-screen state machines beyond what the PRD requires.
- E2E tests, unit tests, accessibility audits (use `/ux-review` after
  build if needed).
