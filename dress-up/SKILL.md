---
name: dress-up
description: |
  Use when the user wants to convert a Magic Patterns (or any
  React+Vite+Tailwind) prototype into a high-fidelity Next.js prototype
  using the peer-design-system. Runs as a five-stage pipeline with TWO
  user-review gates at the dev server:

  - Stage 0-1: clone MP, port routing-only into Next.js (raw Tailwind
    preserved). User reviews the seed at http://localhost:3053.
  - Stage 2-3: skill audits MP against the PRD/brief with forced section
    citations, surfaces missing surfaces / agent states / edge cases /
    drift, asks the user 2-4 grounded structural questions, then ADDS
    scaffolding (additive only) to the seed in raw Tailwind. User
    reviews structural changes at the dev server and can make manual
    edits.
  - Stage 4: sweep src/app/ and translate raw Tailwind into
    peer-design-system primitives with full composition contract,
    motion, voice, and known-DS-quirks discipline.

  Phase 1 priorities (in order): answer the OG brief 1:1; get feel /
  flow / IA right; volume + decent content quality (not hyper-realistic
  prose); edge cases and extras are nice-to-haves. Phase 1 places
  components SIMPLY so Phase 2 can do heavier visual lifting.

  Compute is liberal — parallel agents per route, plus split-into-
  sub-agents per item when scope is 3+ independent changes. Wall-clock
  is the constraint; compute is not. Spawns one parallel batch per
  stage. Target wall-clock: ~12-18 min total (best case ~10 min if
  user accepts defaults).

  Triggers: "dress up", "translate this MP prototype", "make this MP
  repo feel like a real product", "polish this magic patterns app",
  "analyze the prototype", "finish dress-up", "dress-up resume".

  Composes upstream from any Magic Patterns export. Out of scope:
  synthesizing a design system, inventing IA from a PRD alone (use
  /build-hifi for that), reverse direction (peer-DS → Magic Patterns),
  sources that aren't React.
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

Five-stage pipeline with two checkpoint reviews:

```
Stage 0 — Bootstrap (deterministic, ~30s)
Stage 1 — Routing-only port (parallel agents, ~2-3 min)
   ↓
[Checkpoint #1: dev server runs MP as-is in Next.js, user reviews]
   ↓
Stage 2 — Analysis + user dialog (~3-4 min)
Stage 3 — Add scaffolding (parallel-liberal, ~2-5 min)
   ↓
[Checkpoint #2: dev server reloads with structural changes, user reviews
 + makes manual edits if desired]
   ↓
Stage 4 — DS translation (parallel-liberal, ~5-7 min) + build + cleanup
```

Phase 1 (Stages 0-3) adds STRUCTURAL scaffolding to the MP seed in raw
Tailwind. Phase 2 (Stage 4) is JUST visual translation to peer-DS.
Reversing the order eliminates redo waste (no screen styled twice).

## Why two phases + this order

The mechanical jobs (port to Next.js, apply DS primitives) and the
design jobs (reason about gaps, add agent states, add edge cases) are
cognitively different. Asking one agent to do both at once produces
"MP with a coat of paint" — the mechanical job wins and PRD context
gets neglected.

Splitting them: Stage 3 does structural work in raw Tailwind (cheap to
write, easy to evaluate); Stage 4 translates that finished structure
to DS primitives. Each agent has one cognitive mode. Stage 4 can go
deeper on visual fidelity because translation is its only job.

User can BAIL after Checkpoint #1 (seed looks wrong) or after
Checkpoint #2 (structural changes are wrong) before burning Stage 4
time.

## Phase 1 priorities (apply throughout Stages 2-3)

1. **Answer the OG brief 1:1.** The brief (PRD §intro + persona +
   JTBD, or the --brief notes file) is what the exercise gets graded
   on. PRD-cited findings = brief asks MP doesn't address.
2. **Feel / flow / IA / aesthetic thinking.** Beyond brief — these
   land in the Structural category at Beat 2.3.
3. **Volume + decent content quality.** Enough realistic content to
   read as a product; NOT hyper-realistic. Don't burn tokens
   perfecting copy.
4. **Edge cases and extras are nice-to-haves.** Add if cheap; skip if
   they'd blow the time budget.

Phase 1 places components SIMPLY (raw `<div className="...">` wrappers
are fine) so Phase 2 can do heavier visual lifting.

## Compute is liberal; wall-clock is the constraint

Spawn MORE parallel agents whenever it actually reduces wall-clock
without hurting quality. The caps in this skill are for
coordination / quality (one agent's scope is too big to reason about
coherently), NOT to save compute. Don't artificially serialize work
that could run in parallel.

Concretely:
- Stage 1: cornerstone-split when MP source for one route > 800 LOC.
- Stage 3: split into per-item sub-agents when a route's scope has 3+
  independent additions.
- Stage 4: cornerstone-split when Stage 3 output for one route > 800 LOC.

## When to run

- An MP prototype exists on GitHub. Pure HTML or Figma-only doesn't
  qualify.
- User has the peer-design-system cloned at
  `~/Projects/adarsh-design-system`.
- A PRD (`--prd <path>`) is strongly recommended. Without one,
  Stage 2 analysis is shallow.

## When NOT to run

- The MP IA is wrong AND user wants full redesign with no MP seed —
  use `/build-hifi` instead.
- Source is Vue / Svelte / plain HTML — out of scope.
- Static sketch only — use `/build-lofi`.

## Inputs and invocation

Three commands cover the whole pipeline. Each writes a checkpoint file
in `<out>/.dress-up/` so the next invocation knows what's done.

### Stage 0-1 (initial)

```
/dress-up <github-url> [--prd <path>] [--brief <path>] [--out <folder>]
```

- `<github-url>` (required): MP repo URL. Skill clones it.
- `--prd <path>` (optional but recommended): code-ready PRD for Stage 2
  citations.
- `--brief <path>` (optional): short notes file (extra context, user's
  problem framing).
- `--out <folder>` (optional): output folder. Default:
  `~/Documents/{slug}-dressup-<YYYY-MM-DD>/`.

Runs Stage 0 + Stage 1. Starts dev server. Prints Stage 2 command.

### Stage 2-3 (analysis + scaffolding)

```
/dress-up <github-url> --analyze [--prd <path>] [--brief <path>]
```

Verifies Stage 1 checkpoint, runs Stages 2 + 3. Reloads dev server.
Prints Stage 4 command.

If `--prd` was passed at Stage 1, the path is in the checkpoint and
doesn't need to be re-passed. Re-pass to override.

### Stage 4 (DS translation)

```
/dress-up <github-url> --finish [--notes <path>] [--notes-text "..."]
```

Verifies Stage 3 checkpoint, runs Stage 4 (DS translation + build +
audit + cleanup). Prints final report path + dev URL.

Optional `--notes` / `--notes-text`: user's feedback after Checkpoint
#2 (gets routed to relevant Stage 4 agents).

## Hard contract for the main thread (the skill itself)

- **Never run `git push`, `gh pr create`, `gh repo create`, or any
  remote write.** Local clone + local generation only.
- **Never overwrite an existing `<out>` folder.** If it exists during
  a fresh invocation (no `--analyze` / `--finish`), error and stop.
- **Never delete the user's `~/Projects/adarsh-design-system` clone.**
  Always `cp -r`, never `mv`.
- **Never auto-loop a build-fix-rebuild cycle** beyond the one round
  of cleanup agents in Stage 4 Beat 4.3.
- **Never edit MP's `/tmp/dress-up-mp-...` clone.** Read-only.
- **Never auto-run the next stage.** Each stage stops at its
  checkpoint; user must explicitly invoke the next command.

---

# STAGE 0 — Bootstrap (~30s, deterministic, no LLM)

1. Parse args. Resolve `<slug>` from the GitHub repo name (kebab-case).
2. Resolve `<out>` folder. If it exists, error and stop.
3. `git clone --depth 1 <github-url> /tmp/dress-up-mp-<slug>-<timestamp>`
   (read-only reference). Record the commit SHA.
4. `cp -r ~/Projects/adarsh-design-system <out>`. Skip `node_modules`.
5. Rename `<out>/package.json` `name` to `<slug>`.
6. Strip showcase pages: `rm -rf <out>/src/app/templates <out>/src/app/components`.
   Clear `<out>/src/lib/mock-data.ts` stub.
7. **Disable the audit hook for Stages 1-3.** Rename
   `<out>/package.json` `prebuild` script key to
   `prebuild:audit-disabled`. (Stage 4 Beat 4.1 renames it back.)
8. `mkdir <out>/.dress-up`. Write `<out>/.dress-up/bootstrap-done.json`:

```json
{
  "stage": 0,
  "completed_at": "ISO-8601",
  "mp_repo": "<github-url>",
  "mp_commit": "<sha>",
  "mp_clone": "<temp path>",
  "out": "<absolute path>",
  "slug": "<slug>",
  "prd_path": "<absolute or null>",
  "brief_path": "<absolute or null>"
}
```

---

# STAGE 1 — Routing-only port (~10-15s with codemod, ~2-3 min with agent fallback)

## Beat 1.1 — Inventory MP + dep grep (~30s, main thread)

Read MP repo structure without LLM. Handle both `src/` and the common
Magic Patterns `src/src/` nested layout.

Files to record:

- `package.json` — list deps (zustand, react-hot-toast, framer-motion,
  lucide-react, tailwind-merge, etc.).
- Router file (`App.tsx` / `main.tsx`) — extract `<Route>` elements.
  Map to Next.js App Router file paths:
  - `path="/"` → `src/app/page.tsx`
  - `path="/archive"` → `src/app/archive/page.tsx`
  - `path="/archive/:id"` → `src/app/archive/[id]/page.tsx`
  - Nested `<Route>` with `<Outlet>` → `?modal=NAME` URL params on
    the parent route.
- `pages/*.tsx` — page files + default exports.
- `components/*.tsx` — file list + sizes.
- `store.ts` / `store/*.ts` — state lib.
- `types.ts` — type defs.
- `lib/cn.ts` — note if it imports `tailwind-merge`.
- `docs/*.md` — present? (sometimes MP includes a PRD copy).
- Mock-data file — path + size.

**Dep grep:** grep every MP `.tsx`/`.ts` for `^import` statements,
including multi-line imports (`import {\\n  Foo,\\n  Bar\\n} from 'lucide-react'`).
Collect unique external module names. Compare against DS deps. Anything
missing goes on the Beat 1.2 install list.

Common additions: `zustand`, `react-hot-toast`, `tailwind-merge`,
`lucide-react`. **NEVER add `react-router-dom`** — Next.js replaces it.

Save inventory to `<out>/.dress-up/inventory.json`.

## Beat 1.2 — Run the mp-to-next codemod (~5s, no LLM)

**This is the default path.** A deterministic Node script does every
mechanical transformation Stage 1 needs:

```bash
node ~/.claude/skills/dress-up/bin/mp-to-next.mjs <mp-clone-root> <out-root> --slug <slug>
```

What it does:

- Parses MP `src/App.tsx` for the `<Route>` declarations and builds
  the Next.js App Router file map (`/login` → `src/app/login/page.tsx`,
  `/foo/:id` → `src/app/foo/[id]/page.tsx`, etc.).
- Handles `<Route path="/" element={<Navigate to="..."/>}>` by writing
  a `src/app/page.tsx` with `redirect(...)`. Skips `path="*"` fallback
  Navigate entries (Next.js handles 404 via `not-found.tsx`).
- For every page + component file: rewrites `react-router-dom` imports
  to `next/navigation` + `next/link`, renames `useNavigate` →
  `useRouter` (call site too, not just import), `navigate(x)` →
  `router.push(x)`, `<Link to=>` → `<Link href=>`, adds typed params
  for `useParams<{x: string}>()`, rewrites `../AppContext` →
  `@/lib/store`, `../mockData` → `@/lib/mock-data`, `../types` →
  `@/lib/types`, `../components/Foo` → `@/components/peer/Foo`.
- Detects hook usage and prepends `'use client';`. Adds a TODO comment
  for `useSearchParams` so the porter can wrap in `<Suspense>` manually.
- For PAGE files only: converts named `export const Foo: React.FC =`
  to `export default function Foo(...)`. Components keep their named
  exports.
- Patches `<out>/src/app/layout.tsx` to wrap `{children}` in
  `<AppProvider>` from `@/lib/store` and updates metadata title to the
  slug.
- Patches `<out>/package.json`: adds MP deps that aren't already there
  (lucide-react, framer-motion, react-hot-toast, zustand, etc.) and
  renames `prebuild` → `prebuild:audit-disabled` so Stages 1-3 builds
  don't run the composition audit.
- Writes a JSON report to `<out>/.dress-up/port-report.json`.

The codemod is idempotent: rerunning it overwrites pages, replaces the
DS mock-data stub, and dedup-appends MP types under a marker. Safe to
rerun if the first attempt fails partway.

After the codemod, run `npm install` once. Total Beat 1.2 wall-clock
on a typical MP: ~5-10 seconds (sub-second codemod + ~5-10 seconds for
install).

### Fallback: per-route literal-port agents (~2-3 min parallel)

Use ONLY when the codemod can't handle the MP shape:

- MP uses nested `<Route>` with `<Outlet>` (codemod doesn't translate
  to `?modal=NAME` yet — needs LLM judgment).
- MP uses `react-query` / `swr` / `zustand` with non-trivial setup
  that needs adjustment.
- MP isn't using the Magic Patterns Vite template layout (no
  `src/App.tsx`, no `src/pages/`, etc.).
- A specific component's source has unusual patterns the codemod's
  regexes don't catch.

Spawn one agent per route in ONE parallel batch. Cornerstone-split
when a route's source LOC > 800 (one shell agent + N sub-component
agents). Wall-clock = slowest agent, not sum.

Per-route literal-port agent prompt:

```
You are doing a LITERAL PORT of one Magic Patterns React page to
Next.js 16 App Router. Do not redesign. Do not enrich content. Do
not swap raw <div> for primitives. Just make it work in Next.js.

## Target file (write here)
{NEXT_FILE_PATH}

## Source files to read
- {MP_PAGE_PATH} — the page (your primary input)
- {MP_COMPONENT_PATHS} — any MP components this page imports

## Job

1. Translate react-router → Next.js App Router:
   - Replace `react-router-dom` imports with `next/navigation` +
     `next/link`.
   - `navigate('/foo')` → `useRouter().push('/foo')`.
   - `<Link to="/foo">` → `<Link href="/foo">` from `next/link`.
   - `<Outlet>` + nested routes → `?modal=NAME` URL params consumed via
     `useSearchParams()`.
   - `useParams()` from react-router → `useParams()` from
     `next/navigation`. For Next 16 dynamic routes the param type is
     `Promise<{...}>` for server components; use the React `use()`
     hook in client components.

2. Add `'use client';` at the top if any hook is used.

3. Wrap default export in `<Suspense fallback={null}>` if the page
   calls `useSearchParams()` (directly or via a child). Next 16 fails
   the build with CSR-bailout error otherwise.

4. Preserve every `<div className="...">` and every Tailwind class
   verbatim from MP. Including `bg-blue-600`, `text-zinc-900`,
   `gap-2`, `flex flex-col`. Do NOT swap raw HTML for DS primitives.

5. Inline sub-component logic from `./components/...` into the page
   file as named functions (or into separate files under
   `src/components/screens/<route>/` if cornerstone-split applies).

6. Imports:
   - `react`, `next/navigation`, `next/link`
   - `react-hot-toast`, `lucide-react`, `framer-motion` (keep MP's
     usage — Stage 4 may strip)
   - `@/lib/store`, `@/lib/types`, `@/lib/mock-data`, `@/lib/cn`
   - `clsx` (transitively via cn)

7. DO NOT add new content, widgets, features, motion, or structure.

## Output

Use Write. Report: "Ported {LOC} LOC" in one line at end.
```

## Beat 1.4 — Build + dev server + checkpoint (~30s)

1. `cd <out> && npm run build` (audit disabled; this is just `next build`).
2. If build fails: surface first 30 lines verbatim, stop. Common roots:
   missing Suspense wrapper, missing dep Beat 1.1 didn't catch.
3. Start dev server in background: `PORT=3053 npm run dev &`. Capture
   PID. Wait ~3s for "Ready".
4. Write `<out>/.dress-up/stage1-done.json` with route map, wall-clock,
   PID, dev port.
5. Print to user:

```
Stage 1 complete in <wall-clock>. <N> routes ported.
Dev server: http://localhost:3053

→ Open it. You'll see the MP app rendered in Next.js as-is.
  This is the "seed" — no changes, no design system applied.

When you're ready for analysis + scaffolding (Stage 2-3), run:
  /dress-up <mp-url> --analyze [--prd <path>] [--brief <path>]
```

**STOP.** Do not auto-run Stage 2.

---

# STAGE 2 — Analysis + user dialog (~7-9 min for a comprehensive PRD; ~4-5 min for a thin one)

Wall-clock observed on the Peer AI Source Conflict Resolution exercise
(20-section PRD + 7-flow walkthrough + ~20 findings across 5 categories):
- Beat 2.2 parallel agents: ~3.5 min
- Beat 2.3 synthesis: ~3 min
- Beat 2.5 scope contract: ~3 min
- Dialog: variable (user time, excluded)

For thinner PRDs the synthesis + scope steps drop proportionally.
The 4-min hard caps apply per-agent in Beat 2.2 only; main-thread
work in Beats 2.3 and 2.5 scales with content density.

Stage 2 surfaces BOTH lenses on the seed: spec gaps (PRD/lofi vs MP code)
AND experienced friction (walking through the running dev server as the
persona). Two parallel agents handle the lenses; the main thread
synthesizes, dialogs, and writes the scope contract that Stage 3 will
implement from.

## Beat 2.1 — Verify checkpoint + load context (~10s, main thread)

Verify `<out>/.dress-up/stage1-done.json` exists. If not, error.

Load PRD path and `--brief` path from `<out>/.dress-up/bootstrap-done.json`
(written at Stage 0). If no PRD, proceed with degraded Agent A that
only has the brief; flag this in the report.

Read `dev_server.url` from `stage1-done.json`. Confirm the cornerstone
route returns HTTP 200:

```bash
curl -s -o /dev/null -w "%{http_code}" "${DEV_URL}${CORNERSTONE_ROUTE}"
```

If non-200, restart the dev server (use the PID + command from
`stage1-done.json`) before spawning Agent B. Update the checkpoint with
the new PID. Agent B fails fast if the server is unreachable; don't let
it spend Playwright budget discovering that.

## Beat 2.2 — Spawn Agents A + B in ONE parallel batch (~3-4 min wall-clock)

Both agents run as general-purpose Agent tool calls in a SINGLE
tool-call message. Wall-clock equals the slower agent.

### Agent A — Spec audit

```
You are auditing a ported Magic Patterns prototype against its PRD
and (if present) a brief notes file + lofi sketch JSON. Output is a
section-by-section spec audit. NO usability commentary (that's a
sibling agent's job; you'd be guessing because you don't have a
browser).

## Inputs to read

- PRD: {PRD_PATH}
- Brief notes (if present): {BRIEF_PATH}. The brief is the user's
  product-thinking steering. Treat it as PRD-cited candidate signal:
  anything the brief explicitly asks for (e.g., "Priya works across
  3-4 docs — propose cross-doc surfaces") gets surfaced in your audit
  with the same weight as a PRD-cited gap. The PRD is the contract;
  the brief is what the user wants beyond the contract. If the brief
  is absent, skip this consideration; don't invent product-thinking
  proposals on your own (that's not your role).
- Lofi concepts.json (if present): {LOFI_CONCEPTS_PATH}
- MP-derived source under {OUT_ROOT}/src/:
  - src/app/**/*.tsx (routes)
  - src/components/peer/*.tsx (ported components)
  - src/lib/{store.tsx, mock-data.ts, types.ts}

## Output

Write {OUT_ROOT}/.dress-up/spec-audit.md with EXACTLY this structure:

# Spec Audit — {SLUG}

## Brief-fidelity scan
Enumerate PRD §intro + persona + JTBD core asks verbatim with section
citations. For each, mark yes/partial/no — does the ported MP address
it? List "no" items first; these are PRD-cited gaps the synthesis step will surface as default-on at the dialog.

## Surface inventory
PRD §10 (UI Surface Inventory) vs what {OUT_ROOT}/src/app/ ships.
List missing routes with PRD § + persona use case. List extra routes
not in PRD.

## Component inventory gaps
PRD §14 (Component Inventory) diffed against src/components/peer/.
Per missing component: PRD § + what it does + where it goes.

## Agent state coverage
For each route, cross-reference PRD §17 (Agent Capability Specs) and
the 13 patterns from ~/.claude/skills/agent-states/SKILL.md:
- Currently expresses: <list with where in source>
- PRD requires also expressing: <list with citations>
- Recommended pattern: <e.g., "low_confidence → underline + side panel
  with confidence chip and source link">

## Edge case coverage
PRD §21 categories × routes. Table:
| Route | empty | error | stress | permission | data | temporal |
Mark present | missing | N/A per cell. Note: missing edge cases land
in the Workflow or PRD-cited category at synthesis depending on
whether the PRD §21 row is explicit and whether the missing case
breaks a success criterion.

## PRD-MP drift
Places PRD and MP code DISAGREE (not just where MP omits). Per drift:
- PRD §N says: <verbatim>
- MP shows: <observation with file:line>
- Possible reasons: (a) user iterated MP since PRD, (b) MP wasn't
  built to spec
- Options: (1) keep MP, (2) conform to PRD, (3) log as assumption

If no contradictions: "No PRD-MP drift detected."

## Mock-data depth
PRD §15 (Data Schema) + §18 (Mock Data Examples) name specific
entities, states, dates. Check src/lib/mock-data.ts.
Bias: existing mock-data is "good enough" unless wrong or missing a
state the PRD names. Don't rewrite for polish.

## Hard rules

- EVERY finding cites a PRD section number. No PRD § cite, no finding.
- If a PRD § referenced doesn't actually exist in the document, write
  "PRD missing: §X expected" — never fabricate.
- No tiering yet. No recommendations yet. Report what is, with cites.
  Main thread tiers in Beat 2.3.
- 600 LOC hard cap on spec-audit.md. 4 minutes hard cap on wall-clock.
  If over budget, stop and return what's complete plus a one-line
  note about what was skipped.
```

### Agent B — Persona walkthrough

```
You are walking a working prototype as the primary persona from the
PRD. Output is a friction log: every observed missing affordance,
confusing label, unclear state, slow path, or dead-end UI. Use
Playwright MCP. Take screenshots at every meaningful state.

## Inputs to read

- Persona block (only): PRD §7 (or the section labeled "Personas"),
  primary persona ONLY. Don't scroll past it.
- Dev server URL: {DEV_URL} (from {OUT_ROOT}/.dress-up/stage1-done.json)
- Lofi concepts.json (if present, for flow list): {LOFI_CONCEPTS_PATH}

## Flows to walk (in order)

For Peer AI cornerstone (section editor): use this default set. For
other PRDs, derive 4-6 flows from the cornerstone's "primary surface"
description + the lofi concepts list.

1. Open the section editor (cornerstone)
2. Click an amber CitationChip → verify drawer opens
3. Resolve a HIGH-confidence conflict (recommended source pre-picked)
4. Resolve a LOW-confidence conflict (cr-2 PFS, no recommendation)
5. Dismiss a conflict with a reason
6. Apply-to-all → propagation report with blocked section
7. Try to access /submissions/{ID}/audit as the writer role

## Per flow

1. Navigate to the route.
2. Take screenshot named flow-{N}-{step}.png under {OUT_ROOT}/.dress-up/screens/
3. Click through; screenshot after each meaningful state change.
4. Log every friction with type + one-line description + screenshot path.

Friction types (use exactly these):
- missing affordance — user has no way to do something the persona needs
- confusing label — text doesn't communicate the action or state
- unclear state — UI doesn't tell user what just happened or what's possible
- slow path — too many clicks for a frequent action
- no error feedback — failure state has no indication
- dead-end UI — flow ends without resolution or next step

## Output

Write {OUT_ROOT}/.dress-up/walkthrough-friction.md with EXACTLY this
structure:

# Walkthrough Friction — {SLUG}

## Persona
{One-paragraph paraphrase of the primary persona; cite PRD §7.}

## Flow 1 — {name}
Route walked: {route}
Steps: {N steps}
Friction:
- [missing affordance] One-line description (screens/flow-1-3.png)
- [unclear state] ...

## Flow 2 — {name}
...

## Cross-flow patterns
Friction observed in 2+ flows. Likely systemic. E.g.:
- "Confirm" buttons inconsistently labeled across drawer / modal
- No success toast after any resolve action

## Hard rules

- NO PRD references. Don't grep the PRD for what's "supposed" to be
  there. Report only what you see in the running prototype.
- NO recommendations. Don't say "should add X". Just report friction.
- NO design opinions ("looks dated", "needs polish"). Stick to
  functional friction.
- Every friction has a screenshot path. No screenshot, no item.
- 400 LOC hard cap on walkthrough-friction.md. 4 minutes hard cap on
  wall-clock (Playwright spin-up included).
- If you can't reach the dev server, STOP immediately. Don't synthesize
  fake friction from the code; that defeats the purpose. Surface the
  error in walkthrough-friction.md and exit.
- Close the browser cleanly at the end (mcp__playwright__playwright_close).
```

## Beat 2.3 — Main-thread synthesis (~1-3 min, no agent — scales with finding count)

Read both agent outputs:
- {OUT_ROOT}/.dress-up/spec-audit.md
- {OUT_ROOT}/.dress-up/walkthrough-friction.md
- {OUT_ROOT}/.dress-up/bootstrap-done.json (for `brief_path`, if a brief notes file was passed at Stage 0)

If either agent output is missing or marked errored, STOP and surface
to user. Do not synthesize from one alone — that defeats the dual-lens
design.

### Grouping by category, not tier (load-bearing rule)

Prior versions of this skill used Tier 1 / Tier 2 / Tier 3 priority
labels. Don't. Tiering forces ONE judgment call about "how important"
each finding is BEFORE the user sees it, and that judgment biased
toward small surgical wins and buried structural findings under
generic "Tier 2 with 13 items." The user can't pick what they can't
see.

Instead, classify every finding into ONE of FIVE categories. The
category communicates WHAT the finding is (its type). The default at
the dialog communicates WHETHER it's included by default. WHAT and
WHETHER are different signals; don't conflate them with a single
priority number.

### The five categories

| Category | Default at dialog | What goes here |
|---|---|---|
| **PRD-cited** | All checked | Findings where the PRD explicitly asks for X (or describes X as part of the spec inventory) and MP doesn't have it. Agent A's primary output. |
| **Structural / IA / new surfaces** | All checked | Findings that imply ANY of: a new route, IA reorganization (surfaces merged / split / role-changed), a new top-level surface or modal class, a workflow capability the existing UI doesn't have, or a permission-model shift. |
| **Workflow** | All checked | Findings that improve cross-flow behavior: mode switching, batch operations, categorization affecting downstream filters, prediction surfaces, review queues, audit-trail-on-actions. |
| **Polish** | None checked | Localized UX fixes: missing affordance on one element, confusing label, unclear state visualization, slow-path within a single flow, micro-defensibility add. |
| **Drift** | Single-select reconciliation | PRD vs MP disagreements, not gaps. |

### Classification rules (apply to every finding deterministically)

1. **PRD-cited**: the finding cites a specific PRD section AND describes a gap (PRD says X; MP doesn't have X). Agent A's typical output.
2. **Structural**: at least one of: implies a new route; implies surface reorganization; implies a new modal/overlay class; enables a workflow capability the existing UI doesn't support; changes who sees what (permission shift). Most of Agent B's CROSS-FLOW patterns land here.
3. **Workflow**: improves how the persona moves across surfaces. Mode switching, batch operations, categorization, prediction, review queues, audit surfacing on destructive actions. Often from B's cross-flow patterns.
4. **Polish**: localized UX fix, single element/flow scope, no surface or behavior change at the IA level.
5. **Drift**: PRD says X, MP shows Y, but both work. Not a gap, a disagreement.

A finding can match multiple categories. Assign to the MOST IMPACTFUL one in this priority: **Structural > Workflow > PRD-cited > Polish > Drift**. (PRD-cited beats Polish but ties with Structural — if a PRD-cited gap is ALSO Structural, classify as Structural; this prevents structural items from being buried just because the PRD also mentions them.)

### Scope tag on every finding (S / M / L)

Include a scope estimate per finding:
- **S** — one widget on existing route, ~30-60 LOC of changes
- **M** — new component or behavior addition, ~100-200 LOC across 1-2 files
- **L** — new route + new component + new mock-data, ~200-400 LOC across 3+ files

The dialog uses scope tags to communicate cost without re-introducing tiers. Default-on categories show `[L]` items so the user can opt out if cost is too high.

Write {OUT_ROOT}/.dress-up/phase1-analysis.md:

```markdown
# Phase 1 Analysis — {SLUG}

## Sources
- Agent A spec audit: spec-audit.md ({LOC} LOC, ran in {DURATION})
- Agent B persona walkthrough: walkthrough-friction.md ({LOC} LOC,
  {N} screenshots, ran in {DURATION})
- Brief notes (if present): {BRIEF_PATH}

## Merged findings

| ID | Source | Category | Scope | Finding | PRD § |
|----|--------|----------|-------|---------|-------|
| F-1 | both | PRD-cited | M | <description that fuses A's spec finding with B's friction observation> | §17 |
| F-2 | A | PRD-cited | M | <spec-only finding> | §10 |
| F-14 | B | Structural | L | <new-surface finding> | §10, §12 |
| F-11 | B | Structural | M | <IA-level finding> | §10 |
| F-8 | B | Workflow | S | <workflow finding> | §8, §12 |
| F-9 | A | Polish | S | <small UX finding> | §5 |
| D-1 | A | Drift | — | <drift item> | §20 |
...

## Default-include picks (by category)

PRD-cited (all default-on):
- F-1 [M]: <one-line>
- F-2 [M]: <one-line>

Structural / IA / new surfaces (all default-on):
- F-14 [L]: <one-line>
- F-11 [M]: <one-line>

Workflow (all default-on):
- F-8 [S]: <one-line>

Polish (default off, opt-in):
- F-9 [S]: <one-line>

Drift (single-select reconciliation):
- D-1 [—]: <one-line>
```

### Dedup rules

Two findings collapse to one row when:
- A's spec gap and B's friction describe the same hole (e.g., A:
  "PRD §17 calls for AskStatsAction" + B: "low-conf drawer
  dead-ends" → ONE row, Source=both)
- A's missing-component and B's missing-affordance map to the same
  user-facing element
- Two B friction items in different flows root-cause to the same
  missing piece

Don't collapse:
- A spec gap + B observation that are about different things (even
  if same route)
- Two related-but-distinct frictions ("apply-to-all toggle unlabeled"
  vs. "no preview of which sections are affected")

## Beat 2.4 — User dialog (~1 min, AskUserQuestion)

One multiSelect question PER category that has findings (skip empty
categories). Plus one single-select for Drift. Cap 4 questions total —
if more than 4 categories have content, surface PRD-cited + Structural +
Workflow + Drift as the four (Polish defaults to none-included if not
asked).

Question shape (each question is a multiSelect with up to 4 options;
findings get bundled by file or visual theme when a category has > 4):

```
Q1 "PRD-cited items (default include, uncheck to skip)" — multiSelect, default ALL checked
  - F-1 [M]: <one-line>
  - F-2 [M]: <one-line>
  - F-3 [M]: <one-line>
  - F-4 [M]: <one-line>

Q2 "Structural improvements (new surfaces / IA / workflow) — default include, uncheck to skip" — multiSelect, default ALL checked
  - F-14 [L]: <one-line; the [L] tag flags cost>
  - F-11 [M]: <one-line>
  - F-8 [S]: <one-line>

Q3 "Polish (opt-in)" — multiSelect, default NONE checked
  - F-9 [S]: <one-line>
  - F-13 [S]: <one-line>
  - F-17 + F-18 [S]: <bundled label tweaks one-line>
  - F-12 [S]: <one-line>

Q4 "Drift reconciliation" — single-select
  - Keep MP everywhere
  - Conform D-3 only
  - Conform all
```

If a category has more than 4 findings, bundle by visual theme (e.g.,
"F-17 + F-18: chip + badge label clarity") OR note in the question
text that additional related findings can be hand-added to
phase1-scope.md. Never silently skip findings.

**Default-with-flag on skip:** every defaulted question gets the
default applied AND logged to the Assumptions section of
phase1-scope.md.

**Default behavior if user skips everything:** implement PRD-cited +
Structural + Workflow (all default-on); skip Polish; keep MP's drift
versions. This is the "intent" baseline — answers the brief, includes
high-leverage product moves, no polish noise.

## Beat 2.5 — Write phase1-scope.md (Stage 3 input contract)

This is the load-bearing artifact. Stage 3 reads ONLY this file and
implements from it without re-deciding what to build.

Required structure (Stage 3 agents grep these section headers exactly;
do not rename):

```markdown
# Phase 1 Scope — {SLUG}

## Routes to modify

### {route path}
- target file: {absolute path}
- changes:
  - [F-12] {verbatim finding from phase1-analysis.md, with PRD § citation}
    - what to add: {specific component name or behavior}
    - mock-data needed: {entity IDs / fields, or "none"}
    - where it goes: {region of the page — e.g., "inside drawer,
      below classification strip"}
  - [F-15] ...

## Routes to add (new)

### {new route path}
- target file: {absolute path}
- purpose: {one line, PRD §}
- mock-data needed: ...
- where it sits in the IA: ...

## New components to create

### {ComponentName}
- target file: {absolute path; default src/components/peer/{Name}.tsx}
- props: ```ts
  interface {Name}Props {
    ...
  }
  ```
- behavior: {one paragraph}
- consumed by: {route(s)}

## Mock-data additions

For each entity to add or extend:
- file: src/lib/mock-data.ts
- entity: {name} — {one-line description}
- minimal shape:
  ```ts
  {
    id: 'cr-low-conf-rounding',
    ...
  }
  ```
- inline reference (REQUIRED when the entity has a unique chipId / id
  that needs to render in a route's prose to be visible): name the
  target route file + paragraph context + the exact JSX snippet to
  insert. Example:
  ```
  inline reference: src/app/submissions/[id]/sections/[sid]/page.tsx,
    in the sec-5.3.2 prose block, add:
    <CitationChip chipId="chip-pfs-updated" sectionId="sec-5.3.2" />
    positioned in a sentence about updated AE rates.
  ```
  If the entity doesn't surface inline (e.g., it's an audit-log-only
  historical conflict, or a SourceDocument referenced only by other
  entities), write `inline reference: none — entity surfaces via {how}`.

## Drift items to reconcile

- [D-1] PRD §N says X; MP shows Y; chosen direction:
  {conform-to-PRD | keep-MP} — {why}

## Edge-case states to wire

For each ?state=NAME branch:
- route: {path}
- state: empty | error | stress | permission | data | temporal
- trigger: {how the URL or condition activates it}
- what renders: {one paragraph}

## Assumptions (defaulted, no user input)

- {question} → defaulted to {choice}; {why}
```

### Hard rules for this file

- EVERY change item carries a finding ID `[F-N]` or drift ID `[D-N]`
  matching the merged-findings table in phase1-analysis.md.
- Every "target file" is an ABSOLUTE path (no `<out>` placeholders).
- Every Mock-data entry includes a TypeScript shape block (so a Stage
  3 agent doesn't have to invent field names).
- Every Mock-data entry that adds an entity with a unique chipId (or
  any other id consumed by inline JSX in a route) includes the
  `inline reference` field naming the target route file + insertion
  context. Skipping this means the new entity sits in memory but never
  renders, and the smoke test will catch the gap as a "built but
  invisible" failure. Default to "inline reference: none — {reason}"
  when the entity is audit-log-only or referenced only by other
  entities, never to silently omit the field.
- Findings the user opted INTO appear. Opted-out items do NOT appear.
  The Assumptions section logs everything skipped + why.
- If `phase1-scope.md` ends up empty (no findings opted into across
  any category), print to user: "No structural changes selected.
  Stage 3 will no-op; jump to Stage 4 with `--finish`."

### Stop point

After writing phase1-scope.md, print to user:

```
Stage 2 complete in <wall-clock>.

Outputs:
- {OUT_ROOT}/.dress-up/spec-audit.md
- {OUT_ROOT}/.dress-up/walkthrough-friction.md
- {OUT_ROOT}/.dress-up/phase1-analysis.md
- {OUT_ROOT}/.dress-up/phase1-scope.md  ← Stage 3 input

→ Open the scope file. Edit it directly if you want to override.
  Stage 3 reads it verbatim; what's in there is what gets built.

When ready for Stage 3 (scaffolding), run:
  /dress-up <mp-url> --implement
```

**STOP.** Do not auto-run Stage 3.

---

# STAGE 3 — Add scaffolding (~2-5 min, parallel-liberal, scope-proportional)

## Beat 3.1 — Plan the parallel batch

Default: one agent per route in `phase1-scope.md` that has changes.

**Split-into-sub-agents rule (parallel-liberal):** if a single route's
scope has **3+ independent items** (e.g. add widget A + wire agent
state B + add ?state=empty branch + drift fix C), split into per-item
sub-agents. Each sub-agent owns ONE change. The main thread then
sequentially merges sub-agent outputs into the route file (each
sub-agent's diff applied as an Edit).

Use when:
- Route has 3+ independent additions
- Items don't share state/structure (won't conflict on merge)
- Cornerstone or thick route where one-agent-does-all would push the
  LOC cap

Don't split when:
- Scope is 1-2 items
- Items depend on each other (e.g. a widget that uses a new agent
  state — should be one agent)

Spawn the batch in ONE tool-call group. Wall-clock = slowest agent,
not sum. Compute budget is liberal; don't constrain agent count to
save it.

## Beat 3.2 — Per-route Stage 3 agent prompt template

```
You are doing the STRUCTURAL SCAFFOLDING work for one Next.js route
in Phase 1 of /dress-up. Your job is ADDITIVE: add scaffolding to the
existing Stage 1 file (raw Tailwind). Phase 2 (Stage 4) will translate
visuals into peer-design-system primitives later — that's NOT your job.

## Target file
{NEXT_FILE_PATH}

## Mode
{MODIFY | CREATE | MERGE_ITEM}
- MODIFY: edit Stage 1 file in place (Edit tool, additive only)
- CREATE: write new file at {NEXT_FILE_PATH} (Write tool)
- MERGE_ITEM: edit Stage 1 file to add ONE specific item (sub-agent
  from split)

## Inputs

### Stage 1 file (your starting point if MODIFY/MERGE_ITEM)
Read {NEXT_FILE_PATH} first to see what's already there.

### Scope (the ONLY source of truth for what to add)
{SCOPE_EXCERPT_FROM_PHASE1_SCOPE}

This is a verbatim slice of `phase1-scope.md` for this route + its
items. It includes finding IDs, target file path, what-to-add lines,
mock-data shapes (when relevant), and where each item goes on the
page. Stage 2 wrote this contract specifically so you wouldn't need
to re-read the PRD.

**Do NOT read the PRD.** Do NOT read the original MP source. Do NOT
guess. If the scope excerpt is ambiguous on something, treat that as
a scope bug and surface it in your output instead of inventing.

### Pattern reference (only if scope item names one)
If your scope item contains a `pattern reference: <file>:<lines>` entry,
READ that file region BEFORE writing any new component code. Mimic the
visual approach: className conventions, lucide icon usage, layout
structure, spacing primitives. The pattern reference is there because
inventing-from-scratch produces drift; the codebase already has an
established aesthetic and you should match it.

For NEW component files (no existing file content to anchor to), the
pattern reference IS your anchor. Don't invent if a pattern exists.
The scope's "behavior" line describes what's different (the delta);
everything not in the delta should match the reference.

### Agent-state patterns (only if scope includes a state item)
Reference: ~/.claude/skills/agent-states/SKILL.md
The scope item will name the pattern by name (e.g., "low_confidence");
look up the named pattern's recipe in that skill if you don't already
know it. Don't import the skill itself.

### Edge-case states (only if scope includes a `?state=NAME` item)
Pattern: `useSearchParams().get('state')` → switch on value. Implement
the requested `?state=NAME` branches per the scope item's "what renders"
description.

## Phase 1 style vocabulary (the ONLY raw Tailwind classes you may use)

- Page background: bg-white text-zinc-900
- Cards: bg-white border border-zinc-200 rounded-lg p-4
- Card hover: hover:bg-zinc-50 transition-colors
- Headings h1: text-zinc-900 font-semibold text-2xl tracking-tight
- Headings h2: text-zinc-900 font-semibold text-lg
- Body: text-zinc-700 text-sm leading-relaxed
- Muted: text-zinc-500 text-xs
- Banners info: bg-blue-50 border border-blue-200 text-blue-800
  rounded-md p-3 text-sm
- Banners warning: bg-amber-50 border border-amber-200 text-amber-800
  rounded-md p-3 text-sm
- Banners critical: bg-red-50 border border-red-200 text-red-800
  rounded-md p-3 text-sm
- Pills: inline-flex items-center gap-1 px-2 py-0.5 rounded-full
  bg-zinc-100 text-zinc-700 text-xs font-medium
- Buttons primary: bg-zinc-900 text-white rounded-md px-3 py-1.5
  text-sm font-medium hover:bg-zinc-800
- Buttons secondary: border border-zinc-200 text-zinc-700 rounded-md
  px-3 py-1.5 text-sm font-medium hover:bg-zinc-50
- Form inputs: border border-zinc-200 rounded-md px-3 py-2 text-sm
  w-full focus:outline-none focus:border-zinc-400

NO DS primitives (`<Heading>`, `<Stack>`, etc.). Stage 4's job.
NO new colors, fonts, or chart libs.

## Hard rules

- Add 'use client'; if any hook is used.
- Wrap default export in <Suspense fallback={null}> if you call
  useSearchParams() directly or via a child.
- Preserve all Stage 1 routing translations.
- Use named entities from @/lib/mock-data verbatim. Do not invent.
- Domain vocabulary, not lorem ipsum. But ALSO not hyper-realistic.
  Two sentences of decent realistic copy beats four polished sentences.
  Volume > polish.
- New mock-data rows: 3-5 fields each, not 15-line paragraphs.
- Labels and chip text: 1-3 words.
- Banner copy: one structured sentence.
- Voice: no em dashes in your prose (em dashes inside string literals
  copied from PRD/mock-data are fine). No "you" unless MP source
  already uses second person. No AI slop, no filler.

## Caps

- MODIFY/MERGE_ITEM: max 200 LOC of NEW code per route.
- CREATE: max 350 LOC for a new route file.
- Time: 4 minutes hard cap. If you'd exceed, stop and return
  "needs sub-split" or "scope too broad" + which items you couldn't
  cover.

## Output

- MODIFY/MERGE_ITEM: use Edit tool. Report which items you added
  (one line per item).
- CREATE: use Write tool. Report LOC + items covered (one paragraph).
- Don't restructure the route's existing layout. Add to it.
```

## Beat 3.3 — Merge sub-agent outputs (if Beat 3.1 split)

For each route that was split, the sub-agents wrote PATCH descriptions
or used Edit independently against the same file. If multiple
sub-agents touched the same file, the main thread runs them in
sequence (parallel writes risk Edit conflicts). Or — simpler — each
sub-agent writes its addition to a NAMED sub-component file
(`src/components/screens/<route>/<ItemName>.tsx`), then a small main-
thread Edit on the route page imports + renders the new sub-components.

Pick the approach per scope. For simple additions (one widget appended
to a stack), sequential Edits are fine. For larger items (a whole new
modal), sub-component files keep things clean.

## Beat 3.4 — Build + reload dev server + checkpoint (~30s)

1. `cd <out> && npm run build` (audit still disabled).
2. If build fails: surface first 30 lines verbatim, stop.
3. Dev server should still be running (Stage 1 started it). Next.js
   HMR picks up the new files. Confirm `lsof -ti:3053` returns the PID
   from `stage1-done.json`. Restart if missing.
4. Write `<out>/.dress-up/phase1-done.json` with timing, scope applied,
   files changed, dev port.
5. Print to user:

```
Stage 3 complete in <wall-clock>.
Scaffolding added:
  - <X widgets, Y agent states, Z edge-case branches, K new routes>
  - <list specific items>

Dev server: http://localhost:3053 (reload to see changes)

→ Open it. Click through. Make any manual edits to src/app/ if you
  want — they'll be preserved through Stage 4.

When you're ready for the design-system translation (Stage 4), run:
  /dress-up <mp-url> --finish [--notes <path>]
```

**STOP.** Do not auto-run Stage 4.

---

# STAGE 4 — DS translation (~5-7 min, parallel-liberal)

## Beat 4.1 — Verify checkpoint + re-enable audit + build DS inventory (~30s)

1. Verify `<out>/.dress-up/phase1-done.json` exists. If not, error:
   "no Phase 1 checkpoint; run --analyze first."
2. Re-enable audit: rename `<out>/package.json`
   `prebuild:audit-disabled` → `prebuild`.
3. Read user's `--notes` / `--notes-text` if provided. Save to
   `<out>/.dress-up/phase2-notes.md`.
4. Run `node ~/.claude/skills/dress-up/bin/inventory-ds.mjs <ds-clone> --out <out>/.dress-up/ds-inventory.json`. The inventory script extracts: primitive names + props interfaces + tone/variant enums per primitive, semantic color tokens from the DS Tailwind theme, Glyph icon roster (if present), AND audit-script path coverage (so we know whether the audit will actually catch violations). Cached on the DS clone's mtime hash — typically ~1s on cache hit, ~20s on a DS clone update.
5. If the audit-script path check shows the audit doesn't cover `src/app/` directly, log a WARNING and rely on Beat 4.3's semantic check (`stage4-primitive-check.mjs`) as the gate.
6. Build the human-readable manifest at `<out>/.dress-up/ds-manifest.md` by summarizing the inventory JSON. Required section:

```markdown
## Per-primitive tone enums (READ THE PRIMITIVE FILE BEFORE USING tone= PROPS)

The inventory script extracted these tone/variant unions automatically.
Each primitive's union is DIFFERENT. NOT interchangeable:

- <Heading tone>: "ink" | "muted"
- <Body tone>: "ink" | "muted" | "faint"
- <MetaText tone>: "default" | "faint" | "faintest" | "ink"  ← NO "muted"
- <MetaLabel tone>: "default" | "muted"
- <Pill variant>: "outlined" | "filled" | "accent" | "ghost"

The manifest is an INDEX of what exists, not a substitute for the
primitive's source. Stage 4 agents must still read the actual file at
`src/components/{category}/<PrimitiveName>.tsx` before using it
(see the read-the-primitive rule in Beat 4.2). The manifest catches
"does X exist?" The file read catches "what does X actually accept?"
```

Plus the standard manifest sections derived from the inventory JSON
(typography, layout, UI primitives, patterns, charts, color tokens,
animation utilities, spacing buckets, Glyph icon roster).

7. If the DS lacks semantic color tokens (e.g., no `--color-warning`,
   `--color-danger`, `--color-success`, `--color-info`), Stage 4 agents
   are told to KEEP the existing Tailwind semantic colors (`bg-amber-50`,
   `bg-red-50`, `bg-green-50`, `bg-blue-50`) rather than flatten them.
   The manifest carries this flag forward.

## Beat 4.2 — Parallel DS translation (~4-5 min, parallel-liberal)

The fan-out covers BOTH `<out>/src/app/**/page.tsx` route files AND
`<out>/src/components/peer/*.tsx` consumer components. Stage 3 often
creates new peer/ files from scratch; they need DS translation too.
Skipping the peer/ folder leaves the seed half-translated.

Spawn the batch in one parallel tool-call group. Wall-clock = slowest
agent.

**Cornerstone-split is the DEFAULT** for any modal-shaped file
(drawer, dialog, overlay panel) that has MULTIPLE conditional state
branches — e.g., high-confidence + low-confidence + failed + propagation
report. Split regardless of total LOC. Single-agent translation of
multi-state modals has two failure modes: it brushes the LOC cap, and
per-primitive tone-enum drift compounds across branches. Splitting
makes each sub-agent's scope simple AND localizes enum-drift risk.

When splitting a modal-shaped file:
- Shell agent: writes the envelope (header chrome, footer, motion
  wrapper, conditional dispatcher) at the existing file path.
- Sub-component agents: each writes ONE state's content under
  `src/components/peer/<DrawerName>/<StateName>.tsx` (or
  `src/components/screens/<route>/<StateName>.tsx` for route-level
  modals). Shell imports the sub-components.

Fall back to single-agent translation for plain route pages and
single-state components.

### Per-route Stage 4 agent prompt template

```
You are translating ONE finished Next.js page from raw Tailwind into
peer-design-system primitives. Stage 3 finalized structure / content /
features. Your job is VISUAL TRANSLATION ONLY.

## Target file (edit in place)
{NEXT_FILE_PATH}

## Source to translate
Read the existing file at {NEXT_FILE_PATH} — that's the Stage 3 finished
structure. Translate to use peer-DS primitives without changing content,
structure, or features.

## DS manifest (INDEX of available primitives)

{DS_MANIFEST_CONTENT}

The manifest is an INDEX — it tells you what exists. It does NOT
substitute for reading the primitive's source. See the next section.

## Read the primitive file before using it (REQUIRED)

Before writing JSX that uses primitive `<X>` (Card, Heading, Stack,
Body, Cluster, MetaText, MetaLabel, Pill, Glyph, LinkButton, etc.):

1. READ the actual primitive source at
   `src/components/{category}/X.tsx` (the category is in the manifest).
2. Verify the props interface, the tone/variant enum values, and
   default behavior. Confirm the prop you intend to pass actually
   exists on this primitive.
3. Only after the read, write the JSX.

You may skip the read for a primitive you already read in this agent
run — but do not skip across agent runs based on memory.

Do not rely on intuition or manifest summaries for prop names or enum
values. Many primitives have non-obvious accepted tones (MetaText
does not accept "muted"; MetaLabel does). The file is the source of
truth.

## Notes from user (if any)

{PHASE_2_NOTES_FOR_THIS_ROUTE_IF_ANY}

## Hard contract (every rule applies)

- No new color values. All colors via DS tokens applied as Tailwind
  utility classes (`text-ink`, `bg-coral`, `border-hairline-strong`,
  `bg-soft`, `text-muted`). NOT as `tone=` props unless the primitive's
  tone union accepts that value (see manifest — MetaText does NOT
  accept "muted").
- No hex codes in className or style. No arbitrary Tailwind like
  `[#abc]` or `text-[Npx]`.
- No new fonts. No `next/font` imports (layout.tsx wires them).
- No external UI kits (radix, shadcn, headlessui, mantine, react-aria).
- No new chart libraries. Use DS BarChart / DonutChart / LineChart /
  Sparkline only.
- No inline `style={{...}}` except one-off positioning (top/left/transform).
- No raw <h1>-<h6>. Use <Heading size="display|h1|h2|h3|h4">.
- No raw <p className=...>. Use <Body size="lead|body|small">.
- No raw `flex flex-col gap-N`. Use <Stack gap="...">.
- No raw `flex items-* gap-N`. Use <Cluster gap="...">.
- No <Button href>. Use <LinkButton href>.
- Domain vocabulary as written in Stage 3 — DO NOT rewrite copy.

## Motion rules

- Page entrance stagger: top-level sections get className "anim-fade-in",
  "anim-fade-in-1", "anim-fade-in-2", ... by depth.
- Card / Button / TableRow primitives carry hover transitions built-in.
  Don't override.
- DO NOT import framer-motion in NEW code. If the Stage 3 file imports
  it (preserved from MP), strip it now — replace `motion.div` with
  regular `<div>` + `anim-fade-in*` classes.
- No inline `style={{ animation: ... }}` or `style={{ transition: ... }}`.
- No new @keyframes.

## Voice rules (preserve, do not rewrite)

- Stage 3 copy is final. Do not "improve" it. Only swap primitives.
- If you spot an em dash in Stage 3 prose (not inside a string literal
  copied from PRD/mock-data), you may strip it. Otherwise hands off.

## Next 16 Suspense rule (CRITICAL — build fails without this)

If your page calls useSearchParams() (directly or via a child), the
default export MUST wrap in <Suspense fallback={null}>:

  function PageInner() { /* all the body */ }
  export default function Page() {
    return <Suspense fallback={null}><PageInner /></Suspense>;
  }

Stage 1 should have done this already. Verify it survived translation.

## Known DS quirks (must be applied)

### Table generic constraint
<Table<T>> requires T extends Record<string, unknown>. Domain types from
@/lib/types don't satisfy this. Cast at the use site:

  const columns: TableColumn<MyType & Record<string, unknown>>[] = [...];
  <Table<MyType & Record<string, unknown>>
    columns={columns}
    rows={rows as (MyType & Record<string, unknown>)[]}
    rowKey={(r) => r.id}
  />

### Type-import rule
NEVER use ReturnType<typeof useTaskStore>['x'][string] to type panel
props. The zustand selector type doesn't infer through index access
cleanly and TS check fails. Import named types from @/lib/types directly.

### Fixed-width sidebars
DS audit fails w-[400px] (or any w-[N≥300px]). Use
w-[clamp(320px,28vw,420px)] or <SplitFrame>.

### No framer-motion in NEW code
Covered above. Strip from Stage 3 file if present.

## Output contract

- Single self-contained TSX file at {NEXT_FILE_PATH} (Edit in place).
- LOC cap: shell pages 200-400, sub-components 150-300, single-agent
  pages 300-500. Split into shell + sub-components under
  src/components/screens/<route>/ if > 600 LOC after translation.
- DO NOT change structure, content, copy, or features. ONLY swap raw
  Tailwind for DS primitives.
- Imports only from: react, next/{navigation,link},
  @/components/{ui,layout,charts,patterns,typography},
  @/lib/{store,types,mock-data,cn}, lucide-react, clsx,
  react-hot-toast, zustand.

Report at end: which primitives you swapped (one line summary).
```

## Beat 4.3 — Build + audit + semantic check + cleanup (~1-2 min)

1. `cd <out> && npm run build` (audit runs via prebuild hook).
2. If audit fails with mechanical violations (text-[Npx], raw flex
   gap-N, MetaText tone="muted", etc.): spawn ONE focused cleanup
   agent per offending file in parallel. Scope: "fix these listed
   violations, change nothing else." Cap: one round. (This is the one
   place auto-fix is allowed — deterministic mechanical fixes.)
3. Re-run `npm run build` once after cleanup. If still failing, stop
   and surface audit output verbatim.
4. If type errors: surface first 30 lines verbatim. Do NOT auto-fix
   in a loop. Common roots: missing Suspense wrapper post-translation,
   Table generic cast forgotten, type-import regression.
5. Once the build passes, run the semantic check:
   `node ~/.claude/skills/dress-up/bin/stage4-primitive-check.mjs <out>`.
   This catches the "agent rolled its own Card-like div" class of
   failure that the mechanical audit doesn't catch. Patterns flagged:
   raw `<h1>`-`<h6>`, raw `<p className=...>`, `<div>` with
   `border + rounded + p-N` (probably should be `<Card>`),
   `<div>` with `flex flex-col gap-N` (should be `<Stack>`),
   `<div>` with `flex items-* gap-N` (should be `<Cluster>`),
   hex codes, `text-[Npx]` arbitrary sizes, external UI kit imports.
6. If the semantic check flags violations:
   - If < 10 violations: spawn ONE focused cleanup agent per offending
     file. Scope: "convert these listed patterns to the named primitives,
     change nothing else." Then re-run build + semantic check.
   - If ≥ 10 violations OR persistent after one cleanup round: stop
     and surface the full violation table to the user. Probably means
     agents went rogue OR the DS is missing a primitive class. Don't
     auto-fix further.
7. If clean: ready for Beat 4.4.

## Beat 4.4 — Final report + dev server (~10s)

Write `<out>/DRESS-UP-REPORT.md`:

- MP source URL + commit SHA
- PRD path (if provided)
- Notes path (if provided)
- Stage 1 timing + route map (verbatim ports)
- Phase 1 analysis summary (link to phase1-analysis.md)
- Phase 1 scope (link to phase1-scope.md)
- Stage 3 timing + scaffolding added per route
- Stage 4 timing per agent + cleanup count
- **Assumptions section** — every defaulted question across all stages
- Build status, audit violations remaining (should be 0)
- npm run dev command + port

Ensure dev server is running on 3053 (restart if PID dead). Print to user:

```
Done in <total wall-clock>.

Report: <out>/DRESS-UP-REPORT.md
Dev server: http://localhost:3053
```

**STOP.** Do not offer to open files, deploy, or take next steps.

---

## Stop conditions

- After Stage 1 Beat 1.4: stop, wait for `--analyze` invocation.
- After Stage 3 Beat 3.4: stop, wait for `--finish` invocation.
- After Stage 4 Beat 4.4: end of pipeline. Stop entirely.

## Out of scope

- Synthesizing a design system from scratch (use /build-hifi for
  greenfield).
- Inverting direction (peer-DS → Magic Patterns).
- Auto-fix loops beyond Stage 4's one round of mechanical cleanup.
- In-place migration of an existing MP project (always fresh DS clone).
- Sources that aren't React.
- Authentication, user accounts, multi-tenancy, real APIs.
- A Stage 5 (e.g., automated A/B variants).
- Auto-invoking /agent-states or /ux-review as sub-skills. Stage 2
  references the patterns manually; user can run /ux-review
  separately after Stage 4 if they want.
- Updating the PRD if MP has diverged (that's /code-ready-prd's job).
