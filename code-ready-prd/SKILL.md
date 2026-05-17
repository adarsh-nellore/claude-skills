---
name: code-ready-prd
description: >
  Generates and validates Claude Code-ready PRDs (Product Requirements Documents) for AI-native products.
  Use this skill whenever someone needs to write, complete, audit, or patch a PRD for use with Claude Code,
  Cursor, or any AI coding tool. Triggers for: "generate a PRD", "make a PRD for Claude Code", "turn this
  spec into a PRD", "what's missing from my PRD", "audit my PRD", "my PRD is missing components",
  "Claude Code needs more detail", "add the data schema to my PRD", "write the tech stack section",
  "turn this design output into a PRD", "make this Claude Code ready". Also triggers when someone has
  completed a design exercise and wants to generate the final implementation document. The PRD this skill
  produces includes all 22 required sections: component inventory, data schema with field-level types,
  state transition tables, agent capability specs, mock data examples, routing, tech stack declaration,
  edge cases table (6 categories: empty/error/stress/permission/data/temporal), and assumptions log.
  Designs for a SINGLE primary persona only — secondary personas appear in mock data, never as
  dedicated views.
---

# Claude Code PRD Skill

## Hard rules

- **Single primary persona.** The PRD designs every flow, screen, and
  decision point for ONE primary persona (Section 7). Secondary personas
  appear in mock data and activity timelines (Section 18) but they NEVER
  get a dedicated user view, journey, or feature. If a stakeholder asks
  "what about [secondary persona]?" — flag as v2 and ship the
  primary-persona scope first.
- **Edge cases are a first-class section.** Section 21 (Edge cases) is
  Claude Code-critical, not optional. Carried from `/founding-design-ideation`
  Phase 6. Minimum 12 rows (3 per category across 6 categories).
- **Assumptions are tracked, not buried.** Section 22 (Assumptions log)
  carries the Phase 1 assumptions table forward with current validation
  status. Claude Code references assumptions by ID (A1, A2…) if an
  implementation decision forces a re-evaluation.

---

## What this skill does

Produces or audits a PRD formatted for direct use as a Claude Code input. The key difference
from a standard product PRD: this format includes the 6 sections that Claude Code specifically
needs to generate working code without back-and-forth.

**The 6 Claude Code-critical sections (often missing from standard PRDs):**
- Component inventory (actual component names, types, props, screens)
- Data schema (field-level types: uuid, enum, timestamp, boolean — not just object names)
- State transition table (formatted as a table with triggers and guards, not prose)
- Agent capability spec (input/output/confidence/fallback/human touchpoint per action)
- Mock data examples (realistic JSON, multiple states, not placeholder values)
- Navigation and routing (explicit route paths)
- Tech stack declaration (framework, styling, DB, auth, AI calls — nothing assumed)

---

## How to invoke

**Generate a full PRD:**
> "Generate a Claude Code PRD for [product/feature description]"

**Audit an existing PRD:**
> "Audit this PRD for Claude Code readiness" + paste PRD

**Patch missing sections only:**
> "Add the missing Claude Code sections to this PRD" + paste PRD

---

## Publish to Notion (default behavior)

If the Notion MCP is loaded (`mcp__claude_ai_Notion__*` tools available in
the session), this skill publishes the PRD **directly to a Notion page** in
addition to writing the local `./PRD.md` file.

**Publishing flow:**

1. Write the full PRD to `./PRD.md` locally (backup + version control).
2. **First publish per session**: ask the user once where to land the PRD.
   Acceptable answers:
   - A Notion page URL or page ID (parent under which to create the PRD).
   - A search query (e.g., "PRDs") — use
     `mcp__claude_ai_Notion__notion-search` to find a parent, confirm before
     creating.
   - "Workspace root" — create at the top level.
   Reuse the same parent for subsequent PRDs in the same session.
3. Call `mcp__claude_ai_Notion__notion-create-pages` with the PRD's
   markdown content. The 20-section PRD format is markdown-pure (pipe
   tables, fenced code blocks, plain lists) — the MCP imports it cleanly.
4. Report **both** the local file path **and** the Notion URL. The Notion
   URL is the canonical artifact for stakeholder review.

**Update mode**: if the user passes an existing Notion page URL via the
"Audit this PRD" or "Patch missing sections" invocation, update that page
in place via `mcp__claude_ai_Notion__notion-update-page` instead of
creating a new one.

**If Notion MCP is not loaded**: fall back to local `./PRD.md` only and
disclose to the user.

**Hard rules**:

- Never emit Notion-specific markdown extensions. Plain markdown only.
  Pipe-syntax tables for Sections 14–20 (component inventory, data schema,
  state transitions, agent capability spec, mock data, routing, tech
  stack) — all render cleanly in Notion.
- Never silently overwrite a PRD that wasn't explicitly passed for update.
  If a "PRD: [Product Name]" page exists under the parent, ask before
  creating a new one.
- The local `./PRD.md` is always written, even on Notion publish success.

---

## Operating modes

### Mode 1: Full PRD generation

When generating from scratch or from design outputs (personas, pain points, HMWs, feature specs),
produce all 22 sections below. Do not summarize or abbreviate any section.

Ask upfront if not provided:
- What is the product and primary persona?
- What does the product already do (if anything)?
- What integrations are in scope vs. out of scope for v1?
- What tech stack should Claude Code use?

### Mode 2: PRD audit

When given an existing PRD, run it against the 20-section checklist below.
Report: present / missing / incomplete for each section.
Then offer to generate the missing sections inline.

### Mode 3: Patch mode

When the user has a PRD and wants only the missing Claude Code sections added,
generate just the missing sections and clearly mark where to insert them.

---

## The 22 required PRD sections

### Section 1: Document header
Table with: product name, version, status, primary persona, document purpose, output use.

### Section 2: Background and context
- What the product already does (if anything)
- What this PRD adds
- Key integration assumptions, especially what is explicitly OUT of scope

### Section 3: Problem statement
One paragraph. Specific. Anchors everything that follows. No solution language.

### Section 4: Product goal
3–5 questions the user should be able to answer after using the product.

### Section 5: Success criteria
- User outcomes (what the user can do/feel/stop doing)
- Product outcomes (behavioral or metric)

### Section 6: Non-goals
Explicit list. These prevent scope creep in implementation.

### Section 7: Primary persona (canonical)
**Single primary persona only.** Per the hard rule: design for ONE persona.

Define for the primary persona: role, accountability, what they're NOT
responsible for (scope boundary), AI relationship (power user / skeptic
/ first exposure), success on a good day, failure on a bad day, information
asymmetries, Assumption IDs they depend on.

**Secondary personas (flat reference list, no design effort):**
For each — name, role, one-line relationship to the primary persona's
workflow. These exist only so mock data (Section 18) and activity
timelines can populate realistic actors. They get ZERO dedicated screens
or user stories.

### Section 8: Design principles
4–6 principles, each implying a decision. Format: **Name:** implication.

### Section 9: Information architecture
- Top-level navigation table (section → one-line purpose)
- Secondary navigation per section
- Key system objects (named and described in one line each)

### Section 10: Core screens
Per screen: name, purpose (one sentence), key modules with one-line descriptions.

### Section 11: User stories (primary persona only)
Format: "As [primary persona], I want [action] so that [outcome]."
Minimum 5 stories. Per the single-primary-persona rule, secondary
personas do NOT get user stories — they appear in mock data only.

### Section 12: Functional requirements
- State model (table: state, description, terminal?)
- Classification/severity model (if applicable)
- Confidence model (if AI-involved: level, threshold, UI behavior)
- Notification rules (trigger, recipient, channel — sparingly)
- Permission model (role → can do / cannot do table)

### Section 13: Feature specs
Per feature: description, user actions, agent actions, tech scope, failure states
and fallbacks, risk mitigation pattern.

---

### Section 14: Component inventory ⚡ Claude Code critical

```
| Component | Type | Props / Inputs | Actions emitted | Screen(s) |
|-----------|------|----------------|-----------------|-----------|
| [Name] | [page/panel/modal/table/form/card/badge/button] | [prop: type] | [onAction] | [Screen] |
```

Type options: page, panel, modal, table, form, card, badge, button, input, drawer,
toast, stepper, timeline, sidebar, tab, tooltip.

Every UI element that needs to be built gets a row. Be specific — "IssueDetailPanel"
not "issue screen".

---

### Section 15: Data schema ⚡ Claude Code critical

Per object:
```
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | uuid | yes | auto | Primary key |
| name | string | yes | — | Display name |
| status | enum(detected,assigned,resolved,closed) | yes | detected | Workflow state |
| severity | enum(blocking,high,medium,minor) | no | null | Filing risk level |
| created_at | timestamp | yes | now | Creation time |
| assignee_id | uuid (FK → User) | no | null | Assigned owner |
| is_archived | boolean | no | false | Soft delete flag |
```

Field types to use: string, text, uuid, integer, float, boolean, timestamp, enum(val1,val2,...),
json, uuid (FK → ObjectName).

Include relationships (belongs to, has many) and owner (user-created / agent-created / system).

---

### Section 16: State transition table ⚡ Claude Code critical

```
| From state | To state | Trigger | Guard | Side effects | Initiated by |
|------------|----------|---------|-------|--------------|--------------|
| Detected | Assigned | User assigns owner | Owner field not null | Notify assignee, log event | User |
| Assigned | In progress | Assignee opens issue | — | Log view event | Agent (passive) |
| In progress | Resolved pending | Assignee submits rationale | Rationale field complete | Notify lead for review | User |
| Resolved pending | Closed | Lead approves | Rationale passes quality check | Log closure, update health | User |
| Any | Blocked | User marks blocked | — | Alert lead | User |
```

Every transition needs all 6 columns. No prose state descriptions here.

---

### Section 17: Agent capability spec ⚡ Claude Code critical

Per agent action:
```
### Capability: [ActionName]
| Field | Value |
|-------|-------|
| Input | [Data sources the agent reads] |
| Output | [What it produces and where] |
| Confidence model | [How uncertainty is expressed in the UI] |
| Fallback — low confidence | [What it does/shows when uncertain] |
| Fallback — hard failure | [What it does/shows when it cannot complete] |
| Human touchpoint | [Yes — requires review before effect / No — applies automatically] |
| Trigger | [What initiates this action] |
| Side effects | [State changes, notifications, log entries] |
```

---

### Section 18: Mock data examples ⚡ Claude Code critical

Realistic JSON examples for each core object. Requirements:
- 2–3 examples per object
- Realistic field values (not "string1", "user@email.com", "test")
- Cover multiple states: one active, one stalled or blocked, one resolved/closed
- Include domain-appropriate values (real-sounding names, realistic dates, plausible content)

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Dosing frequency differs between Section 2.4 and Module 5.3",
    "state": "assigned",
    "severity": "high",
    "assignee": "Dr. Maria Chen",
    "created_at": "2025-03-12T09:14:00Z",
    "_note": "Active, assigned, not yet acknowledged"
  }
]
```

---

### Section 19: Navigation and routing ⚡ Claude Code critical

```
| Route | Screen | Auth required | Notes |
|-------|--------|--------------|-------|
| / | Command Center | Yes | Default landing after login |
| /inconsistencies | Inconsistency Queue | Yes | |
| /inconsistencies/:id | Issue Detail | Yes | Deep-link to specific issue |
| /assignments | Assignments View | Yes | |
| /audit | Audit View | Yes | |
| /login | Login | No | Redirects to / if already authenticated |
```

---

### Section 20: Tech stack declaration ⚡ Claude Code critical

```
| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend framework | React / Next.js / Vue | |
| Styling | Tailwind / CSS Modules | |
| State management | useState / Zustand / React Query | |
| Routing | React Router / Next.js router | |
| Backend/API | Mock data / Express / Next.js API routes / Supabase | |
| Database | PostgreSQL / SQLite / in-memory mock | |
| Auth | None for prototype / Clerk / NextAuth / mock session | |
| AI/LLM calls | Anthropic Claude API / OpenAI / mocked | |
| Notifications | In-app only / Email (mocked) / None for prototype | |
| Deployment target | Vercel / local only | |
```

Nothing left blank. Claude Code will not assume.

---

### Section 21: Edge cases ⚡ Claude Code critical

Carried forward from `/founding-design-ideation` Phase 6. Adds a **UI surface** column on top of the Phase 6 table so Claude Code knows where each edge case manifests.

```
| Category | Scenario | Expected behavior | UI surface | Severity | Assumption IDs |
|----------|----------|-------------------|------------|----------|----------------|
| Empty state | First-time use, no items detected | Show empty illustration + "Agent will surface items here when it finds them" | DashboardScreen | Medium | — |
| Error state | Network failure during agent action | Surface a retry banner; preserve user input in form | IssueDetailScreen, ResolutionForm | High | A2 |
| Stress state | 1000+ items in queue | Paginate; virtualized list; agent observations card surfaces "Filter to high-severity first" | QueueScreen | Medium | A5 |
| Permission edge | User without approve rights opens Issue Detail | Hide Approve button; show "Approval requires Regulatory Lead role" | IssueDetailScreen | High | — |
| Data edge | Issue with missing trace candidate field | Render the issue normally; trace section shows "Candidate not yet proposed" placeholder | IssueDetailScreen | Low | — |
| Temporal edge | Sarah approves while another reviewer is editing | Detect conflict; surface "Another reviewer made changes — review before approving" | IssueDetailScreen | High | A4 |
```

Categories required: **empty / error / stress / permission / data / temporal** (all 6). Minimum 12 rows total (≥ 2 per category, ≥ 3 for categories the prototype must demonstrate). Severity scale: Filing-blocking / High / Medium / Low.

---

### Section 22: Assumptions log ⚡ Claude Code critical

Carried forward from `/founding-design-ideation` Phase 1. Less detailed than the Phase 1 source (drops Why + How-to-validate columns to keep the PRD scannable), but every assumption has an ID Claude Code can reference if implementation forces a re-evaluation.

```
| # | Assumption | Validation status | Impact if wrong |
|---|------------|-------------------|-----------------|
| A1 | Primary persona reviews ~8–15 issues/day during cross-doc phase | Untested | Pacing of notifications + agent autonomy thresholds would shift |
| A2 | 70% rationale-match threshold is the right confidence floor | Untested | Either too many false flags (lower) or too many silent commits (higher) |
| A3 | 5-day stall threshold is the right escalation timer | Untested | Stalled-issues queue fills too fast or too slow |
| A4 | FDA reviewers care about inline trace candidates, not just final chains | Untested | Filing-trust contract differs; trace UX changes materially |
| A5 | Single-submission scope (no portfolio view) for v1 | Confirmed | — |
```

Every PRD must carry forward every assumption from Phase 1. Status values: **Untested / In-progress / Confirmed / Rejected**. If status is "Rejected" — the assumption was tested and is wrong — the affected sections of the PRD must reflect the corrected reality, and the row is kept for audit purposes.

---

## PRD quality gate checklist

Run this before calling the PRD done:

**Completeness**
- [ ] All 22 sections present
- [ ] No section contains TBD, to be defined, or placeholder text
- [ ] Non-goals list would prevent scope creep
- [ ] Section 7 designs for ONE primary persona (no secondary-persona user stories or screens)

**Claude Code readiness**
- [ ] Component inventory lists real component names with types and props
- [ ] Data schema has field-level types, not just field names
- [ ] State transition table is a table, not described in prose
- [ ] Agent capabilities each have a defined fallback for low confidence and hard failure
- [ ] Mock data uses realistic values across different states
- [ ] All routes are declared explicitly
- [ ] Tech stack leaves nothing unspecified
- [ ] Edge cases section has ≥ 12 rows (3 per category minimum across 6 categories)
- [ ] Edge cases include a UI surface column naming the screen or state each lands on
- [ ] Assumptions log has every assumption flagged with current validation status

**Design integrity**
- [ ] Agent vs. human actions clearly separated throughout
- [ ] Low-confidence scenarios are designed for, not just mentioned
- [ ] Every agent action that changes state has a human review point (or explicitly doesn't)
- [ ] No design effort spent on secondary personas (they appear in mock data only)
