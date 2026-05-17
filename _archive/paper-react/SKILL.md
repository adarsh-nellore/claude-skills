---
name: paper-react
description: |
  Design UI components AND/OR a full-page composition in Paper, then port to
  runnable React by pulling fresh get_jsx from Paper (never from a previous
  turn's cache, never typed from memory). Expects an existing design system.
  Use when the user wants designed-and-coded interactive components or a
  multi-component page in a single pass — especially for prototypes and
  interview exercises. Triggers: "build a component", "design and port",
  "component from paper", "interactive prototype from a design system",
  "page composition from paper". Out of scope: synthesizing design systems
  from scratch, multi-screen routing, deployment.
license: MIT
---

## Purpose

Repeatable workflow for: design a component (or several, or a page) in Paper as state maps, then port to runnable React, ending with a click-testable prototype.

This skill exists because a previous session burned three durable failures:
1. **Spec-from-memory ports.** Typed values from recall instead of pulling get_jsx. Visual output happened to match because I designed both, but the lineage was a lie.
2. **Stale get_jsx caches.** Used last-turn's export after the user edited Paper. Wordmark stayed in code after user deleted it from canvas.
3. **Missing interaction states.** First-pass components covered only default + one obvious variant. Disabled, focused, error states all skipped until user demanded them.

Encode these as non-negotiable rules.

## Non-negotiable rules

1. **No get_jsx caching across turns.** If a previous turn exported Paper JSX, treat it as stale. Re-pull immediately before writing any React file.
2. **No spec-from-memory.** Even if you designed the artboard yourself in the same turn, pull get_jsx before writing the React. Memory is not a source of truth.
3. **Layer names by role / state, never by copy.** `Item / Selected` not `Most popular item`. `Trigger / Open` not `Sort by trigger`. The names map to a code component's variant prop.
4. **One write_html per visual group.** Per the Paper guide. Screenshot every few groups for review.
5. **Feedback gate between Paper and React.** Always hard-stop after the Paper screenshot. Do not write any React without an explicit "go" from the user.
6. **Transparency table after every port.** Diff what's byte-equivalent from get_jsx vs what changed for interactivity. No exceptions.
7. **Disabled is a real state.** Consider it for every interactive component. Either design it, or explicitly defer with the user's blessing.
8. **No inventing design tokens.** If a needed color or size isn't in the design system, stop and ask whether to add it (and which artboard to update) or use an existing token.

## Phase 1 — Resolve the design system

This skill does NOT synthesize design systems. Before any Paper work, ask one focused question:

> "Where's the design system? (a) a Paper artboard I should read, (b) a token spec you'll paste, (c) a website URL to derive from."

If none of those, refuse and tell the user to provide one.

If (a): call `get_jsx({ nodeId, format: "inline-styles" })` on the design system artboard. Record palette, type, geometry, shadows.

If (b): parse the pasted spec. Confirm tokens by listing them back before proceeding.

If (c): use `WebFetch` to fetch the URL. Extract colors, type, geometry from the rendered styles. Confirm tokens before proceeding.

## Phase 2 — Classify the archetype and enumerate states

Before drawing anything in Paper, post a **state inventory** to chat. Pick from this table by component archetype:

| Archetype | Default states to consider |
|---|---|
| Button | default, hovered, pressed, focused, disabled, loading |
| Text input | default, focused, filled, error, disabled |
| Search input w/ autocomplete | default, focused empty, focused filled+matches, focused filled+no-matches, error, disabled |
| Dropdown trigger | default, hovered, focused, open, disabled |
| Dropdown item | default, hovered, focused, selected, disabled |
| Chip (toggleable) | default, hovered, focused, selected, disabled |
| Segmented control | default, hovered per segment, selected per segment, focused per segment, disabled |
| Row / Card | default, hovered, pressed, selected (if multi-select), focused, disabled, loading skeleton |
| Toggle / Switch | off, on, hovered each, focused each, disabled each |
| Modal / Drawer | closed, opening, open, closing |
| Tooltip / Popover | hidden, visible, with-arrow |
| Tabs | default per tab, active, hovered, focused, disabled |

If the archetype isn't here, ask the user what states matter. Don't guess.

After listing, **confirm with the user before designing**. The user can prune ("skip disabled for v1") but you must offer the full inventory.

## Phase 3 — Design in Paper (component state maps)

Setup:
- Call `get_guide({ topic: "paper-mcp-instructions" })` once per session if not already loaded.
- Call `get_basic_info` to confirm file state (artboards, fonts available).
- Call `get_font_family_info` for the font family BEFORE any typographic write.
- **Post a design brief to chat** (mood, palette, type, direction) before any mutation tool — Paper guide requires this.

Build:
- **If you don't have HTML pattern recall for the archetype, read `STATE-PATTERNS.md` in this skill's folder.** It has ready-to-adapt structure idioms for every archetype in the inventory table. Copy the relevant snippet, then swap example token values for your design system's actual tokens. The file teaches structure; the system provides values.
- `create_artboard` per component or a single shared artboard with multiple component sections.
- Format: section heading on the left rail (160px wide, with role label + 1-line description), state cards in a row (or stacked vertically if cards are wide) on the right.
- Each state card: caption (state name in mute) + the rendered variant.
- Layer names follow `Component / State`. Sub-elements use generic names (`Label`, `Surface`, `Chevron`, `Caret`).
- One `write_html` per visual group. Aim for ~one section at a time, or up to 3-4 similarly-sized cards in a single call.
- `get_screenshot` after each major section. Run the Paper guide checklist:
  - Spacing — uneven gaps, cramped groups
  - Typography — too small, weak hierarchy
  - Contrast — text that blends in
  - Alignment — elements that should share lanes but don't
  - Artboard fit — clipping or large empty gap (switch to `height: "fit-content"` if so)
  - Repetition — overly grid-like sameness

Close out:
- `finish_working_on_nodes` (mandatory per Paper guide).
- Post screenshot to chat with a "what to look at" note.
- **HARD STOP. Wait for user feedback. Do not proceed to React.**

## Phase 4 — Port to React (per component)

For each component, in sequence:

1. **Pull fresh get_jsx.** `get_jsx({ nodeId: "<component section>", format: "inline-styles" })`. Don't reuse a previous turn's export.
2. **Write the React file** using the exported inline styles **byte-equivalent on every structural node**. Property orderings, even verbose Paper-specific keys (`fontSynthesis`, `MozOsxFontSmoothing`, `WebkitFontSmoothing`), stay as Paper emits them.
3. **Layer in only the strictly-necessary interactivity diffs:**
   - Real `<input>` replaces static value + caret divs
   - `<button>` wraps clickable elements with CSS reset: `border:0; background:transparent; cursor:pointer; padding:0; font:inherit; color:inherit; text-align:left; width:100%`
   - State-driven dynamic styles: `backgroundColor: hovered ? '#FAFAFA' : 'transparent'`
   - Conditional renders: `{open && (<panel />)}`
   - Click-outside + Escape effects via `useEffect` where panels exist
4. **Cover every state from the inventory.** If `disabled` was approved, the React component handles `disabled` (button attr, styling switch). Don't ship partial state coverage.
5. **Document the diffs in a transparency table.** Format:

```
| Aspect | From Paper | In prototype |
|---|---|---|
| Colors, padding, font, shadow, geometry | exact values | exact values, unchanged |
| [structural element] | static markup | [diff for interactivity] |
| Hardcoded hover/selected demo | row N had #FAFAFA baked in | dynamic, tracks cursor |
```

Anything not in the table should be byte-equivalent.

## Phase 5 — Page composition (only if the user wants a full page)

If the user wants a page (multiple components composed into one screen), this phase is mandatory. Skipping it and reasoning about layout in prose produces a sparse, undirected page. Lesson learned the hard way.

Before any page-level React:

1. **Design the page composition in Paper.** New artboard "X · Page composition" at real screen width (1200-1440), height fit-content, showing the page in its default state. Every component placed where it'll live.
2. **Reason explicitly about:**
   - Title hierarchy — masthead (36/40 medium) vs label (18-20 medium). Don't default to small.
   - Hero/search anchoring — full-column-width vs deliberately offset. Avoid orphaned-center inputs in a wider column.
   - Control row organization — one busy row vs split into two registers (chips above, sort+toggle in meta row above results).
   - Edge alignment — title, search, controls, results all share the column's left edge.
   - Vertical rhythm — ~64px gaps between major sections in editorial mood; ~40px in denser dashboard mood.
   - Content section treatment — flat list with hairline dividers vs bordered cards vs table.
3. **Diagnose common failure modes BEFORE building:**
   - Flat title that reads as a label, not a header
   - Orphaned-center search in a wider column
   - Busy controls row mashing chips + sort + toggle on one line
   - Sections of similar weight (page reads as a widget stack, not a designed thing)
   - Inconsistent edge alignment between header and body
4. **Confirm component variant changes.** If the page composition implies a tighter/denser variant than the component artboard spec (e.g. result row with different padding, no tag pills), update the component artboard FIRST. Don't fork silently.
5. **Screenshot. Feedback gate. Wait for explicit "go" before React.**
6. **React port** of `App.tsx` (or page-level file): pull `get_jsx` of the page composition artboard fresh, write inline styles byte-equivalent, reuse the component files already ported.

## Phase 6 — Verify and report

- `npx vite build` (or framework equivalent) compiles clean
- Dev server running in background, URL reported
- Click-check list:
  - Per component: every state from inventory triggers correctly
  - Per page: end-to-end flow (type search → results filter; click chip → results filter; pick sort → reorder; toggle view; click result → handler fires)
- Note: "should look pixel-equivalent to [Paper artboard / state]"

## Project assumptions (default; override per user prompt)

- Vite + React 19 + TypeScript scaffold
- Inline styles only, no Tailwind (matches the byte-equivalent inline export from Paper directly)
- Inline SVG for icons (matches Paper's chevron / check / search emission); `lucide-react` only if the user explicitly asks
- Dev server in the background via `npm run dev` (`run_in_background: true`); hot-reload picks up edits
- Project location: ask the user, or default to `~/Projects/<slug>-prototype/`
- TypeScript: strict mode on. `tsconfig.app.json` + `tsconfig.node.json` per Vite convention.

## Failure-mode reminders (cite these when they happen)

- **"This looks wrong" right after a port** → re-pull `get_jsx` immediately. Don't try to debug from memory. The user may have edited Paper between turns.
- **User pasted a token spec but no Paper artboard exists yet** → design the components from the spec into a new Paper artboard. React port still requires Paper as the intermediate so get_jsx is the source for the code.
- **An archetype isn't in the state table above** → ask the user what states matter. Don't guess.
- **You want to invent a token** (e.g. a new color, a new size) → stop. Ask whether to extend the design system or use an existing token.
- **You're about to write a page without a Paper composition artboard** → stop. Page composition needs Phase 5 first. Skipping it produced "this one sucks" in a real session.

## Output format conventions

- Honest transparency table after every component port (see Phase 4)
- "What to look at" note alongside every Paper screenshot for feedback gates
- Click-check list in plain language at the end of each React port

## Complementary skills and files

- `STATE-PATTERNS.md` (in this skill's folder) — HTML pattern reference per archetype. Read it during Phase 3 if you don't have structural recall for the archetype.
- `agent-states` — reference doc for the 13 agent-feature UX states. Load this if the component being designed is for an AI/agent product (e.g. confidence ribbons, source citations, undo flows).
- `humanizer` / `the-humanizer` — orthogonal; for prose, not UI.

## Project memory notes

- Adarsh's editorial archive design system: white ground, `#171717` ink, `#737373` mute, `#E5E5E5` edge, `#FAFAFA` wash, Inter font, 8px radius, overlay shadow `0 12px 32px -4px rgba(0,0,0,0.08), 0 4px 8px -2px rgba(0,0,0,0.08)`. Used as the working example in the session that produced this skill.
- Default file paths: Paper file `Dropdown--Test` if mentioned; React project `~/Projects/<slug>-prototype/`. Prompt for the slug.
