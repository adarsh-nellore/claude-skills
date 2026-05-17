---
name: tooltip-walkthrough
description: |
  Inject subtle, glassy hover-revealed tooltips into any prototype
  (single-HTML or framework). Defaults to ambient hover-only — no
  modal overlay, no auto-popups, no scroll-jack. Each tooltip is a
  14px indigo-tinted dot next to a designated element; on hover or
  focus, a glassy popover (backdrop-filter blur, 85% white,
  soft border) reveals the explanation. Optional --tour flag adds a
  "Take the tour" button bottom-right that sequences through the
  tooltips with prev/next/skip. Built for surfacing the "why" of
  design decisions (especially AI placements) during demos without
  external writeups. If ./AGENTIC-PLACEMENT.md exists, the skill
  auto-proposes tooltips for each Tier 1 feature. Composes downstream
  from /agentic-design. Triggers: "add tooltips", "tooltip
  walkthrough", "explain features inline", "demo annotations",
  "subtle hints", "glassy tooltips", "feature tour".
license: MIT
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Agent
  - mcp__playwright__playwright_navigate
  - mcp__playwright__playwright_get_visible_text
  - mcp__playwright__playwright_get_visible_html
  - mcp__playwright__playwright_evaluate
  - mcp__playwright__playwright_hover
  - mcp__playwright__playwright_screenshot
  - mcp__playwright__playwright_close
---

## Role

Generator. Takes a list of element selectors + tooltip content and
produces drop-in CSS + JS that adds glassy hover-revealed tooltips
to a prototype. Three visual properties are non-negotiable:

1. **Glass** — `backdrop-filter: blur(14px)` on the popover, 85%
   white background, soft inner border.
2. **Subtle indicator** — 14px circle, indigo tint at 8% opacity.
   Visible on a careful scan, invisible at a glance.
3. **No modal** — hover/focus reveal, no JS overlay, no scroll lock,
   no auto-popups.

The tooltips exist to surface the *why* of design decisions during a
demo, not to teach the product. If a feature needs more than 60 words
of inline explanation, the feature itself needs redesign, not a
longer tooltip.

## Speed budget

**Wall-clock target ≤4 min** for a typical 4–6-tooltip run. Stages 3
and 5 use parallel sub-agent batches. High compute is acceptable;
wall-clock speed is the primary constraint.

## When to run

- Demoing a prototype to people who didn't sit through the design
  process.
- Surfacing the *why* of AI placements (often paired with
  `/agentic-design` upstream).
- Replacing an external slide deck with inline context the user can
  hover at their own pace.

## When NOT to run

- The prototype's affordances are self-explanatory (e.g., a search
  bar with a placeholder).
- The audience is fellow designers who will read the source.
- Tooltips would crowd already-busy surfaces — in that case the
  surfaces need redesign, not annotations.

## Hard rules

- **No auto-popup.** Tooltips never appear without user intent
  (hover or focus). The default is *ambient*, not *intrusive*.
- **No scroll-jack.** Even in tour mode, scrolling is the user's
  action.
- **One tooltip per element.** If the user wants multiple notes on
  one surface, restructure the surface.
- **Glass treatment is non-negotiable.** `backdrop-filter: blur(...)`
  is the visual signature. Browsers without support fall back to
  flat semi-transparent white; no other treatment.
- **Tooltip text discipline**: max 60 words per bubble, optional
  `tip-title` ≤4 words.

## Pipeline (5 stages)

### Stage 1 — Preflight (~10s)

- Detect prototype shape: single-HTML (one `index.html` with inline
  `<script>` and `<style>`) vs framework (`package.json` present).
- Read `./AGENTIC-PLACEMENT.md` if it exists. If present, auto-derive
  one tooltip per Tier 1 feature (content drawn from the why-tier-1
  field).
- Confirm with the user which selectors to annotate. If
  AGENTIC-PLACEMENT.md was auto-loaded, just show the proposed list
  and ask "OK?" — single round trip.

### Stage 2 — Inject CSS (~5s)

Append the CSS block (below) once via a single Edit:
- Single-HTML: append to the existing `<style>` block (find the
  closing `</style>` and insert before it).
- Framework: write to a new `src/styles/tooltip-walkthrough.css`
  file the user imports into their global CSS entry.

```css
.tip-target {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.25);
  color: rgba(99, 102, 241, 0.85);
  font-size: 9px; font-weight: 600;
  cursor: help; margin-left: 6px;
  transition: background 0.15s, border-color 0.15s;
  position: relative;
  vertical-align: middle;
}
.tip-target:hover, .tip-target:focus {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.5);
  outline: none;
}
.tip-bubble {
  position: absolute; bottom: calc(100% + 8px); left: 50%;
  transform: translateX(-50%) translateY(4px);
  min-width: 240px; max-width: 320px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.12),
              0 1px 3px rgba(15, 23, 42, 0.08);
  font-size: 12px; line-height: 1.55; color: #1a1a1a;
  text-align: left; text-transform: none; letter-spacing: 0;
  opacity: 0; visibility: hidden;
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 100; pointer-events: none;
}
.tip-target:hover .tip-bubble,
.tip-target:focus .tip-bubble {
  opacity: 1; visibility: visible;
  transform: translateX(-50%) translateY(0);
}
.tip-bubble::after {
  content: ''; position: absolute; top: 100%; left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(255, 255, 255, 0.85);
}
.tip-bubble .tip-title {
  font-weight: 600; font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.06em; color: rgba(99, 102, 241, 1);
  margin-bottom: 4px;
}

/* Tour button (only when --tour) */
.tour-launch {
  position: fixed; bottom: 24px; right: 24px;
  padding: 10px 16px; font-size: 12px; font-weight: 600;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(99, 102, 241, 0.4);
  color: rgba(99, 102, 241, 1);
  border-radius: 999px; cursor: pointer; z-index: 200;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  font-family: inherit;
}
.tour-launch:hover { background: rgba(255, 255, 255, 0.95); }
.tour-backdrop {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.04);
  z-index: 150; display: none;
}
.tour-backdrop.active { display: block; }
```

### Stage 3 — Parallel tooltip-content drafting (~60–90s, **parallel**)

Spawn **N `general-purpose` agents in one tool-call batch** (one per
tooltip target, cap 6). Each agent receives a self-contained prompt:

```
You are drafting one tooltip for a prototype demo. Return ONLY a
JSON code block titled TIP_CONTENT containing
{ "selector": "<css>", "title": "<≤4 words>", "body": "<≤60 words>" }.
Do NOT call Edit or Write.

TARGET:
- Selector: [css selector]
- Current element text: [extracted by main thread]
- Surrounding context: [3 lines of HTML or React above + below]

WHY THIS TOOLTIP EXISTS:
[the why-tier-1 paragraph from AGENTIC-PLACEMENT.md if available,
or the user's free-text rationale]

CONSTRAINTS:
- Title ≤4 words, UPPERCASE-letter-spacing-friendly.
- Body ≤60 words. Answer: "Why does this exist? What decision is it
  supporting?" Nothing else.
- No marketing voice. No "Click here," "Discover," "Get started,"
  "We've made this better." Concrete domain-specific language only.
- No em dashes. Use periods, semicolons, colons, or parens.
- No "you" pronoun. Third person or imperative.
```

Main thread collects N JSON blobs. Validate each: title length,
body length, anti-slop scan. If any fail validation, the main thread
revises inline (don't re-spawn the agent — faster to fix the body
than to re-batch).

### Stage 4 — Sequential injection (~10–20s)

Apply one Edit per tooltip target. For each `TIP_CONTENT`:

1. Find the target element via the selector in the source file.
2. Inject this snippet immediately after the matched element:

```html
<span class="tip-target" tabindex="0" aria-label="More info">i<span class="tip-bubble"><span class="tip-title">TITLE</span>BODY</span></span>
```

(Where `TITLE` and `BODY` are escape-HTML'd from the JSON.)

Sequential because all Edits land in the same file; parallel writes
would conflict.

**Selector ambiguity**: if a selector matches multiple elements, the
default is to annotate the first match only. The skill warns the
user and asks for a more specific selector if they wanted all
matches. Don't silently annotate all instances.

### Stage 5 — Optional `--tour` + Parallel Playwright verification (~60–90s)

**If `--tour` flag set**, also inject in one Edit:

- A `<button class="tour-launch" onclick="startTooltipTour()">Take the tour</button>` element appended to `<body>`.
- A `<div class="tour-backdrop" id="tour-backdrop"></div>` element.
- A small JS module (~30 lines) implementing:
  - `startTooltipTour()` — collects all `.tip-target` elements in
    document order, focuses the first, shows the backdrop.
  - Prev/Next/Skip controls injected into the bubble during tour
    mode only (CSS class `tour-mode` flips `pointer-events` so the
    bubble accepts clicks).
  - Each step auto-scrolls the target into view (smooth, but the user
    can scroll over it; no scroll-lock).
  - Esc or backdrop-click exits the tour.

**Verification** — spawn N `general-purpose` agents in one tool-call
batch (one per tooltip, cap 6). Each agent:

1. Navigates to the prototype URL via Playwright MCP.
2. Hovers the target selector via `playwright_hover`.
3. Asserts `.tip-bubble` is now visible (`opacity > 0` via
   `playwright_evaluate`).
4. Asserts the bubble's computed `backdrop-filter` style is not
   `none` (the glass effect rendered).
5. Screenshots the post-hover state to
   `./tooltip-screenshots/tip-N-<selector-slug>.png`.
6. Returns `{ selector, status: 'PASS' | 'FAIL', reason?: string }`.

Caveat: Playwright MCP is single-instance per session. Parallel
navigators share the browser context and may race. **Fallback**: if
the parallel batch returns mixed errors that look like race
conditions, re-run sequentially. Each tooltip check is ~10s
sequential = ≤60s for 6 tooltips. Still under budget.

Main thread merges PASS/FAIL into a `./TOOLTIP-VERIFY.md` summary.

## Output files

- **`<prototype>/index.html`** (or framework equivalents) — modified
  with CSS + tooltip triggers (+ tour button if `--tour`).
- **`./TOOLTIP-VERIFY.md`** — per-tooltip PASS/FAIL summary.
- **`./tooltip-screenshots/`** — one screenshot per tooltip in
  hover state.
- **`./TOOLTIPS.json`** (optional input) — config file if the user
  wants to re-run with the same set later.

## Anti-slop scan

Reject tooltip content containing:
- "Click here to learn more" / "Discover" / "Get started"
- "We've made this even better" / marketing voice
- Generic "this is the X" labels with no insight
- "It's worth noting" / "essentially" / "at its core"
- Em dashes anywhere

Every tooltip must answer: *why does this exist? what decision is
it supporting?* If a tooltip can't answer that, the feature
underneath probably shouldn't exist.

## Composes with

- **Upstream**: `/agentic-design` produced `./AGENTIC-PLACEMENT.md`
  whose Tier 1 entries become tooltip candidates automatically.
- **Sibling**: `/ux-review` audits the prototype; tooltips don't
  interfere with the audit because they're hover-only and don't add
  to the JTBD step count.

## Out of scope

- Onboarding overlays / dim-the-screen tours (use a different tool;
  this skill is deliberately ambient).
- Persistent UI affordances explained by tooltip (if a button needs
  a tooltip to be understandable, label the button better).
- Animation libraries / third-party tour packages — this skill
  emits ~50 lines of CSS + ~30 lines of JS, no dependencies.
- Internationalization — tooltips are written in the prototype's
  primary language only.
