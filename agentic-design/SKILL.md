---
name: agentic-design
description: |
  Prioritize WHERE agentic functionality should land in a product
  before implementation. Walks through 4 beats: JTBD-beat decision
  density, agent-state coverage gaps, the "remove test," and
  background-vs-foreground placement. Produces a tiered placement
  plan (Tier 1 critical-path / Tier 2 supporting / Tier 3 skip) in
  ./AGENTIC-PLACEMENT.md. Use BEFORE adding AI features to a
  prototype, not after. Output composes downstream with
  /tooltip-walkthrough (annotate the placements in the prototype) and
  /ux-review (audit-and-fix loop). Triggers: "where should AI go",
  "prioritize AI features", "agentic placement", "agent design
  principles", "should this have AI", "AI feature prioritization".
  Composes upstream with /code-ready-prd (which composes from
  /founding-design-ideation).
license: MIT
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Agent
---

## Role

Thinking partner AND generator. Walks the user through a 4-beat
prioritization for agentic features, then implements the Tier 1
LLM-driven ones as real Claude calls wired into the prototype.
Output is a placement plan AND working code, not just one or the
other.

The skill exists because adding AI to a product is cheap; adding AI
*to the right surface, with the right confidence calibration* is the
actual design problem. Skip this skill and you ship features that
look AI-rich but don't move the JTBD needle. Run this skill first
and you ship two strong features instead of five thin ones — and
they actually run, not just render placeholder badges.

**Generator behavior is the default.** When the prototype is present
in the cwd, the skill writes server actions and wires them into the
UI for every Tier 1 (and any Tier 2) LLM-driven feature. Skip the
implementation phase with `--plan-only` if you want just the
placement doc; skip the planning phase with `--implement-only` if
the placement already exists at `./AGENTIC-PLACEMENT.md`.

## Speed budget

**Wall-clock target ≤3 min for planning, ≤15 min for full
plan+implement.** Use parallel sub-agents wherever beats decompose
into independent units of analysis. High compute is acceptable —
wall-clock speed is the primary constraint. Beats 2 and 4 spawn
parallel batches for analysis; Beat 5 spawns a parallel batch for
implementation (one agent per Tier 1+2 LLM feature). Beats 1, 3, 6,
and 7 are synthesis or wiring passes on the main thread.

## When to run

- **Starting AI-feature design** for any prototype, before writing
  renderers.
- **Deciding whether to add an N+1 AI surface** to an already-AI-rich
  prototype (where the question is whether the marginal AI feature
  earns its visual real estate).
- **Reviewing existing AI placements** when the user suspects "we
  sprinkled AI on random stuff."

## When NOT to run

- Features are already implemented end-to-end (planning AND live
  calls AND fallbacks). Use `/ux-review` instead.
- The prototype has no working flow yet. Do `/product-thinking` first
  to lock the PRD + JTBD, then return here.
- The user wants only a planning artifact (no code). Pass
  `--plan-only` to stop after Beat 4.

## Hard rules

- **Map to JTBD beats, not screens.** Screens are containers; beats
  are decisions. AI belongs where decisions live.
- **Decision-density gate.** If a beat has no judgment call, AI is
  decoration. Skip.
- **Remove test.** If removing the feature still lets the user
  complete the JTBD, it's not Tier 1.
- **Confidence calibration is non-negotiable.** Every AI surface
  needs a confidence indicator + a fallback path (see `/agent-states`
  states #3 Hallucination, #6 Fallback, #10 Confidence Threshold Not
  Met, #11 Degraded Mode). No surface ships without all three.
- **Background ≠ foreground.** Pattern-surfacing on the screen the
  user lives on; specialist perspectives on the screen the user opens
  for the decision. Mixing them is the "AI everywhere" anti-pattern.
- **Real estate is finite.** Each new AI affordance costs visual
  budget on the surface. Two strong AI features beat five thin ones.

## Pipeline (4 beats + write)

### Beat 1 — JTBD beats and decision density (~20s)

If `./PRD.md` exists, parse the JTBD + success metrics directly.
Otherwise ask the user once: "What's the JTBD broken into beats?"

For each beat, tag **Decision-density: High / Medium / Low**:
- **High** — user makes a judgment call (approve/reject, prioritize,
  reassign, override).
- **Medium** — user reads state and decides whether to act (triage,
  scan a queue).
- **Low** — user just reads (view a status, confirm a fact).

Output: numbered list of beats with density tags. Sub-agents are
not used; this is a one-pass synthesis on the main thread.

### Beat 2 — Agent-state coverage gaps (~30–60s, **parallel**)

Spawn **one `Explore` agent per High-density beat** in a single
tool-call batch (cap 4 agents per batch). Each agent receives a
self-contained prompt with:

- The beat name + JTBD context.
- Path to `~/.claude/skills/agent-states/SKILL.md` (the 13-state
  reference).
- Path to the prototype source if one exists.
- Instruction: "For this beat, return which of the 13 agent states
  fire. For each that fires, cite (a) the pattern from agent-states
  that handles it and (b) whether the prototype already has that
  pattern (file:line). Format as a markdown table."

Each agent returns a 13-row table. Main thread merges into one
coverage matrix per High-density beat.

**Why parallel**: each beat's coverage analysis is independent. N
beats analyzed in parallel = wall clock of 1 beat.

### Beat 3 — Apply the "remove test" (~20s)

Ask the user (or derive from prior context): "What candidate AI
features are on the table for this product?"

For each candidate (typically 3–7), evaluate inline on the main
thread:

> If we remove this feature, can the user still complete the JTBD?
> If yes, what's the cost?

Tag each candidate **Removal-cost: High / Medium / Low**:
- **High** — JTBD breaks without it (no path to a decision, or path
  exists but introduces a known agent-state failure).
- **Medium** — JTBD completes more slowly or less confidently.
- **Low** — JTBD completes unchanged.

No sub-agents; this is a one-pass synthesis with the matrix from
Beat 2 in hand.

### Beat 4 — Background vs Foreground placement (~30s, **parallel**)

Spawn **one `general-purpose` agent per Tier 1+2 candidate** in a
single tool-call batch (cap 5 agents per batch). Each agent receives:

- Feature name + description.
- Decision-density of the beat it serves (from Beat 1).
- Removal-cost (from Beat 3).
- Current prototype IA summary (main thread provides 5–10 lines).

Each agent returns:
- **Recommended placement**: Background (name the highest-traffic
  surface this lives on) OR Foreground (name the lowest-frequency-
  but-highest-stakes screen).
- **One-sentence why.**
- **One anti-pattern callout** — what NOT to do with this feature.

Main thread merges into the placement column of the tier list.

**Why parallel**: each candidate's placement reasoning is
independent. N candidates analyzed in parallel = wall clock of 1.

### Beat 5 — Implement Tier 1 + 2 LLM features (~5–10 min, **parallel**)

**This is the generator phase. Default ON when a prototype is present in the cwd.** Stop here with `--plan-only` if all you want is the doc.

Filter the placement plan to features that are GENUINELY LLM-driven. Per the PRD-style framing common to these exercises:

- **Keep:** semantic ranking, generative summaries, classification with open-set inputs, natural-language search, content paraphrasing, drift / change explanation, prioritized digests.
- **Skip:** deterministic mappings (e.g. `document_type → audience`), atomic writes, event-driven monitors, threshold gates, anything the PRD explicitly says is rule-based.

Tier 1 always implements. Tier 2 implements when the wall-clock budget allows (it usually does — each implementation agent runs in parallel).

Spawn **one `general-purpose` agent per LLM-driven feature** in a single tool-call batch (cap 5 agents per batch). Each agent receives:

- The placement entry verbatim (beat served, agent state covered, anti-pattern).
- The exact PRD capability spec for the feature (PRD §17 entry, or equivalent).
- The architecture contract (below).
- The Zod schema shape expected.
- The fallback rules.
- The output file path: `src/lib/ai/<kebab-feature-name>.ts`.

**Architecture contract (every agent MUST follow):**

- Server-only via `import "server-only"` at the top of the file.
- Next.js Server Action (`"use server";` directive) or a server-only helper imported by a server action.
- `@anthropic-ai/sdk` — single `client.messages.parse()` call. NOT the Claude Agent SDK unless the feature genuinely requires multi-turn tool use.
- `claude-opus-4-7` with `thinking: {type: "adaptive"}` and `output_config: {effort: "high"}` for intelligence-sensitive work, `"medium"` for short outputs. No `temperature`, `top_p`, `top_k`, `budget_tokens` (all 400 on Opus 4.7).
- Structured output via Zod schema (`z.toJSONSchema()` into `output_config.format`).
- Prompt cache breakpoint on the system prefix (`cache_control: {type: "ephemeral"}`); volatile payload in the last user-turn block.
- Wrap the call in `unstable_cache(fn, [version, contentHash], { revalidate: 3600 })`.
- **Fallback contract (non-negotiable):**
  - API key missing → silent fallback to a deterministic mock. No banner. `apiDegradedAt` stays null. The prototype must work offline.
  - API call fails (network, schema, timeout) → fallback + set `degradedAt = new Date().toISOString()` so the UI's existing degraded banner fires.
  - PRD guard conditions (e.g. `source_inaccessible`, `out_of_scope`) → skip the call entirely; render the deterministic blocked state.
- Return type includes `degradedAt: string | null` and `offline: boolean` so the caller can drive UI honesty.

Each agent writes its file, then returns the file path plus the consuming-screen export signature so Beat 6 knows where to wire.

### Beat 6 — Wire features into UI (~2–3 min, main thread)

After Beat 5 returns, main thread updates each consuming screen (server components, since the actions are server-side). For each implemented feature:

1. Import the server action from `@/lib/ai/<feature>`.
2. Replace the hardcoded mock value with an awaited call.
3. Plumb `degradedAt` through to whatever UI surface already signals degradation (existing rail banner, status dot, etc.). Do NOT invent new degradation surfaces — reuse what's there.
4. If the consumer is a client component, expose the action via `useTransition` + `useState` and call from an `onSubmit` or effect.

If a feature serves a control that was previously "preview only" (filter pills, search inputs), this beat removes the `aria-disabled` treatment because the control now works.

### Beat 7 — Build, smoke test, update placement doc (~2 min, main thread)

- `npx next build` (or framework equivalent). Must pass.
- Probe routes via `node fetch` or Playwright — every route still returns 200.
- Manually verify ONE feature against the API key path and ONE against the no-key fallback path (each takes ~30 seconds).
- Update `./AGENTIC-PLACEMENT.md` to mark implemented features with a `**Status:** implemented (\`src/lib/ai/<file>.ts\`)` line. Tier 3 entries remain skipped.

### Final write — `./AGENTIC-PLACEMENT.md`

Single write at the end. Structure:

```markdown
# Agentic placement plan — [iso date]

## JTBD beats
1. **Beat name** — Decision-density: High/Medium/Low
2. …

## Agent-state coverage (High-density beats only)
[merged table from Beat 2]

## Tier 1 — Critical path
### Feature N — [name]
- **Beat served:** [beat name]
- **Agent state covered:** [state name + number]
- **Placement:** [Background on screen X / Foreground on screen Y]
- **Why tier 1:** [one sentence — high removal cost or hallmark
  state coverage]
- **Anti-pattern to avoid:** [from Beat 4]

## Tier 2 — Supporting
[same shape, lighter language]

## Tier 3 — Skip
- **Feature name** — one-line rationale (failed remove test, low
  decision density, or duplicates Tier 1 real estate).

## Principles applied
- [one-line each, citing the beat where it bit]

## Open questions for the user
- [anything the skill couldn't decide without more PRD detail]
```

## Output schema (the tier list)

Each feature entry is **≤80 words**. The skill is a prioritization
tool, not a spec writer. If a feature needs more than 80 words to
describe, that's a sign Tier 3 (the feature itself is unclear, or
it's actually multiple features).

## Anti-slop scan

Reject placement-plan output containing:
- "Consider adding AI" / "May benefit from agentic features"
- "Could be enhanced with intelligence"
- Vague placement ("somewhere on the dashboard")
- Tiers without a concrete reason citation
- Features that don't map to a specific JTBD beat

Every Tier 1 entry must name: a JTBD beat, an agent state, and a
specific screen. If any of those three is missing, the entry is
incomplete.

## Composes with

- **Upstream**: `/code-ready-prd` produced `./PRD.md` + JTBD that this
  skill consumes. `/code-ready-prd` itself composes from
  `/founding-design-ideation` (brief → personas + pain points → PRD).
- **Reference**: `/agent-states` is loaded into Beat 2 sub-agents
  for the 13-state coverage rubric.
- **Downstream**: `/tooltip-walkthrough` reads `./AGENTIC-PLACEMENT.md`
  to auto-propose tooltips for each Tier 1 feature, surfacing the
  why-tier-1 rationale inline in the prototype.
- **Downstream**: `/ux-review` audits the prototype after
  implementation. If the audit's failure points cluster around
  features the placement plan tagged Tier 3, that's a signal the
  plan needs to be re-run.

## Out of scope

- **Generating screen wireframes or visual primitives.** That's
  `/build-lofi` or `/build-hifi`. This skill writes server-side AI
  glue, not UI components — but it WIRES the glue into UI surfaces
  that already exist.
- PRD or JTBD synthesis (use `/product-thinking`).
- UX audit / fix loop (use `/ux-review`).
- Multi-turn agentic loops with tool use (bash, file ops, code
  execution). If a feature genuinely requires the Claude Agent SDK,
  Beat 5 flags it and stops short of implementing — escalate to the
  user.
- Persisting decisions between sessions — each invocation produces
  a fresh `./AGENTIC-PLACEMENT.md` and ADDS to (does not regenerate)
  the `src/lib/ai/` folder.
