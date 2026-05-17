---
name: agent-states
description: |
  Reference doc for the 13 agent states every AI feature has to design
  for. Loaded automatically when designing flows, components, or UX
  around an AI/agent feature — referenced, not invoked as conversation.
  When the user asks "which states apply here?" or "what's the UX for
  hallucination?", return a concrete answer from this skill. Each state
  has a named UX pattern, not "show an error message." Built for the
  Peer AI exercise and any agent-feature work in regulated or
  high-stakes domains.
license: MIT
allowed-tools:
  - Read
  - AskUserQuestion
---

## What this skill does

This is a **reference document**, not a conversation. Other skills
(`product-thinking`, `journey-and-flow`, `lofi-and-components`,
`ux-review`) call into this skill to get concrete UX patterns for each
of the 13 agent states.

When invoked directly, the skill answers two questions:

1. **"Which states apply to this flow?"** → returns a filtered table
   from the 13 below, with one-line rationale per applicable state.
2. **"What's the UX for state X?"** → returns the concrete pattern
   from the table, plus 1–2 example moments where it fires.

Never returns "show an error message" or "handle gracefully." Every
answer names a specific UI mechanic.

## The 13 states

| # | State | Triggers when | Concrete UX pattern |
|---|---|---|---|
| 1 | Success | Agent returned what was asked, confidence is high | Inline green check next to the affected span; no modal, no toast. Optional "View what changed" affordance with a diff. |
| 2 | Partial Success | Agent did the task but with caveats (skipped a section, used a fallback model, ran out of context) | Yellow caveat banner above the result with explicit list: "Filled sections 1–3. Section 4 skipped: source document missing." |
| 3 | Hallucination / Confidence Failure | Output looks plausible but is wrong, or confidence is low on a specific span | Red-bordered inline flag on the suspect span. Tooltip: "Source unverified — confirm before keeping." Cannot dismiss without an explicit user action (click "Verified" or "Reject"). |
| 4 | Out of Scope | Agent recognizes the task is outside its capability | Agent surfaces this as a sentence in its own response area, not an error: "I can't draft section 6 from this — it needs the latest IND on file. Want me to flag it for review?" Offers one explicit next action. |
| 5 | Ambiguous Input | Agent can't determine what the user is asking | Inline clarification chip below the input — 2–3 candidate interpretations as buttons, plus a "None of these" option that returns to free-form. Never a modal. |
| 6 | Fallback | Agent reverts to human/default behavior (model unavailable, tool failed, retries exhausted) | Greyed-out agent UI with a single line: "Agent unavailable — continuing in manual mode." Preserves all user input. Optional "Retry agent" affordance with cooldown. |
| 7 | Feedback Loop | Agent updates based on user correction (accepted a rejected suggestion, learned a preference) | Subtle confirmation in the agent panel: "Got it — won't suggest [X] again this session." Never interrupts the flow. Surfaces in a "What the agent learned" log if the user wants to audit. |
| 8 | Timeout / Stalled | Agent is taking too long or stopped responding | Inline progress indicator with elapsed time visible after 3s. At 10s: "Still working… you can keep editing while I think." At 30s: explicit "Cancel" affordance. Never a spinner with no time signal. |
| 9 | Conflicting Constraints | Agent has contradictory inputs (e.g., user said "shorten" but spec says "keep all required sections") | Agent surfaces the conflict in its response: "You asked for shorter, but section 4.2 is required by FDA. Want me to (a) keep 4.2 and shorten elsewhere, or (b) flag 4.2 for removal review?" Two explicit options. |
| 10 | Confidence Threshold Not Met | Agent has multiple valid options and low confidence on which is right | Agent surfaces 2–3 alternatives instead of deciding. Each labeled with a one-line "why this might be right." User picks. Never picks for the user when below threshold. |
| 11 | Degraded Mode | Agent operates with reduced capability (data source missing, RAG index stale, tool unavailable) | Persistent banner in the agent panel: "Working from local templates only — FDA guidance index unavailable." Specific about what's missing. Agent still answers but caveats are explicit. |
| 12 | Human Override | User interrupts or redirects the agent mid-task | Agent stops cleanly, preserves partial work, surfaces what it was about to do: "Stopped at section 4.2. I was about to insert [text]. Discard / Save as draft / Resume." Three options, no default. |
| 13 | Escalation | Agent recognizes it needs human judgment and surfaces context for the decision | Generates a structured handoff: the question, the alternatives considered, the missing information, and a "Notify [role]" action. Not a generic "I need help" — a packet a human can act on in 30 seconds. |

## How other skills call this

**From `product-thinking`** (Beat 5):
> "Which 3–4 of the 13 states are highest-stakes for this product?"
> Returns: AskUserQuestion with the user's top candidates pre-selected
> from the brief context.

**From `journey-and-flow`** (Beat 2, generating alternatives):
> Each journey direction must annotate "which states fire where" — at
> minimum, the 3–4 high-stakes states from PRD must appear at concrete
> moments in the flow.

**From `lofi-and-components`**:
> Component taxonomy must include atoms for each high-stakes state's
> UX pattern. If the PRD called out Hallucination, the component
> library has a `<UnverifiedSpan>` atom.

**From `ux-review`** (Part A):
> Scans the prototype for coverage. Every high-stakes state from PRD
> must have a UI moment that proves/disproves it. Flags any state
> missing as a concrete failure ("Screen 3 has no Hallucination flag
> on AI-generated content").

## Anti-slop rules

- Never write "show an error message," "handle gracefully," "provide
  feedback." All vague.
- Never suggest a modal when an inline pattern works. Modals are an
  escape hatch, not a default.
- Never collapse two states into one ("Partial Success and Degraded
  Mode are basically the same"). They're not — Partial means *this
  task* had caveats; Degraded means *the whole system* is limited.
- Each UX pattern must name the user's recovery action explicitly.
  "User can dismiss" is not enough — what does the dismiss button say,
  and what state does the system go to?

## When to invoke directly

The user types something like:
- "Run agent-states on this flow"
- "Which states matter for [feature]?"
- "What's the UX for [hallucination / timeout / escalation]?"

Default behavior: return the relevant subset of the table above,
filtered to what's actually relevant, plus 1–2 concrete moments where
each state fires in the user's flow.
