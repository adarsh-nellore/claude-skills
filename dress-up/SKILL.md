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
   on. Tier 1 = brief asks MP doesn't address.
2. **Feel / flow / IA / aesthetic thinking.** Beyond brief.
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

# STAGE 1 — Routing-only port (~2-3 min, parallel agents)

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

## Beat 1.2 — Deterministic file copies + install (~1 min, no LLM)

```bash
cp <mp>/path/to/types.ts <out>/src/lib/types.ts
{ echo "'use client';"; echo ""; cat <mp>/path/to/store.ts; } > <out>/src/lib/store.ts
# If MP inlines mock data in store.ts, also copy it to mock-data.ts as a clone
{ echo "'use client';"; echo ""; cat <mp>/path/to/store.ts; } > <out>/src/lib/mock-data.ts
cp <mp>/path/to/lib/cn.ts <out>/src/lib/cn.ts  # if present
```

Update `<out>/package.json` with detected deps. Run `npm install` ONCE
here (so Stage 1 builds work).

Patch `<out>/src/app/layout.tsx`:
- Add `<Toaster />` from `react-hot-toast` inside `<body>` if MP uses it.
- Update `title` / `description` to sensible MP-derived names.

## Beat 1.3 — Per-route literal-port agents (~1-2 min parallel)

Spawn one agent per route in ONE parallel batch.

### Cornerstone-split rule (parallel-liberal)

If a route's total source LOC (page + imported MP components) > 800,
SPLIT into shell + sub-component agents in parallel:

- ONE shell agent: writes `src/app/<route>/page.tsx` with TopNav,
  layout scaffolding, main content slot, and a modal-overlay dispatcher
  that conditionally renders `?modal=NAME` matches.
- N sub-component agents: each writes ONE
  `src/components/screens/<route>/<Name>.tsx` for one modal or one
  heavy sub-panel (e.g. EvidenceModal.tsx, GapsModal.tsx).
- Shell imports the sub-components.

For Peer AI's 2700-LOC Workspace: 1 shell + 5 modal agents in parallel,
each ~150-250 LOC of input, slowest ~2-3 min. Wall-clock = slowest, not
sum. Don't artificially cap agent count.

### Per-route literal-port agent prompt template

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

# STAGE 2 — Analysis + user dialog (~3-4 min)

## Beat 2.1 — Verify checkpoint + load PRD (~10s)

Verify `<out>/.dress-up/stage1-done.json` exists. If not, error.

Read PRD from `--prd <path>` (or from stage1 checkpoint if previously
passed). If no PRD, proceed with shallow analysis (MP + --brief only)
and note in output: "PRD not provided; analysis limited to brief +
obvious IA holes."

## Beat 2.2 — Analysis pass with forced PRD citations (~2-3 min, ONE main-thread LLM)

Single analytic pass. Forces section-by-section PRD citations so the
agent actually parses the PRD instead of skimming.

Write `<out>/.dress-up/phase1-analysis.md` with required structure:

```markdown
# Phase 1 Analysis — <slug>

## Brief-fidelity scan (HIGHEST PRIORITY)
The OG brief (PRD §intro + persona + JTBD, or --brief notes file)
lists these core asks: <enumerate verbatim with section citations>.
For each core ask: yes / partial / no — does MP address it?
List "no" items first; these are Tier 1 by default.

## Persona alignment
- PRD §<N>: <verbatim persona name + key context>
- MP currently addresses: <observation>
- Gap: <specific>

## Surface inventory
- PRD §<N> (Core Screens): lists <A, B, C, D, E>
- MP shipped: <subset>
- Missing routes: <list with PRD section + persona use case>

## PRD-MP drift (places they DISAGREE, not just omit)
For each MP behavior or content that CONTRADICTS the PRD:
- PRD §<N> says: <verbatim claim>
- MP shows: <observed contradicting behavior>
- Possible reasons: (a) user iterated MP since PRD — intentional,
  (b) MP wasn't built to that spec — oversight.
- Options:
  (1) keep MP's version, treat PRD as stale
  (2) Stage 3 conforms MP to PRD
  (3) skip, log as assumption

If no contradictions: "No PRD-MP drift detected."

## Agent states
For each MP route, cross-reference PRD §<N> (Agent Capability Specs)
and the 13 patterns from ~/.claude/skills/agent-states/SKILL.md:
- Currently expresses: <list with where in MP UI>
- PRD requires also expressing: <list with citations>
- Recommended pattern per state: <e.g. "low_confidence → underline
  + side panel">

## Edge cases
PRD §21 rows: empty / error / stress / permission / data / temporal.
For each row × each MP route: present | missing | N/A.
**Bias: edge cases are Tier 2 by default unless they break the brief.**

## Component inventory gaps
PRD §<N> lists per-route components. Diff against MP. List missing.

## Mock-data depth
PRD names specific entities, dates, quotes. Check MP usage.
**Bias: existing mock-data is "good enough" unless wrong, not just
thin. Don't rewrite for polish.**

## Recommendation tiers
- **Tier 1 (must-do — answers the OG brief)**: <list with brief
  citation + cost estimate>. These are implemented by default.
- **Tier 2 (nice-to-have)**: <list>. User opts IN per item.
- **Tier 3 (skip this pass)**: <list>.
```

If PRD missing a referenced section, record "PRD missing: <expected
section>" rather than fabricating.

## Beat 2.3 — User dialog (~1 min, AskUserQuestion)

Cap 4 questions. Order by Tier:

1. **Tier 1 confirmation** (only if Tier 1 has >2 items):
   multiSelect — "Brief asks for X, Y, Z that MP doesn't address.
   I'll implement all by default. Uncheck to skip."
2. **PRD-MP drift** (only if drift section non-empty):
   single-select — "MP diverges from PRD in N places. Default = keep
   MP's version. Options: keep MP / conform to PRD / case-by-case."
3. **Tier 2 opt-in** (only if Tier 2 non-empty):
   multiSelect — "Optional adds (won't fail the brief if skipped).
   Default = none."
4. **New routes** (only if missing routes list non-empty):
   multiSelect — "Missing routes from PRD. Default = none."

Skip a bucket if analysis shows no real decision in it. Always include
"Skip / use default" per question.

**Default-with-flag on skip:** every defaulted question gets the
default applied AND logged to the Assumptions section of the final
report.

**Default behavior if user skips everything: implement Tier 1, skip
Tier 2/3, keep MP's drift versions.** Fast path that still answers
the brief.

Save chosen scope to `<out>/.dress-up/phase1-scope.md`:

```markdown
# Phase 1 Scope

## Routes to modify
- <route>: add widget X (PRD §N), wire agent state Y, add ?state=empty

## Routes to add (new)
- /<path>: per PRD §M; uses mock-data entities A, B, C

## Agent states per route
- /<route>: low_confidence, awaiting_review

## Edge-case states per route
- /<route>: ?state=empty, ?state=stress

## Drift items to reconcile (if any)
- PRD §N → conform MP to PRD: <specific change>

## Assumptions (defaulted, no user input)
- <question> → defaulted to <choice>
```

If `phase1-scope.md` ends up empty (every route gets nothing changed),
Stage 3 effectively no-ops — proceed directly to Checkpoint #2 prompt.

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

### Scope (what to add for this agent)
{SCOPE_EXCERPT_FROM_PHASE1_SCOPE}

### Relevant PRD section excerpts (verbatim, with citations)
{PRD_EXCERPTS_FOR_THIS_ROUTE_AND_THESE_ITEMS}

### Persona context
{PERSONA_FROM_PRD}

### Mock-data fields to use
{MOCK_DATA_NOTES — which entities/types to reference; do not
invent new fields, do not rename existing ones}

### Agent-state patterns to apply (if scope includes states)
Reference: ~/.claude/skills/agent-states/SKILL.md
{NAMED_PATTERNS_FOR_SCOPE — e.g., "low_confidence → inline underline
+ side panel with confidence chip and source link"}

### Edge-case states to add (if scope includes states)
Pattern: `useSearchParams().get('state')` → switch on value. Implement
the requested `?state=NAME` branches.

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

## Beat 4.1 — Verify checkpoint + re-enable audit + build DS manifest (~30s)

1. Verify `<out>/.dress-up/phase1-done.json` exists. If not, error:
   "no Phase 1 checkpoint; run --analyze first."
2. Re-enable audit: rename `<out>/package.json`
   `prebuild:audit-disabled` → `prebuild`.
3. Read user's `--notes` / `--notes-text` if provided. Save to
   `<out>/.dress-up/phase2-notes.md`.
4. Build DS manifest at `<out>/.dress-up/ds-manifest.md`. Required
   sections (per-primitive tone enums are critical — agents regress
   on these):

```markdown
## Per-primitive tone enums (READ THESE BEFORE USING tone= PROPS)

Each primitive's tone union is DIFFERENT. NOT interchangeable:

- <Heading tone>: "ink" | "muted"
- <Body tone>: "ink" | "muted" | "faint"
- <MetaText tone>: "default" | "faint" | "faintest" | "ink"  ← NO "muted"
- <MetaLabel tone>: "default" | "muted"
- <Pill variant>: "outlined" | "filled" | "accent" | "ghost"

When in doubt, drop the tone= prop and rely on the primitive's
default tone. Or use a Tailwind utility class for tone (text-faint,
text-muted, text-ink).
```

Plus the standard manifest sections (typography, layout, UI primitives,
patterns, charts, color tokens, animation utilities, spacing buckets).

## Beat 4.2 — Parallel DS translation (~4-5 min, parallel-liberal)

One agent per route file in `<out>/src/app/`. Spawn in one parallel
tool-call batch.

**Cornerstone-split rule applies here too**: if a route's Stage 3
output > 800 LOC, split into shell + sub-component agents. Same
pattern as Stage 1's split. Don't artificially cap agent count.

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

## DS manifest (the only primitives you may import)

{DS_MANIFEST_CONTENT}

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

## Beat 4.3 — Build + audit + cleanup + final build (~1-2 min)

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
