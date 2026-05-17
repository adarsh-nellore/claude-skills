---
name: lofi-and-components
description: |
  Use when the user wants a minimal component taxonomy + 3 lo-fi
  screen flows for a chosen design direction. Generator (not a
  thinking partner). Produces ABSTRACT WIREFRAMES — grey pills,
  rectangles, placeholder shapes. NOT designed UI. NOT real-looking
  product screens. Lo-fi artboards exist for direction-picking only
  and are never ported to React. Hi-fi happens AFTER lo-fi locks,
  using /paper-react against a separate hi-fi Paper artboard pass.
  Composes with /journey-and-flow upstream. Requires Paper MCP, so
  does NOT work in Claude Chat.
license: MIT
allowed-tools:
  - Read
  - Write
  - Edit
  - mcp__paper__get_basic_info
  - mcp__paper__get_tree_summary
  - mcp__paper__create_artboard
  - mcp__paper__write_html
  - mcp__paper__update_styles
  - mcp__paper__set_text_content
  - mcp__paper__duplicate_nodes
  - mcp__paper__rename_nodes
  - mcp__paper__get_screenshot
  - mcp__paper__finish_working_on_nodes
  - mcp__paper__get_font_family_info
  - AskUserQuestion
---

## Role

Generator. The user has a journey + JSON schemas from
`/journey-and-flow`. Output:

1. **Component taxonomy** — atoms only, named in domain terms, with
   props + states. States must tie back to /agent-states (e.g., a
   `<DraftSpan>` atom has an `unverified` state matching the
   Hallucination/Confidence Failure UX pattern).
2. **3 lo-fi flows in Paper** — each flow is a sequence of artboards
   representing the chosen journey, rendered with minimal aesthetic
   and domain-accurate placeholder text.
3. **Navigation map** — explicit screen → CTA → target screen mapping
   that `/paper-to-prototype` will consume.

No conversation. No re-opening of decisions. Cite the journey, the
PRD persona, and the agent states being designed for at the top of
the output.

## Hard rules

- **Atoms only in the taxonomy.** No molecules, no organisms. If the
  flow needs a "GuidancePanel," it's made of `Card`, `Heading`,
  `Text`, `Link`. The taxonomy is the alphabet, not the words.
- **Domain-named atoms when they encode behavior the design system
  doesn't already have.** `<UnverifiedSpan>` is fine. `<AgentMessage>`
  is fine. `<ContentBlock>` is not — that's an abstraction with no
  domain meaning.
- **Each atom names its agent-state variants.** A `<DraftSpan>` lists
  `default | unverified | flagged | approved` with the matching
  /agent-states UX pattern for each. No abstract "states."
- **Strict wireframe aesthetic. This is lo-fi, not designed UI.**
  These artboards are for direction-picking, not visual design. They
  must read as wireframes at first glance:
  - Containers: solid grey fills (`#E5E5E5`) OR white with thin
    `#D4D4D4` 1px borders. No fills outside greyscale.
  - Type: ONE plain sans weight at body size (14–16px) for everything.
    No heading hierarchy styled visually — a "title" is just a label
    on a row at the same weight as body text. Bold sparingly, only
    where it conveys *information role* (e.g., the question being
    answered), never decoration.
  - Pills/buttons: grey rounded rectangles with plain text. No fill
    colors. No gradients. Disabled = same shape, lighter grey.
  - Icons: only abstract placeholder shapes. A grey rounded square
    where an avatar goes. A circle where an icon goes. A horizontal
    grey bar where a logo goes. No real iconography.
  - No images. No logos. No branding. No stock photos. No gradients.
    No shadows beyond a single hairline border for separation.
  - No hover states, no loading states, no animations in lo-fi. Those
    are hi-fi concerns. Each state = its own artboard.
- **Domain-accurate text labels, plainly rendered.** "Statistical
  Analysis Plan" is fine as a label; render it in plain sans body
  weight, same as everything else. The point is to convey what the
  section IS, not how it looks. If you can't find the right domain
  term, use a placeholder like `[Section heading]` rather than
  inventing AI-slop ("Smart Analysis Hub").
- **3 lo-fi flows = 3 takes on the chosen journey** at different
  scopes or fidelity slices. Not 3 random screens. Each flow is
  navigable end-to-end on the journey.
- **Paper-only output. Lo-fi is NEVER ported to React.** Do NOT
  generate React components, CSS, or any code artifact in this
  skill. Lo-fi artboards exist for review/iteration only. They are
  throw-away once hi-fi locks. If the user asks to "port the lo-fi to
  React," refuse and explain: hi-fi requires a separate Paper pass
  that uses the design system; `/paper-react` runs on that, not on
  these wireframes.

## Preflight (do this before Step 1)

### Context check

Look for upstream context, in order:
1. `./PRD.md` + `./JOURNEY.md` (or PRD journey section) — full upstream
2. PRD + journey pasted into this conversation
3. Just a journey/direction pasted inline with no PRD
4. Nothing — ask the user

If (1), (2), or (3): proceed with whatever's there. If only direction
(no PRD): ask for the persona and JTBD in one free-form line before
proceeding ("Quick: persona + JTBD in one line so the lo-fi reflects
the user, not generic UI.")

If (4): refuse to proceed. This skill is downstream of structured
design thinking; without a journey or direction, it would generate
generic UI. Tell the user to run `/journey-and-flow` first or paste a
direction inline.

### Environment detection

Paper MCP must be available. This skill cannot run in Claude Chat
without it. Verify by calling `mcp__paper__get_basic_info` early —
if it fails, stop and tell the user to set up Paper MCP first.

`./NAVIGATION.md` is the seam to downstream tools — always write it
when filesystem is available. If `Write` isn't available, output
NAVIGATION.md content inline as a markdown code block at the end.

## Pipeline

### Step 1 — Read inputs

Read in order, fail loudly if any missing:
- `./PRD.md` (from `/product-thinking`)
- `./PRD.md` journey section or `./JOURNEY.md` (from
  `/journey-and-flow`)
- `~/.claude/skills/agent-states/SKILL.md` (reference)

Surface the inputs at the top of the output:
```
Designing for:
- Persona: [from PRD]
- JTBD: [from PRD]
- Chosen direction: [from journey]
- High-stakes agent states: [from PRD Beat 5]
```

### Step 2 — Component taxonomy

Generate the taxonomy in markdown:

```markdown
## Component taxonomy

### [AtomName]
- **Purpose:** [one-line; what it represents in the user's mental model]
- **Props:** [name: type, …]
- **States:** [list, each tied to /agent-states where relevant]
  - `default` — [UX pattern]
  - `[state name]` — [UX pattern from /agent-states]
- **Used in screens:** [Screen 1, Screen 2, …]
```

Atoms to expect for an agent-feature product (adjust to the journey):
- Input atoms: text input, doc upload, query bar
- Display atoms: span (with verified/unverified/flagged states),
  heading, body text
- Agent atoms: agent message bubble, confidence badge, suggestion
  inline card, citation
- Action atoms: primary button, secondary button, ghost button,
  inline action (icon + label)
- Status atoms: timeout indicator, degraded-mode banner, escalation
  packet card

Cap the taxonomy at ~10 atoms. If you need more, you're building
molecules — push back into atoms.

### Step 3 — Lo-fi flows in Paper

Before touching Paper, call `mcp__paper__get_basic_info` and
`mcp__paper__get_font_family_info`. Use what's listed in basic_info
for fonts and document dimensions. Don't invent fonts.

For each of the 3 flows:

1. Create a new artboard per screen via `mcp__paper__create_artboard`.
   Name each artboard with the convention
   `flow-[N]/screen-[order]-[short-name]` (e.g., `flow-1/screen-1-protocol-open`).
2. Use `mcp__paper__write_html` to render the screen as wireframe
   HTML/CSS. **Strict wireframe palette**:
   - Containers: `background: #E5E5E5;` (filled grey) OR `background:
     #FFFFFF; border: 1px solid #D4D4D4;` (outlined). No other fills.
   - Type: one plain sans, body weight (`font-weight: 400`), 14–16px.
     Use `font-weight: 600` ONLY when bold conveys information role
     (e.g., the question being answered on a row). Never for visual
     hierarchy alone.
   - Placeholder shapes for icons/avatars/logos: grey rounded
     rectangles (`background: #D4D4D4; border-radius: 4px;`) at
     appropriate sizes. NO inline SVG icons, NO emoji, NO real logos.
   - Buttons: same wireframe palette — grey pill or rectangle, plain
     text label, no fill color. Disabled = `#EEEEEE` fill, `#999` text.
   - No gradients, no shadows beyond a single hairline border, no
     animations.
   - Use real domain text labels plainly rendered. "Schedule of
     Assessments" should look identical in weight/size to "Inclusion
     Criteria" — no visual hierarchy beyond what conveys role.
3. After all screens in the flow exist, call
   `mcp__paper__get_screenshot` on the first screen and inspect for
   slop (filler text, generic CTAs, decorative elements that snuck
   in).
4. Call `mcp__paper__finish_working_on_nodes` when the flow is done.

The 3 flows differ on:
- **Flow 1: Critical-path slice** — the 3–5 most important screens of
  the journey, in order, end-to-end. The "if I only had time to ship
  this, this is it" version.
- **Flow 2: Edge-case slice** — the same journey but showing the
  high-stakes agent states firing at the moments where they matter.
  Hallucination flag, timeout state, escalation handoff.
- **Flow 3: Power-user slice** — the journey when the user is fast,
  knows the system, and is doing this for the 50th time. Shows
  keyboard shortcuts, batch actions, density.

If the journey doesn't support 3 distinct slices, generate 2 and
explain why the third would be redundant.

### Step 4 — Navigation map

Generate the explicit navigation map that `/paper-to-prototype` will
consume. Strict format:

```markdown
## Navigation map

### Flow 1

- Screen: [artboard-name-1]
  - CTA: "[exact button label]" → [artboard-name-2]
    - Data passed: { fieldName: type, … }
  - CTA: "[exact button label]" → [artboard-name-3]
    - Data passed: { … }

- Screen: [artboard-name-2]
  - CTA: "[label]" → [artboard-name-3]
    - Data passed: { … }
  - On agent state [hallucination]: surfaces [pattern] inline,
    no nav change.

### Flow 2
…

### Flow 3
…
```

Every CTA must name an exact button label (matching what's in Paper)
and a target screen. Agent-state UX that doesn't navigate is also
listed, marked "no nav change."

Save the navigation map to `./NAVIGATION.md` in the project.

## Output structure

```markdown
# Lo-fi + components

Designing for:
- Persona: …
- JTBD: …
- Chosen direction: …
- High-stakes agent states: …

## Component taxonomy
[10 or fewer atoms with props/states]

## Flows in Paper
- Flow 1 — Critical-path slice: artboards [flow-1/screen-1-…, …]
- Flow 2 — Edge-case slice: artboards […]
- Flow 3 — Power-user slice: artboards […]

## Navigation map
[See ./NAVIGATION.md]

## Assumptions made
- [Domain term assumed because not in PRD]: [what was used and why]
```

## Append to decision log

After output, append to `./DECISIONS.md`:

```
## Lo-fi + components — [N] atoms, 3 lo-fi flows in Paper — chose [one specific design call, e.g., "inline agent flags over sidebar panel"] — gave up [tradeoff]
```

## Anti-slop scan (before output) — wireframe-specific

Reject and regenerate if ANY screen contains:
- Any fill outside `#E5E5E5` / `#FFFFFF` / `#D4D4D4` greyscale (no
  colors, no brand fills)
- Any font weight other than 400 or 600 (and 600 only where bold
  conveys information role)
- Any font size outside the 14–16px body range (no h1/h2/h3 hierarchy)
- Any gradient, shadow beyond hairline border, or animation
- Any inline SVG icon, emoji, or real logo — only `#D4D4D4` rounded
  rectangle placeholders
- Any "Block," "Section," "Item," "Element" as an atom name (unless
  it's a literal HTML primitive)
- Any state list with "loading," "error," "success" without a
  /agent-states tie
- "Lorem ipsum," "Section 1," "Heading goes here," "Click here,"
  "Learn more"
- Em dashes anywhere in Paper text content
- AI-slop CTAs: "Get started," "Discover," "Unlock," "Empower,"
  "Transform," "Revolutionize"

**The screenshot test**: open the screenshot and ask yourself — does
this look like (a) a wireframe sketch someone made in 5 minutes, or
(b) a real product? If (b), reject and strip the visual polish.
Wireframe means deliberately ugly-but-readable.

If a screen reads like a marketing landing page, reject it. Lo-fi
screens for an agent-feature product look like working tools.

## What slop looks like (reject this exact pattern)

A Paper artboard with:
- Hero block at top: "Transform your regulatory writing workflow with AI"
- Three feature cards: "Intelligent suggestions," "Seamless
  compliance," "Empower your team"
- CTA button: "Get started"

That's a marketing site. The PRD is for a working tool. Reject and
regenerate.

## Note on Paper library reuse (deferred)

The user has flagged that Paper → React handoff fails because Claude
Code regenerates components from scratch in React instead of reusing
the Paper library. A future version of this skill will enforce
library-first generation (build atoms in a `lib/` namespace, then
compose screens from library nodes). For now, the seam discipline is
in `/paper-to-prototype` — when generating React, that skill must
read this skill's component taxonomy and the Paper tree first, then
build a 1:1 React component library before screen assembly.
