---
name: founding-design-ideation
description: >
  A structured AI-assisted design ideation skill for product designers working from a brief
  through to a Claude Code-ready PRD. Use this skill whenever someone shares a product design brief,
  asks to run a design exercise, wants to ideate on a product concept, needs to define a persona or
  map pain points, wants to explore how AI agents would work in a product, or is trying to go from
  a brief to a spec. Also triggers for: "help me think through this design problem", "run my design
  process", "ideation exercise", "I have a brief", "help me design a workflow", "turn this into a PRD".
  Covers AI-native product design end-to-end: brief digestion, persona definition, pain point mapping,
  HMW generation, agent futures ideation, technical scoping and integration mapping, agent state machine
  design, and full PRD generation in a Claude Code-ready format.
---

# Founding Design Ideation Skill

## Philosophy

This skill compresses the ideation loop from Brief → Claude Code-ready PRD into a reviewable,
step-by-step process. The designer stays deeply engaged at the front (brief digestion, user
research, pain points) and reviews each subsequent phase without generating it from scratch.

**Human-led phases (slow down, invest time here):**
- Phase 1: Brief digestion
- Phase 2: Persona definition
- Phase 3: Pain point mapping

**AI-accelerated phases (run, review, approve, move on):**
- Phase 4: HMW generation
- Phase 5: Agent futures ideation
- Phase 6: Edge case enumeration ← single-persona-anchored, 6 categories
- Phase 7: Technical scoping and integration mapping ← often skipped, always needed
- Phase 8: Agent state machine design
- Phase 9: PRD generation (Claude Code-ready)

---

## Hard rules

- **Single primary persona.** Design every flow, screen, and decision
  point for ONE primary persona. Secondary personas appear in mock
  data and activity timelines (e.g., as authors of comments, owners
  of assigned issues) but they NEVER get a dedicated user view,
  journey, or feature. If a stakeholder asks "what about [secondary
  persona]?" — flag as a follow-up project and ship the
  primary-persona scope first.
- **Edge cases are first-class.** Phase 6 (Edge case enumeration) is
  not optional. The 6 categories (empty / error / stress / permission
  / data / temporal) each need ≥ 3 concrete scenarios with named
  expected behaviors. The PRD carries this table forward as Section
  21; the hi-fi build generates the corresponding states; `/ux-review`
  tests one per walkthrough.
- **Assumptions are tracked, not hidden.** Phase 1 produces an
  assumptions table (not a list). Every subsequent phase references
  assumptions by ID (A1, A2…) when its decisions depend on them. The
  PRD's Section 22 carries the table forward.
- **Notion is the canonical destination.** Markdown is the working
  format; the Notion MCP publishes each phase as a page (see Publish
  to Notion section below). Local `.md` is always written as backup.

---

## How to invoke

When a user shares a brief or design problem, orient them:

> "I'll run the founding design ideation process with you. We'll go through 9 phases —
> you lead the first three (brief, persona, pain points), then I'll generate phases 4–9
> for you to review and approve before we produce the final PRD.
> Want to start with Phase 1, or jump to a specific phase?"

If they want to run a specific phase, jump directly to it. If they have outputs from
earlier phases, accept them and continue from wherever they are.

---

## Publish to Notion (default behavior)

If the Notion MCP is loaded (`mcp__claude_ai_Notion__*` tools available in
the session), this skill publishes each phase's output **directly to a
Notion page** in addition to writing the local `.md` file.

**Publishing flow per phase:**

1. Write the phase output to `./IDEATION-PHASE-N.md` locally (backup + diff
   history).
2. **First phase of the session only**: ask the user once where to land the
   Notion pages. Acceptable answers:
   - A Notion page URL or page ID (the parent under which to create the
     phase pages).
   - A search query (e.g., "Design Exercises") — use
     `mcp__claude_ai_Notion__notion-search` to find a matching parent and
     confirm with the user before creating.
   - "Workspace root" — create at the top level.
   Remember the answer in conversation state for the rest of the session;
   don't re-ask per phase.
3. For each phase: call `mcp__claude_ai_Notion__notion-create-pages` with
   the phase's markdown content. The MCP accepts markdown directly; tables,
   headings, lists, and code blocks render natively.
4. After creation, report **both** the local file path **and** the Notion
   URL back to the user. The Notion URL is the canonical artifact; the
   local `.md` is the backup.

**If Notion MCP is not loaded**: fall back to local `.md` only and tell the
user "Notion MCP unavailable — wrote `./IDEATION-PHASE-N.md` locally. To
publish directly: `claude mcp add notion` (or sign in to the Notion MCP)."

**Hard rules**:

- Never emit Notion-specific markdown extensions (`[!NOTE]` callouts, MDX,
  mermaid). Plain markdown only — tables, headings, lists, code blocks,
  bold/italic. The Notion MCP's markdown importer is strict.
- Never silently overwrite an existing Notion page. If a phase page already
  exists under the parent, ask whether to update it or create a new
  versioned copy.
- The local `.md` is always written, even on Notion publish success — it's
  the version-control-friendly source of truth.

---

## Phase 1 — Brief digestion

**Goal:** Extract signal before any ideation begins. No solutions yet.

**Prompt template:**
```
You are a senior product designer helping digest this brief before ideation.

Brief: [BRIEF]

Produce:
1. Core problem restatement — one sentence, precise
2. Explicit constraints (things the brief states directly)
3. Implicit constraints (things the brief implies but doesn't say)
4. Assumptions log (TABLE format — see schema below)
5. What success looks like — and what this PRD is NOT asking to solve
6. AI framing: is this (a) human workflow AI-assisted, (b) new AI-native workflow,
   or (c) agent-led workflow with human oversight? Explain which and why.

ASSUMPTIONS LOG TABLE SCHEMA — every assumption gets an ID (A1, A2, …)
that subsequent phases will reference:

| # | Assumption | Why we're making it | How to validate | Status | Impact if wrong |
|---|---|---|---|---|---|
| A1 | [The assumption itself] | [Brief signal or absence that pushed us here] | [Specific validation step] | Untested / In-progress / Confirmed / Rejected | [What breaks if this is wrong] |

Produce 4–8 assumptions. Each row must have all 6 columns filled. Status
starts as "Untested" for every row; subsequent phases update it.

No ideation. Structured sections only.
```

**Review checklist before proceeding:**
- Core problem restatement is accurate
- Constraint list reflects the actual brief (add/remove as needed)
- Assumptions log has all 6 columns, every row, IDs assigned (A1, A2…)
- AI framing is correct

---

## Phase 2 — Persona definition

**Goal:** Define the primary persona with enough depth to drive pain point quality.

**Prompt template:**
```
You are a senior product designer. Based on this brief, define the SINGLE
primary persona. Per the hard rules: we design for ONE persona only.
Secondary personas appear in mock data and activity timelines (as
authors of comments, owners of assigned issues, etc.) but get zero
dedicated screens or journeys.

Brief summary: [PHASE 1 OUTPUT]

For the primary persona define:
- Role title and accountability
- What they are NOT responsible for (scope boundary)
- Day-to-day workflow touchpoints related to this problem
- What "success on a good day" looks like
- What "failure on a bad day" looks like
- Relationship to AI tools: power user / skeptic / first exposure
- Information asymmetries: what they know others don't, and vice versa
- Assumption IDs from Phase 1 this persona is grounded in (e.g.,
  "Grounded in A1, A3 — if A1 is wrong, this persona's accountability
  scope is wrong too.")

Then produce a FLAT REFERENCE LIST (no design effort) of secondary
personas — name, role, one-line relationship to the primary persona's
workflow. These exist only to populate mock data downstream; they
will NOT get dedicated screens.

No pain points yet. Persona only.
```

**Review checklist:**
- Primary persona's accountability is specific and narrow
- AI relationship rings true
- Secondary personas are flat reference (no design effort spent)
- You'd recognize this person if you met them
- Assumption IDs cited where the persona depends on a Phase 1 assumption

---

## Phase 3 — Pain point mapping

**Goal:** Anchor pain points to specific workflow moments, not vague frustrations.

**Prompt template:**
```
You are a senior product designer mapping pain points to workflow touchpoints.

Persona: [PHASE 2 OUTPUT]

For each pain point produce a row in this table:
Touchpoint | What they want | What actually happens | Severity | Failure type | AI-addressable?

Severity: Blocking / High / Medium / Minor
Failure type: coordination failure / information gap / decision quality / trust problem / compliance risk
AI-addressable: Yes (detection/suggestion/automation would help) / No (fundamentally human) / Partial

Then list 2–3 pain points NOT worth solving in v1 and explain why.
```

**Review checklist:**
- Each pain point is attached to a real workflow moment
- Severity ratings match actual priorities
- AI-addressable column reveals where automation helps vs. intrudes
- Not-worth-solving list is honest

---

## Phase 4 — How Might We

**Goal:** Convert pain points into HMW questions that drive ideation, not feature lists.

**Prompt template:**
```
Convert these pain points into How Might We questions for a design sprint.

Pain points: [PHASE 3 OUTPUT]

Rules:
- Neither too narrow (pre-solves the problem) nor too broad (means anything)
- One HMW per major pain point cluster
- Flag which HMWs are most generative (multiple viable solution directions)
- Flag which HMWs have the most AI-specific design space

Output: numbered list with a one-line note on scope calibration for each.
```

**Designer action:** Cull HMWs that feel feature-adjacent. Select 3–5 to carry into Phase 5.

---

## Phase 5 — Agent futures ideation

**Goal:** Explore what agents can own and where humans must stay in the loop.

**Prompt template:**
```
You are designing an AI-native product. Using these HMWs, ideate the future state
where AI agents handle as much of this workflow as possible — while preserving human
judgment at the right moments.

HMWs: [SELECTED HMWS FROM PHASE 4]

For each HMW produce:
1. Agent-led future state: what does the agent do, in what sequence, triggered by what?
2. Mandatory human-in-the-loop moments: where must a human review, approve, or correct? Why?
3. Optional human touchpoints: where could a human intervene but doesn't need to?
4. What the agent needs to function: data, tools, APIs, integrations
5. Where the agent will fail or be uncertain: low-confidence scenarios, edge cases
6. How the human sees the agent's work: what surfaces make agent behavior legible?

Keep each section tight — this is ideation, not a spec.
```

---

## Phase 6 — Edge case enumeration

**Goal:** Enumerate the full set of edge cases the app must handle, anchored to
the primary persona's flows. The PRD carries this table forward; the hi-fi
build generates the states; `/ux-review` tests one per walkthrough.

**Prompt template:**
```
You are enumerating edge cases for an AI-native product before technical
scoping. Edge cases must be primary-persona-anchored — do not enumerate
edges for secondary personas.

Agent ideation: [PHASE 5 OUTPUT]
Persona: [PHASE 2 PRIMARY]
Pain points: [PHASE 3]
Assumptions log: [PHASE 1 ASSUMPTIONS TABLE]

Produce 6 edge-case categories. For each, list 3–5 concrete scenarios
and the EXPECTED app behavior (not just the failure mode):

1. EMPTY STATES
   What the user sees when there is no data yet, all items closed, or
   first-time use.

2. ERROR STATES
   Network failure, agent unavailable (agent-states #6 Fallback),
   partial load failures, invalid input.

3. STRESS STATES
   1000s of items, simultaneous edits by multiple users, very long
   strings, high-frequency notifications.

4. PERMISSION EDGES
   User without rights, suspended account, session expired, role
   change mid-action.

5. DATA EDGES
   Malformed input, special characters, very long strings, missing
   required fields, duplicate IDs.

6. TEMPORAL EDGES
   Deadline passed, simultaneous edits / version conflicts, stale data
   on screen, agent recommendation made before relevant state change.

Output format — a single table:

| Category | Scenario | Expected behavior | Severity | Assumption IDs |
|---|---|---|---|---|

Severity scale:
- **Filing-blocking**: filing or primary-task completion cannot proceed
- **High**: the JTBD breaks if not handled
- **Medium**: UX degrades but task completes
- **Low**: absorbed silently by the agent or by graceful UI

Cap at 24 rows total (4 per category max). Cite Phase 1 Assumption IDs
in the last column when an edge case is contingent on an assumption
being correct.
```

**Review checklist:**
- Every category has ≥ 3 scenarios
- Every scenario names the EXPECTED app behavior, not just the failure
- Severity is calibrated against the scale above
- All scenarios anchor to the primary persona's flows
- Assumption IDs cited where edge cases depend on Phase 1 assumptions

---

## Phase 7 — Technical scoping and integration mapping

**Goal:** Define the technical surface area. What tools do agents use? What integrations
exist, what are in/out of scope, what does the data model imply?

This phase is critical and frequently skipped — it bridges ideation and PRD, and prevents
the PRD from having vague "AI does X" statements without real tools behind them.

**Prompt template:**
```
You are a senior product designer and technical architect scoping an AI-native product.

Agent ideation: [PHASE 5 OUTPUT]
Brief constraints: [PHASE 1 CONSTRAINTS]

Produce:

1. AGENT TOOL INVENTORY
   For each agent capability, list:
   - Data read sources (what it reads and from where)
   - Data write targets (what it modifies and where)
   - Classification/inference actions (LLM calls, NLP, rules engines)
   - Notification/messaging actions (in-app, email, Slack, webhook)
   - State mutation actions (what state it changes)

2. INTEGRATION MAP
   For each external system that could connect:
   - Integration name and type (read / write / bidirectional)
   - In scope for v1? (Yes / No / Future)
   - If out of scope: what does the product do instead?
   - Runtime risk if integration is unavailable

3. DATA MODEL SKETCH
   Core objects the product must store:
   - Object name
   - Key fields (name, type, required/optional)
   - Relationships to other objects
   - Owner: user vs. agent vs. system

4. AGENT FAILURE TAXONOMY
   For each agent capability:
   - Happy path behavior
   - Low-confidence fallback (uncertain but can continue)
   - Hard failure fallback (cannot complete)
   - What the user sees in each case

5. TECHNICAL CONSTRAINTS
   - Systems without live API access
   - What must be deterministic vs. AI-generated
   - What requires human approval before state changes
   - What must be immutably logged
```

**Review checklist:**
- No vague "AI does X" — every capability has a real tool behind it
- Integration map cleanly separates v1 from future
- Data model has enough fields to be implementable
- Failure taxonomy covers cases you'd be embarrassed to ship without handling
- Technical constraints reflect the actual brief

---

## Phase 8 — Agent state machine design

**Goal:** Formalize state transitions so the PRD is implementable, not just descriptive.

**Prompt template:**
```
Design the agent state machine for this product.

Technical scoping: [PHASE 7 OUTPUT]
Edge cases: [PHASE 6 OUTPUT]

For each stateful object produce:

1. STATE LIST — all valid states with a one-line user-facing description

2. TRANSITION TABLE (as a table):
   From state | To state | Trigger | Guard condition | Side effects

3. TERMINAL STATES — which states have no further transitions? What happens?

4. AGENT VS. HUMAN TRANSITIONS
   For each transition mark: User / Agent / Either
   Flag transitions where the agent should PROPOSE but the human must CONFIRM.

5. INVALID STATE HANDLING
   What happens if a mutation is attempted that isn't valid?
   Who is notified? What is the recovery path?

Use plain language state names, not enum-style codes.
Output as tables.
```

---

## Phase 9 — PRD generation

**Goal:** Produce a Claude Code-ready PRD. Every section must be complete — no TBDs.

Use the PRD template skill (`/code-ready-prd`) for the exact section requirements,
or produce all 22 required sections inline:

1. Document header
2. Background and context
3. Problem statement
4. Product goal
5. Success criteria
6. Non-goals
7. Primary persona (canonical — only ONE; secondary personas appear as flat reference list for mock data only)
8. Design principles
9. Information architecture
10. Core screens (for the primary persona)
11. User stories (for the primary persona only)
12. Functional requirements (state model, severity, confidence, notifications, permissions)
13. Feature specs (description, user actions, agent actions, tech scope, failure states, risk pattern)
14. **Component inventory** ← Claude Code critical
15. **Data schema** ← Claude Code critical (field-level types)
16. **State transition table** ← Claude Code critical (formatted as table)
17. **Agent capability spec** ← Claude Code critical
18. **Mock data examples** ← Claude Code critical (realistic values, multiple states)
19. **Navigation and routing** ← Claude Code critical
20. **Tech stack declaration** ← Claude Code critical
21. **Edge cases** ← Claude Code critical (carried from Phase 6, with UI surface column added)
22. **Assumptions log** ← Claude Code critical (carried from Phase 1, with current validation status)

**PRD quality gate before Claude Code:**
- All 22 sections present, none say TBD
- Every agent action has a defined fallback
- Component inventory lists actual component names with props
- Data schema has field-level types (string, uuid, enum, timestamp, boolean)
- State transition table is a table, not prose
- Mock data uses realistic values, not placeholders
- Tech stack is fully declared
- Edge cases section has ≥ 12 rows (3 per category minimum across 6 categories)
- Assumptions log has every assumption flagged with current validation status

---

## Quick reference

| Phase | Goal | Leads | Output |
|-------|------|-------|--------|
| 1. Brief digestion | Extract signal, log assumptions in a table | Human reviews | Structured brief + assumptions table |
| 2. Persona definition | Define the SINGLE primary persona | Human reviews | Primary persona block + flat secondary-persona reference list |
| 3. Pain point mapping | Anchor problems to moments | Human reviews | Touchpoint × pain point table |
| 4. HMW generation | Frame ideation questions | AI → human culls | HMW list |
| 5. Agent ideation | Explore what agents can own | AI → human reviews | Agent capability ideation |
| 6. Edge case enumeration | Map empty/error/stress/permission/data/temporal edges | AI → human reviews | 24-row edge case table |
| 7. Technical scoping | Tools, integrations, data model | AI → human reviews | Integration map + data sketch |
| 8. State machine | Formalize state transitions | AI → human reviews | State transition tables |
| 9. PRD generation | Produce Claude Code input | AI → human QA | Full PRD (22 sections, carrying assumptions + edges forward) |
