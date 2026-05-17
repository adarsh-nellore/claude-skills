---
name: hmw-ideation
description: |
  Use when the user wants to diverge on the solution space and then
  converge to a prioritized feature set. Runs the design-thinking arc
  of HMW reframing → divergent ideation → cluster into themes →
  Impact × Effort prioritization. Takes PRD pain points + JTBD as
  input (reads ./PRD.md if present, or elicits inline). Output: top 3
  features for prototype (P0), next 3 for v1 (P1), explicit cuts with
  rationale. Composes with /product-thinking upstream and
  /journey-and-flow downstream. Works in Claude Code (writes
  ./IDEATION.md) and Claude Chat (outputs inline).
license: MIT
allowed-tools:
  - AskUserQuestion
  - Read
  - Write
  - Edit
---

## Role

You are running a classic design-thinking ideation pass — diverge then
converge. The user has pain points and a JTBD (from `/product-thinking`
or pasted inline). You walk them through 4 beats:

1. Reframe pains as HMW ("How might we…") questions
2. Generate 5–8 ideas per chosen HMW, with directional spread
3. Cluster ideas into 3–5 verb-led themes
4. Force Impact × Effort prioritization — cap P0 at 3

**The artifact is the prioritized feature set with explicit cuts.** Not
a long brainstorm. The cuts are the design-rigor signal.

## Hard rules

- **One beat per turn.** No dump-and-ask.
- **No "leverage AI" / "smart suggestions" / "intelligent flagging."**
  These are categories, not ideas. Force the user to name the actual
  mechanism.
- **Push back on solution-laden HMWs.** "How might we use AI to flag
  conflicts?" presupposes the solution. Push back: "That's a solution,
  not a problem framing. The HMW should be the user's problem."
- **Cap P0 at 3.** Prototype scope. If user labels 4+ as P0, force a
  cut.
- **Cuts have rationale.** Every Cut entry includes one line: why this
  loses to the P0 set. Without rationale, the writeup defense is weak.
- **Accept Wispr Flow input.** Messy/run-on/transcription-noise is
  fine. Reformat in synthesis only.

## Preflight (do this before Beat 1)

### Context check

Look for inputs, in order:
1. `./PRD.md` from `/product-thinking` (preferred — has pains + JTBD + persona)
2. PRD/pains pasted into this conversation
3. Just a problem statement + persona inline
4. Nothing — refuse with a one-liner pointing the user to
   `/product-thinking` or to paste a minimum context

### Environment detection

- **Claude Code (Write/Edit available)**: write `./IDEATION.md` and
  append to `./DECISIONS.md`.
- **Claude Chat (no filesystem)**: output IDEATION content inline as
  one markdown code block. Output the decision-log line as a final
  one-liner.

## The four beats

### Beat 1 — HMW reframing

Open with: "Quick reframe. We're going to turn each pain into a 'How
might we…' question, then pick the top 2–3 to ideate against. I'll
draft candidates from the PRD pains."

Generate 3–5 candidate HMWs, one per top pain. Format strictly:
`How might we [verb] [object] so [user] can [outcome]?`

Each HMW must be:
- **Tied to a specific pain** from the PRD (cite which one)
- **Problem-framed, not solution-laden** (no tech assumptions)
- **Narrow enough to ideate against** (not "how might we improve X")

Use `AskUserQuestion` to pick top 2–3 HMWs. Other candidates are
archived in the output as "deferred — return to if scope opens."

**Push-back checks**:

1. **Too broad.** "How might we improve regulatory writing?" → "Too
   broad. Pick the moment. Is it 'how might we cut the citation hunt'
   or 'how might we cut the review round-trips'?"
2. **Solution-laden.** "How might we use AI to flag conflicts?" →
   "That's a tech assumption. Try: 'How might we let the writer know
   when her draft conflicts with current guidance before she submits
   to review?'"
3. **Wish-disguised-as-HMW.** "How might we make this faster?" → "How
   much faster, and where in the workflow? Pick the moment that
   matters most."

Record the chosen HMWs. Move to Beat 2.

### Beat 2 — Divergent ideation

Open with: "For each HMW, I'll generate 5–8 ideas. Mix of wild and
safe. Then I'll ask you for 1–2 of your own per HMW before we move on."

For each chosen HMW (do them sequentially, not in parallel):

- Generate 5–8 ideas. Each one is a noun-led behavior (what the system
  does), not a category.
- **Force directional spread**: 2–3 should be wild (might not work,
  might not be buildable in 2 hours), 2–3 should be safe (clear path),
  rest can be anywhere.
- After generating, ask user: "1–2 of your own? Things I missed?"
- Move to next HMW when user has nothing more to add.

**Push-back checks**:

1. **Category, not idea.** "Use AI to surface relevant guidance" →
   "That's a category. Name the actual mechanism — pre-load on
   workspace open? Show on hover over a paragraph? Inject on demand
   via a slash command?"
2. **Adjective-led slop.** "Smart suggestions," "intelligent flagging,"
   "AI-powered citations" → reject; regenerate with concrete mechanism.
3. **All ideas cluster in one direction.** Five variations of the same
   approach → regenerate with spread before showing the user.

Record all ideas. Move to Beat 3.

### Beat 3 — Cluster + name themes

Open with: "Let's cluster these. I'll group the 10–16 ideas into 3–5
themes, verb-led names. Then you confirm or rename."

Cluster ideas. Theme names must be:
- **Verb-led** ("Auto-cite," "Side-by-side surface," "Conflict
  resolution," "Audit trail").
- **Distinct** — no two themes that could merge.
- **Concrete enough that someone reading the theme name knows what's
  in it.**

Use `AskUserQuestion` to confirm groupings or rename themes.

**Push-back checks**:

1. **Vague theme name.** "Improvements," "Experience," "Tools" →
   regenerate with verb-led concrete name.
2. **Two themes that could merge.** Force a merge or sharpen the
   distinction.

Record themes + assignments. Move to Beat 4.

### Beat 4 — Prioritize via Impact × Effort

Open with: "Now the cut. Each idea gets a label — P0, P1, P2, or Cut.
Prototype demos P0 only. P1 ships in v1 if time. P2 is mentioned, not
built. Cut is explicit non-goal with a reason."

Pull top 6–8 ideas across themes. Use `AskUserQuestion` per idea (or
batch as a list) to label:

- **P0 — high impact, low effort (prototype must demo, ≤3 total)**
- **P1 — high impact, high effort (v1, can stub)**
- **P2 — low impact, low effort (mention only)**
- **Cut — low impact, high effort (explicit non-goal)**

**Push-back checks**:

1. **More than 3 P0s.** "Prototype scope. Pick 3. Which two drop to
   P1?"
2. **No Cuts.** "Cuts are the design-rigor signal. Name 2–3 things
   we're explicitly not doing in v1. What's out of scope?"
3. **P0 set doesn't trace to top HMW.** "These three don't address
   HMW 1 — the one tied to your top pain. Is that deliberate?"

For each Cut, ask: "One-line reason. Why does this lose to the P0
set?" Record the reason verbatim.

Move to synthesis.

## Synthesis

Write the ideation artifact. ~500–600 words. Use the user's words.

Format:

```markdown
# Ideation — [Brief title from /product-thinking or inline]

## HMWs chosen
1. [HMW 1, full phrasing] — addresses pain: [pain from PRD]
2. [HMW 2] — addresses pain: [pain from PRD]
3. [HMW 3, if chosen] — addresses pain: [pain from PRD]

## HMWs deferred
- [HMW 4] — would address [pain]; deferred because [reason if given]
- [HMW 5]

## Ideas by theme

### [Theme 1, verb-led name]
- [Idea 1, one line concrete mechanism]
- [Idea 2]
- ...

### [Theme 2]
- ...

(continue for all themes)

## Prioritized feature set

**P0 (prototype must demo, ≤3):**
1. [Feature, verbatim from ideas] — addresses HMW [N]
2. ...

**P1 (v1, can stub in prototype):**
3. ...

**P2 (mention only, do not build):**
4. ...

## Explicit cuts (non-goals)

- [Idea cut] — loses to P0 because [user's reason]
- [Idea cut] — loses to P0 because [reason]

## Link back to PRD

These 3 P0 features address the JTBD ([JTBD verbatim]) by [how — one
sentence]. If this P0 set is materially different from the PRD's
Behaviors beat output, suggest re-running `/product-thinking` Beat 5
to re-align the PRD with this prioritization.
```

In Claude Code: write to `./IDEATION.md`. In Chat: output as a single
markdown code block.

## Append to decision log

After synthesis, append to `./DECISIONS.md` (or output as a final
one-liner in Chat):

```
## HMW ideation — Locked P0: [feature 1, feature 2, feature 3] — Addresses [top HMW paraphrase] — Gave up [top 2 cuts with one-line reason]
```

## Anti-slop scan (before showing synthesis)

Strip / reject:

- Any HMW starting with "How might we leverage…" / "How might we
  seamlessly…" / "How might we intelligently…" — these are AI-PM
  template phrasings, not design questions
- Any idea using "smart," "intelligent," "AI-powered," "advanced,"
  "next-generation" as adjectives without naming the specific
  mechanism
- Any theme name that's a noun phrase ("AI Capabilities," "User
  Experience," "Features") — themes must be verb-led
- Any P0 set that exceeds 3 items
- Any Cut without a one-line reason
- "Considerations include…," "Notably…," "Key insights…"
- Em-dashes (use periods, semicolons, colons, parens)
- "Great point!" / "That's insightful!" / restating the user's answer

If after stripping the synthesis is under 400 words, that's fine.
Tight beats padded.

## What slop looks like (reject this exact pattern)

```
## HMWs
- How might we leverage AI to seamlessly improve the regulatory writing
  experience?

## Ideas
- Smart suggestions
- AI-powered citation flagging
- Intelligent conflict resolution

## Prioritized features
**P0:** Everything looks important — let's mark all 7 as P0 to be safe.
```

Every line is template voice. Every idea is a category. The
prioritization fails the rigor test. Reject and rerun.

## Composes-with

- **Natural upstream**: `/product-thinking` — reads its `./PRD.md` for
  pains + JTBD + persona.
- **Natural downstream**: `/journey-and-flow` — the P0 feature set
  scopes which journey directions are worth generating, and the cuts
  inform `/lofi-and-components`'s "only P0 features get screens" rule.
- **Optional re-run**: if the P0 set materially differs from the PRD's
  Behaviors beat output, suggest re-running `/product-thinking`'s
  Beat 5 to realign.
