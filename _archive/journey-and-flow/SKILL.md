---
name: journey-and-flow
description: |
  Use when the user wants user-journey + flow alternatives + IA +
  data-model + agent decision points for any product or feature.
  Hybrid skill: 3 beats — pick a differentiation axis, generate 2–3
  directionally different journeys, force a selection. References
  /agent-states for fallback paths. Unselected alternatives are
  archived as design-rigor evidence. Composes with /product-thinking
  upstream (uses its PRD if present) and /lofi-and-components
  downstream. Works in Claude Code (writes ./JOURNEY.md) and Claude
  Chat (outputs inline).
license: MIT
allowed-tools:
  - AskUserQuestion
  - Read
  - Write
  - Edit
---

## Role

You are generating directionally different design alternatives, not
variations on the same idea. You walk the user through 3 beats:

1. Pick a differentiation axis
2. Generate 2–3 alternatives along that axis
3. Force a selection with the tradeoffs named

The unselected alternatives are kept, not deleted. They go in the PRD
appendix so the writeup can show "we considered X and Y, chose Z
because…" That's the design-rigor signal Peer AI is testing for.

## Preflight (do this before Beat 1)

### Context check

Look for upstream context, in order:
1. `./PRD.md` filled in by `/product-thinking`
2. PRD or product context pasted into this conversation
3. Nothing — ad-hoc journey work

If (1) or (2): proceed to Beat 1 with that context.

If (3): run **Beat 0 — Minimum context elicitation**. Ask the user once,
free-form: "Quick context: what's the product, who's the primary user,
what's the JTBD, and what scope of the journey are we mapping? One or
two sentences total." After their answer, proceed to Beat 1.

### Environment detection

- **Claude Code (Write/Edit available)**: write the chosen journey to
  `./JOURNEY.md` (or append to `./PRD.md` if it already has a journey
  section). Append decision to `./DECISIONS.md`.
- **Claude Chat (no filesystem)**: output the chosen journey + the
  archived alternatives inline as one markdown code block at the end.
  Output the decision-log line as a final one-liner.

## Hard rules

- **No "balanced approach" filler.** Every direction must trade off
  something concrete. If you can't name what each direction gives up,
  regenerate before showing the user.
- **No three variations of the same idea.** "AI-suggests-then-user-
  approves" vs "AI-suggests-then-user-approves-with-confirmation" vs
  "AI-suggests-then-user-approves-with-confirmation-and-undo" is one
  direction with knobs. Reject that.
- **Reference /agent-states.** Every direction's fallback paths must
  use concrete agent-state UX patterns, not "show an error."
- **Force the selection.** Don't let the user defer with "I'll think
  about it." If they hesitate, name the default *with the tradeoff*
  and append the decision.

## The three beats

### Beat 1 — Frame

Load the PRD. Identify which axes the brief plausibly differentiates
along. Common ones:

- **AI prominence**: AI-first (agent drives) / user-first (user
  drives, AI assists) / collaborative (turn-taking)
- **Risk tolerance**: conservative (max guardrails) / moderate /
  ambitious (max agent autonomy)
- **Scope**: single-step (one moment in the workflow) / multi-step
  (a sub-flow) / end-to-end (the whole job)
- **Interaction model**: synchronous (real-time agent response) /
  asynchronous (queue + notify) / batch (process and review later)
- **Control surface**: inline (agent acts in the doc) / sidebar
  (agent in a panel) / modal (agent gates the step)

Use `AskUserQuestion` to force a frame choice. Each option labeled
with the axis + a one-line "why this axis matters for this product."

User picks one frame, or names their own. Record the frame.

### Beat 2 — Generate

Generate **2–3 directionally different journeys** along the chosen
axis. For each, produce:

```markdown
## Direction [N] — [Name reflecting the position on the axis]

**Position on axis:** [e.g., "Conservative — agent only fires when
explicitly invoked, all suggestions require approval"]

**Linear flow (5–8 steps):**
1. [Step 1]
2. [Step 2]
…

**Information architecture:**
- [Top-level surface]
  - [Sub-surface]
    - [Atom]
- [Another top-level]

**Data model (JSON schema, abbreviated):**
\```json
{
  "inputs": { "fieldName": "type" },
  "outputs": { "fieldName": "type" },
  "agent_call": { "model": "string", "temperature": "number", "tools": ["string"] }
}
\```

**Agent decision points + fallback paths:**
- Step [N]: agent decides [X]. If [agent-state fires], fallback is
  [concrete UX pattern from /agent-states].

**Trades off:** [one specific thing — e.g., "trades user control for
speed: the doc auto-fills without approval gates"]

**Rationale (1 sentence):** [why this direction is internally
coherent]
```

If two directions feel too similar after generation, regenerate the
second one with sharper differentiation before showing the user.

### Beat 3 — Forced selection

Use `AskUserQuestion` with the 2–3 directions as options. Each label:
the direction name + the *one specific tradeoff* spelled out.

User picks. Record the choice + the reason they gave (free-form
follow-up: "One sentence on why this over the others.")

## Synthesis

After Beat 3, write the output:

```markdown
# Journey + flow

## Chosen direction: [Name]
[Position on axis, linear flow, IA, data model, agent decision points,
fallback paths — full detail from Beat 2.]

## Selected because
[User's exact one-sentence reason from Beat 3.]

## Alternatives considered (appendix)

### [Direction 2 name]
[Trades off + rationale only — full detail collapsed.]

### [Direction 3 name]
[Trades off + rationale only.]
```

Write to `./PRD.md` (appending to existing PRD) or `./JOURNEY.md` if
PRD doesn't have a journey section yet.

## Append to decision log

After synthesis, append to `./DECISIONS.md`:

```
## Journey + flow — Chose [direction name] — [user's exact reason] — gave up [tradeoff from Beat 2 of chosen direction]
```

## Anti-slop scan

Strip:
- "Balanced," "best of both worlds," "flexible," "scalable"
- Any direction that doesn't trade off something specific
- Step descriptions that read like marketing ("intuitively guides
  the user")
- Em dashes
- Restating the PRD in the journey

If a direction's rationale is "it's flexible and powerful," reject it
and regenerate.

## What slop looks like

> **Direction 2 — Balanced AI assistance**
> The system provides a balanced AI experience where the user can
> leverage AI suggestions while maintaining control. This direction
> offers flexibility for various use cases.

That direction is meaningless. Reject it. A direction must name (a)
its position on the axis the user picked in Beat 1, (b) the *one*
thing it gives up, (c) what it's optimized for. "Balanced" is the
absence of a decision.
