---
name: build-hifi
description: |
  Use when the user wants a refined, high-fidelity, clickable Next.js
  prototype generated from a PRD inside a pre-built design-system
  codebase. Speed-tuned, quality-floor-preserving pipeline (v7): a
  Node script handles every mechanical step (clone, types, mock-data
  skeletons with pre-seeded ids + FK pre-fills + narrative-convention
  placeholders, chrome with brand injection, route stubs, compound
  shells with data wiring, brief-bundle concatenation, nav-crawl +
  interactivity audits) in ~3 seconds. LLM agents do the judgment
  work, with model routing for cost: ONE Opus strategy+style agent
  emits STRATEGY.md + strategy.json + style-baseline.json in a single
  turn (cornerstone, IA philosophy, motion personality, content voice,
  density target, motion/color/density baselines); ONE Sonnet 4.6
  spec agent emits screens.json → mock-contract.json +
  narrative-conventions.json → ia.json sequentially; per-entity Haiku
  agents fill mock-data with full-sentence narrative density (named
  actors + FK references + deadlines); cornerstone + dashboard +
  compound-child screens get Opus authoring at 400-500 LOC with
  reasoning paragraph + 3 dynamic patterns + 1 narrative element +
  cornerstone CTA; other simple screens get Sonnet 4.6 authoring at
  220-320 LOC with the same quality floor (2 dynamic patterns +
  narrative element + cornerstone CTA). Post-build nav-crawl verifies
  every href resolves; interactivity-audit verifies every Button is
  a Link wrap, client-island onClick, or explicit aria-disabled.
  Final Haiku gut-check agent reads the three audit reports +
  screenshot filenames and flags outstanding issues in ≤150 words.
  Inputs: `<prd>` + optional `--brief notes.md` + `--from lofi/` +
  `--cornerstone "/route"` + `--references a.png,b.png`. Triggers:
  "build hi-fi", "build the prototype", "generate the screens",
  "build the high-fidelity prototype", "build hifi from PRD", "add
  features to my app", "scaffold these screens". Composes downstream
  from /build-lofi + /code-ready-prd. Wall-clock target without
  /fast: 10-14 min. Cornerstone quality is the priority; secondary
  screens still clear the portfolio bar.
license: MIT
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

## Role

Generator. The user has a design-system codebase at `~/Projects/adarsh-design-system/` (or equivalent), a PRD, and possibly additional inputs (raw notes, lo-fi sketches, visual references, a declared cornerstone surface). This skill clones the DS into a fresh project, runs a strategy-reasoning step to align IA + style around the user's POV, emits structured specs, scaffolds every mechanical file, then spawns a focused parallel batch of agents to fill content at v3-grade narrative density. Visual fidelity comes from the DS + applied motion library + per-screen reasoning. The skill enforces nav + interactivity correctness mechanically after the build.

## v7 architecture (speed-tuned, quality-floor preserved)

Three layers with a strict seam. v7 collapses v6's 5+ planning agents into 2 and routes content-fill by model for cost; the cornerstone quality floor is unchanged.

| Layer | What | Cost |
|---|---|---|
| Deterministic | Node script: `bootstrap`, `emit-brief-bundle`, `extract-primitives`, `scaffold-types`, `scaffold-mock-data` (id-seeded, narrative-convention placeholders), `scaffold-chrome --brand`, `scaffold-routes`, `scaffold-compound` (data-wired), `bundle-context`, `nav-crawl`, `interactivity-audit`, `validate-ia-screens`, `build`, `dev` | ~5s total |
| LLM (strategy + specs) | ONE Opus strategy+style agent → STRATEGY.md + strategy.json + style-baseline.json in one turn; ONE Sonnet 4.6 spec agent → screens.json → mock-contract.json + narrative-conventions.json → ia.json sequentially. All JSON validated against schemas. | ~3-4 min wall-clock |
| LLM (content fill, parallel) | Per-entity Haiku 4.5 value-fill agents (200 LOC cap, trimmed bundle); cornerstone + dashboard simple-screen agents on Opus (400-500 / 350-450 LOC cap, 3 dynamic patterns + narrative element); other simple-screen agents on Sonnet 4.6 (220-320 LOC cap, 2 dynamic patterns + narrative element + cornerstone CTA); per-compound-sub-component agents on Opus (350-450 LOC cap); content prose on Sonnet 4.6 (uncapped) | ~5-8 min wall-clock |

Quality gates after build: nav-crawl + interactivity-audit + Playwright smoke (per-route load + per-pair leftnav walk + URL-param overlays + hover screenshots) + final Haiku gut-check agent (~20-30s) that flags outstanding issues in ≤150 words.

## Inputs

- `<prd-path>`: required.
- `--brief <path>`: extra notes file (markdown) with user intent / domain context / strategic direction.
- `--from <lofi-folder>`: `/build-lofi` output folder containing `concepts.json` + `sketch.html`.
- `--cornerstone <route-path>`: explicit cornerstone declaration. E.g. `--cornerstone "/submissions/[id]/sections/[id]"`. Overrides the strategy agent's inference if specified.
- `--references <paths>`: comma-separated paths to visual reference images. Strategy agent treats these as intent signals (cannot view image bytes directly, but their presence + the user's brief carries the intent forward).
- `--ds-path <p>`: design-system clone path. Default `~/Projects/adarsh-design-system`.
- `--project <p>`: project folder. Default `~/Documents/<prd-slug>`.
- `--port <n>`: dev server port. Default 3000.

## Hard prerequisites

1. **DS manifest committed.** `<ds-path>/docs/MANIFEST.md` must exist. If not, abort with: "Run `node scripts/generate-manifest.mjs` in the DS root and commit the result."
2. **PRD provides data schema + persona.** Beat 1 spec agents need this. Thin PRDs cause validation failure and abort.

## Generation process

### Beat 0: Bootstrap + brief bundle + primitives (~30s, main thread)

```bash
node ~/.claude/skills/build-hifi/bin/build-hifi.mjs bootstrap \
  --ds-path <ds-path> --project <project> --prd <prd-path> \
  --timings <project>/build-hifi-timings.jsonl

node ~/.claude/skills/build-hifi/bin/build-hifi.mjs extract-primitives \
  --ds-path <ds-path> --project <project> --timings <T>

node ~/.claude/skills/build-hifi/bin/build-hifi.mjs emit-brief-bundle \
  --prd <prd-path> [--brief <p>] [--from <lofi>] [--cornerstone <route>] \
  [--references a.png,b.png] --project <project> --timings <T>
```

After this: `BUILD-CONTEXT.md`, `PRIMITIVE-ENUMS.md`, `BRIEF-BUNDLE.md` all exist in the project. The `build-hifi-ctx/` directory carries HARD-CONTRACT, MOTION-LIBRARY, QUALITY-BAR, NARRATIVE-CONVENTIONS, COMMON-MISTAKES from the skill templates.

### Beat 0.5: Strategy + style baseline (~90-120s, ONE Opus agent)

Spawn ONE `general-purpose` Agent with `model: "opus"`. This single agent replaces v6's separate strategy (Beat 0.5) and style-baseline (Beat 1.5) calls. Both outputs come from the same context, so emitting them in one turn cuts a full roundtrip. Prompt:

```
Read /<project>/BRIEF-BUNDLE.md, /<project>/BUILD-CONTEXT.md,
build-hifi-ctx/MOTION-LIBRARY.md, build-hifi-ctx/QUALITY-BAR.md. No other files.

Reason carefully about the user's intent. Produce THREE artifacts in this turn:
strategy.json, style-baseline.json, and STRATEGY.md (the human-readable
explanation referencing both).

PART A: strategy.json (validate against schemas/strategy.schema.json):

1. cornerstoneScreen: the route that is the heart of the experience.
   - If the user passed --cornerstone, use that exact path. Done.
   - Otherwise infer: pick the route where the primary persona spends the most
     OPERATIONAL time (their core working surface), NOT the dashboard. A deep
     editor, triage queue, or compound working canvas almost always wins.
   - If persona evidence is thin, default to the deepest compound-complexity
     screen the PRD names.
   - Write a 2-sentence cornerstoneJustification citing the persona's JTBD from
     PRD Section 7 and the specific decisions they make on this surface.
2. iaPhilosophy: hub_spoke / linear / deep_nested / tabbed. Match the
   cornerstone + primary persona's mental model.
3. primaryPersona: name, role, jtbd. Pulled from PRD Section 7.
4. motionPersonality: calm / punchy / quiet / playful. Regulatory = calm.
   Consumer e-comm = punchy. Operator dashboards = quiet.
5. contentVoice: regulatory / consumer / analytical / narrative / operator.
6. densityTarget: low / medium / high. Match brief intent.
7. keyInteractions: 3-6 named patterns the prototype must expose. One-liner each.
8. navigationPolicy: maxClicksToCornerstone (default 2), homeRoute (default
   "/dashboard").

PART B: style-baseline.json (validate against schemas/style-baseline.schema.json):

Author motion + hover + focus + color hierarchy + density classes specific to
this app's strategy. The motion patterns MUST come from MOTION-LIBRARY.md
(no inventions). Color hierarchy + density classes anchor to the DS manifest
from BUILD-CONTEXT.md.

PART C: STRATEGY.md (human-readable):

Write the same content as readable markdown with cornerstoneJustification +
which motion patterns apply where. This is what the user skims.

Validate each JSON:
  node /Users/adarshnellore/.claude/skills/build-hifi/bin/build-hifi.mjs validate <project>/strategy.json --schema strategy
  node /Users/adarshnellore/.claude/skills/build-hifi/bin/build-hifi.mjs validate <project>/style-baseline.json --schema style-baseline

Both must print `ok`. Return only the three file paths.
```

### Beat 1: Spec emission (~90-120s, ONE Sonnet sequential agent)

Spawn ONE `general-purpose` Agent with `model: "sonnet"`. This single agent replaces v6's three parallel/sequential Opus spec calls. Spec emission is structured and schema-gated, which Sonnet 4.6 handles reliably while cutting cost ~3×.

Prompt:

```
Read /<project>/BRIEF-BUNDLE.md, /<project>/STRATEGY.md, /<project>/strategy.json,
build-hifi-ctx/NARRATIVE-CONVENTIONS.md. No other files.

Produce THREE JSON specs IN ORDER. Validate each before moving to the next.
If any schema validation fails, re-emit ONLY that spec with the validator
error inline. Hard stop after 2 failures on the same spec.

STEP 1: screens.json (validate against schemas/screens.schema.json):

- The route at strategy.cornerstoneScreen MUST be present with
  complexity: "compound" and 3-6 children.
- The strategy.navigationPolicy.homeRoute (default /dashboard) MUST surface a
  primary CTA pointing toward the cornerstone (recorded in
  primaryCtaTo: "<cornerstone path>").
- Every screen declares requiredMockEntities.
- Validate:
  node /Users/adarshnellore/.claude/skills/build-hifi/bin/build-hifi.mjs validate <project>/screens.json --schema screens

STEP 2: mock-contract.json + narrative-conventions.json (validate against
mock-contract.schema.json and narrative-conventions.schema.json):

- Emit entities with `notes` baked from the NARRATIVE-CONVENTIONS.md rules
  for each entity type.
- Strings flagged as `mustBeFullSentence` get `hint` placeholders in seed values.
- Validate each.

STEP 3: ia.json (validate against schemas/ia.schema.json):

- Read the screens.json you just emitted. IA hrefs MUST match real screen paths.
- Set `brand` to the PRD product name.
- LeftNav structure follows STRATEGY.iaPhilosophy.
- Validate.

Return only the file paths (no transcript of intermediate validation output).
```

Main thread runs `validate-ia-screens` after the agent returns to confirm zero href mismatches across the three specs. On failure, re-spawn the spec agent with the cross-validation error attached (max 2 retries, then abort).

### Beat 2: Scaffold + bundle (~5s deterministic)

```bash
BHF=~/.claude/skills/build-hifi/bin/build-hifi.mjs
P=<project>
T=$P/build-hifi-timings.jsonl

node $BHF scaffold-types     $P/mock-contract.json --project $P --timings $T
node $BHF scaffold-mock-data $P/mock-contract.json --project $P --timings $T   # reads narrative-conventions.json automatically
node $BHF scaffold-chrome    $P/ia.json            --project $P --timings $T   # reads ia.brand
node $BHF scaffold-routes    $P/screens.json       --project $P --timings $T
node $BHF scaffold-compound  $P/screens.json       --project $P --timings $T
```

After this:
- `src/lib/types.ts`: every entity interface + shared enum.
- `src/lib/mock-data/<entity>.ts`: type-safe arrays with seeded ids. String fields under narrative-conventions are pre-populated with `"TODO: <hint>"` so the value-fill agent can't miss them.
- `src/lib/mock-data.ts` aggregator.
- `ID-GRAPH.md`: id pools per entity.
- `src/components/app/{AppLeftNav,AppTopNav,AppScreen}.tsx`: chrome with brand injected.
- `src/app/<route>/page.tsx` for every screen. Simple screens have `<AppScreen role pageTitle> <></> </AppScreen>` stubs. Compound shells import requiredMockEntities + resolve params + pass children data via direct mock-data imports.

Then bundle context per Beat 3 target:

```bash
for target in <each-simple-screen> <each-compound-child> <each-entity> content; do
  node $BHF bundle-context --project $P --target "$target" --type <kind> \
    --out $P/agent-ctx/$target.md --timings $T
done
```

Each bundle includes (in order):
QUALITY-BAR + HARD-CONTRACT + PRIMITIVE-ENUMS + MOTION-LIBRARY + COMMON-MISTAKES + NARRATIVE-CONVENTIONS reference + DS manifest + PRD + STRATEGY.md + strategy.json + style-baseline.json + narrative-conventions.json + ID-GRAPH + IA + screens + mock-contract.

**v7 entity-bundle trim**: when `--type entity` is passed, `bundle-context` now omits the Quality Bar + Motion Library sections automatically. Entity value-fill agents author no markup and no motion classes (they only replace `"TODO: <hint>"` strings), so those two docs were dead weight that slowed Haiku's read. The full bundle is still emitted for screen / compound / content targets where visual judgment matters. No prompt-side action required.

### Beat 3: Content fill (~5-8 min, ONE parallel batch with model routing)

Spawn ALL of these as `general-purpose` Agent calls in ONE message. **Model routing is the biggest cost dial in v7.** Before dispatching, the main thread reads `strategy.json.cornerstoneScreen` and `strategy.json.navigationPolicy.homeRoute` (default `/dashboard`) and tags each screen agent's `model` field accordingly.

#### Model routing table

| Agent class | Model | Why |
|---|---|---|
| Per-entity value-fill | `haiku` | Mechanical placeholder replacement; narrative-convention hints are explicit. |
| Cornerstone screen (`strategy.cornerstoneScreen`) | `opus` | Quality floor where it matters most. |
| Dashboard / `homeRoute` | `opus` | First impression; greeting + KPI density + cornerstone CTA. |
| Other simple screens | `sonnet` | Sonnet 4.6 clears the portfolio floor at ~3× the speed/cost of Opus. |
| Compound sub-components | `opus` | These are children of the cornerstone surface. |
| Content prose | `sonnet` | Structured regulatory prose. |

If a Beat 3 dry run shows a Sonnet-authored secondary screen falling below the quality floor (see acceptance criteria in the SKILL's verification notes), escalate the "other simple screens" row to `opus` and re-run only that screen.

#### Per-entity value agents (`model: "haiku"`, ≤200 LOC)
```
Read ./agent-ctx/entity-<name>.md ONLY. Edit src/lib/mock-data/<name>.ts:
replace the "TODO:" placeholders in happy + error variants with values that
follow the narrative-conventions hint embedded in each placeholder. Keep ids
exact (already seeded). Hard cap 200 LOC. No em dashes. Return file path + count.
```

#### Cornerstone + dashboard screen agents (`model: "opus"`)

Cornerstone cap: **400-500 LOC**. Dashboard cap: **350-450 LOC**.

```
You are filling the body of <route>. This screen is on the critical path
(cornerstone or homeRoute): quality ceiling, not floor.

## What you must produce
A dense, designer-quality screen body. NOT a wireframe. NOT a structural
placeholder. Cap: <400-500 | 350-450> LOC.

## Why this screen exists for this persona
[derived from STRATEGY.md + screen intent in the bundle]

## What this screen MUST include
1. ≥ 3 dynamic interaction patterns from the QUALITY-BAR list
2. ≥ 1 narrative content element (named entity + date + FK ref resolved to label)
3. Visual hierarchy: kicker → title → subtitle → action
4. Reasoning paragraph (≥ 2 sentences) wherever the agent surfaces a recommendation
5. Every interactive control: working <Link>, client island, or aria-disabled
6. Cornerstone CTA: surface a primary path toward STRATEGY.cornerstoneScreen
   (cornerstone screen itself: surface the primary working action, not a CTA back to itself)

## What you must NOT do
- Use any prop value not in PRIMITIVE-ENUMS.md
- Author motion classes outside MOTION-LIBRARY.md
- Use em dashes or "you" in product copy
- Render empty placeholder rows

## Context
Read ./agent-ctx/<target>.md ONLY.

Return: file path + LOC + which 3 dynamic patterns + which narrative element.
```

#### Other simple screen agents (`model: "sonnet"`, **220-320 LOC**)

Quality floor. These CANNOT be skeletons. Sonnet must still clear:

```
You are filling the body of <route>. Secondary screen: quality floor, not
ceiling. Cap: 220-320 LOC.

## What you must produce
A clean, designer-quality screen body. Tighter than cornerstone but no
empty rows, no placeholder copy, no skeletons.

## What this screen MUST include
1. ≥ 2 dynamic interaction patterns from the QUALITY-BAR list
2. ≥ 1 narrative content element (named entity + date + FK ref resolved to label)
3. Visual hierarchy: kicker → title → subtitle → action
4. Every interactive control: working <Link>, client island, or aria-disabled
5. Cornerstone CTA: at least one primary path toward STRATEGY.cornerstoneScreen

## What you must NOT do
- Use any prop value not in PRIMITIVE-ENUMS.md
- Author motion classes outside MOTION-LIBRARY.md
- Use em dashes or "you" in product copy
- Render empty placeholder rows or `TODO:` strings
- Drop below 220 LOC: if you would, the screen is under-spec'd; surface 1 more
  data table or feed instead

## Context
Read ./agent-ctx/<target>.md ONLY.

Return: file path + LOC + which 2 dynamic patterns + which narrative element + cornerstone CTA location.
```

#### Per-compound-sub-component agents (`model: "opus"`, **350-450 LOC**)

Same prompt structure as cornerstone, with child name + the shared style baseline emphasized. These are part of the cornerstone surface and inherit its quality ceiling.

#### Content prose agent (`model: "sonnet"`, uncapped)

Real domain-specific prose authored per section id. Regulatory / financial / clinical phrasing follows the contentVoice from strategy.json.

### Beat 4: Build + audits (~1-2 min)

```bash
node $BHF build --project $P --timings $T
node $BHF nav-crawl --project $P --timings $T
node $BHF interactivity-audit --project $P --timings $T
```

The DS's prebuild hook runs `generate-manifest && audit-composition`. nav-crawl confirms every href in the codebase resolves to a real route. interactivity-audit confirms every `<Button>` is satisfied (Link wrap, client onClick, or aria-disabled).

On any failure: surface error verbatim with file:line. Likely-offending agent named via file path. User decides whether to re-spawn that agent or fix manually.

### Beat 5: Smoke (~2 min)

```bash
node $BHF dev --project $P --port <port> --timings $T &
# wait for localhost:<port> to respond, then:
node ~/.claude/skills/build-hifi/bin/smoke.mjs \
  --project $P --base-url http://localhost:<port> \
  --out $P/SMOKE-REPORT.md --timings $T
```

Smoke now asserts (in addition to v5):
- Per-pair leftnav walk: every IA leftNav href returns 200 with no console error
- Per-route motion grep: ≥ 3 motion class hits per rendered route
- URL-param overlays for compound screens

### Beat 6: Gut-check + run report (~30-45s)

Main thread first writes `RUN-REPORT.md` mechanically from `build-hifi-timings.jsonl`:
- Wall-clock per beat (from timings JSONL)
- Per-agent wall-clock sorted descending, with model used (opus / sonnet / haiku) per agent
- LOC per generated file
- Audit retries (none expected)
- Smoke / nav-crawl / interactivity-audit summaries (pass/fail)

Then spawns ONE thin `general-purpose` agent with `model: "haiku"` for a lightweight gut-check (replaces v6's Opus quality-review: same safety net, ~10% the cost):

```
Lightweight gut-check. ≤150 words. No polish notes, no rewriting suggestions,
no full design critique.

Read these files only:
- /<project>/SMOKE-REPORT.md
- /<project>/NAV-CRAWL-REPORT.md
- /<project>/INTERACTIVITY-AUDIT.md
- /<project>/RUN-REPORT.md
- `ls /<project>/smoke-screens/` (filenames only, do not open images)

Flag any outstanding issues, errors, or red flags that the mechanical audits
didn't catch. Examples worth flagging:
- A leftnav href that the audit passed but smoke shows returning a blank screen
- An interactivity-audit pass with suspicious aria-disabled clusters
- Smoke screenshots missing for routes that should have rendered
- Timings outlier (one agent took 5× longer than the rest)
- Empty SMOKE-REPORT sections

If nothing is wrong, output exactly: "No outstanding issues."

Append your output to /<project>/RUN-REPORT.md under a new `## Gut-check`
heading. Return the file path.
```

End the turn. Do not open browser. Do not run `/ux-review`. The user drives.

## Speed levers

v7's primary speed lever is **model routing** (see Beat 3 table). That delivers the bulk of cost/wall-clock savings vs v6 without dropping below the quality floor.

- **Model routing (default in v7)**: Haiku for entity fills + gut-check, Sonnet for spec emission + secondary screens + content prose, Opus for strategy+style + cornerstone + dashboard + compound children. Halves Opus token spend vs v6.
- **`/fast`**: optional Opus 4.7 fast-output toggle. Adds ~1.5-2× speedup on Opus-tagged agents at meaningfully higher cost. Skip for budget-sensitive runs (2-hour design exercises); enable if wall-clock is the only constraint.
- **Collapsed planning agents**: v7 already merges v6's 5 planning agents into 2 (one Opus strategy+style, one Sonnet spec). Do not split these back out unless schema validation repeatedly fails on the merged spec.

## Hard contract reference

The skill bundles into every `agent-ctx/<target>.md`:
- `HARD-CONTRACT.md` (audit-enforced composition rules)
- `MOTION-LIBRARY.md` (specific motion patterns + class names): *omitted for `--type entity` bundles*
- `QUALITY-BAR.md` (6 quality dimensions agents must clear): *omitted for `--type entity` bundles*
- `NARRATIVE-CONVENTIONS.md` (per-field voice rules)
- `COMMON-MISTAKES.md` (specific anti-patterns from past runs)
- `PRIMITIVE-ENUMS.md` (every closed-enum prop value in the DS)
- `BUILD-CONTEXT.md` (the DS manifest)
- `STRATEGY.md` + `strategy.json` (this run's strategic POV)
- `style-baseline.json` (motion + color + density choices for this run)
- `ID-GRAPH.md` (real ids per entity)

Beat 3 content-fill agents read ONE bundled file per target. No other reads. (Beat 0.5 and Beat 1 planning agents read 2-4 upstream files because no per-target bundle exists yet at that point.)

## For AI/agent features

Screens with `agentInvolvement != "none"` use DS `agent/` primitives (ConfidenceBadge, AgentAvatar, ReasonedChip, etc.). Visual states are mock-data-driven; for real Claude calls, follow up with `/claude-api` after the visual build.

## Stop conditions

- DS manifest missing → abort with regen instructions.
- Strategy agent fails schema validation 3 times → abort with errors verbatim.
- Any Beat 1 agent fails schema validation 3 times → abort.
- nav-crawl reports unresolved href → fix is to re-spawn screens agent OR remove dead route from IA. Don't ship broken nav.
- interactivity-audit reports bare-button violation → fix is to re-spawn the offending screen agent.
- Build fails on audit → surface verbatim. Likely cause: agent invented a prop value not in PRIMITIVE-ENUMS.md.
- Total wall-clock > 20 min → flag as anomaly in RUN-REPORT.md but don't abort (v7 target is 10-14 min; > 20 means a Beat 3 agent stalled or schema retries cascaded).

## Out of scope

- Synthesizing a design system from scratch.
- Picking aesthetic direction without strategic input.
- Authentication, user accounts, multi-tenancy.
- Real API integration (use `/claude-api` after the visual build).
- Deployment to Vercel or any host.
