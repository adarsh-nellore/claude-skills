---
name: build-lofi
description: Generate a single scrolling HTML page of lo-fi feature sketches from a PRD. Each sketch is one independent UI frame annotated with a short value-focused blurb. Uses a declarative JSON region tree rendered by a bundled client-side script; no main-thread HTML generation, no per-concept HTML files. Spawns N per-concept JSON-emitting agents in one parallel batch. Built for time-boxed founding-designer exercises where the goal is to put multiple feature concepts on the table in under a minute. Triggers: "build lo-fi", "build lofi", "lo-fi sketches", "feature sketches", "rough wireframes", "design concepts", "give me a few feature options", "wireframe these features". Composes upstream from /code-ready-prd (reads ./PRD.md if present). Pairs downstream into /build-hifi.
---

# build-lofi v4

## What this skill produces

For a given PRD, write one scrolling HTML page of N (default 6) independent feature sketches. Each sketch is a single UI frame with a value-focused blurb on its left. Output is a buffet for the designer to scan and pick from; the picks feed into /build-hifi.

## Why v4 exists

v3 had each per-concept agent write ~250 lines of HTML and the main thread Write a single ~2000-line `sketch.html` with all fragments inlined. The main-thread Write was the wall-clock killer. v4 swaps HTML generation for a declarative JSON region tree rendered client-side by a bundled `lofi.js`. Each agent writes ~30–60 lines of JSON instead of HTML. Main thread writes only the merged `concepts.json` (~3 sec).

Wall-clock target: **under 60 seconds end-to-end** for a 6-concept run.

## Hard rules

- **Single primary persona.** Every sketch serves the same primary persona's JTBD. Differentiation is feature scope, not persona scope. Use PRD Section 7 primary persona only.
- **Consume `./PRD.md` if present.** Read PRD Sections 7 (primary persona), 10 (core screens), 13 (feature specs), and 21 (edge cases) on the main thread.
- **N independent sketches, not e2e flows.** No CTA hints linking one to another.
- **JSON only from agents.** Agents do not write HTML. They emit one JSON object per concept and save it to `_concept{N}.json`. The renderer (`lofi.js`) produces all DOM.
- **No em dashes anywhere.** No "you" pronoun in blurbs.

## Speed contract

| Beat | Work | Wall-clock |
|------|------|-----------|
| 1 | Read PRD, decide concept set on main thread | ~15 sec |
| 2 | `mkdir` + copy skill bundle assets (one Bash) | ~1 sec |
| 3 | Spawn N parallel JSON-emitting agents | ~20 sec |
| 4 | Read N tiny JSON files, merge into `concepts.json`, single Write | ~3 sec |
| 5 | Start http server in background | ~1 sec |
| **Total** | | **~40 sec** |

If any beat exceeds these targets, investigate before adding more agents or more layers.

## Inputs (precedence order)

1. File path passed as argument.
2. Pasted PRD text in the user's message.
3. `./PRD.md` in the cwd.

Project folder default: `~/Documents/{slug}/` derived from the PRD's product name (kebab-case, ≤32 chars). If none of the above resolves, ask once.

## Execution sequence

### Beat 1: Decide concept set on main thread

Read PRD. Identify primary persona + the feature inventory. Decide N concepts (default 6, range 4–8). For each concept, pre-decide:

- `id` (kebab-case)
- Concept name (3–6 words)
- Blurb (≤30 words, two sentences: what is on screen / value to persona)
- `proposed_route` (`/`-prefixed kebab path)
- `layout_type`: `dashboard` | `queue` | `detail` | `form` | `timeline` | `audit`
- `primary_regions[]` (3–6 kebab tokens)
- `agent_involvement`: `none` | `summary` | `suggestion` | `candidate-match`

Hold the array in main-thread memory.

### Beat 2: Project folder + asset copy

Single Bash:

```bash
mkdir -p {project-dir} && cp ~/.claude/skills/build-lofi/{sketch.html,lofi.js,lofi.css,REGIONS.md} {project-dir}/
```

### Beat 3: Spawn N parallel agents in one tool-call batch

Each agent prompt is short. It tells the agent:

1. First step: `Read ~/.claude/skills/build-lofi/REGIONS.md` for the region vocabulary.
2. Product context (1 paragraph distilled from the PRD).
3. This concept's spec: name, role in IA, what it should contain, layout hints.
4. Output: a single JSON object matching the concept schema in REGIONS.md, saved to `{project-dir}/_concept{N}.json`.
5. Hard rules block (no em dashes, no "you", no fake content text, primary working region must use `box.xl` or `queue-table` or `side-by-side`, every container has a tooltip).

Per-concept prompts can be tight (~30–50 lines each) because the renderer enforces structure. The agent picks regions from the vocabulary and parametrizes them; it does not invent layouts.

### Beat 4: Merge JSON

Main thread reads all N `_concept{N}.json` files in parallel, then writes `{project-dir}/concepts.json` with the envelope:

```json
{
  "product": "...",
  "primary_persona": "Name, Role",
  "source_prd": "absolute path or 'pasted'",
  "generated_at": "ISO 8601 UTC",
  "subtitle": "optional",
  "concepts": [ /* the N concept objects */ ]
}
```

Then delete the per-concept JSON files: single Bash `rm {project-dir}/_concept*.json`.

### Beat 5: Serve

Single Bash, background, port 3009:

```bash
lsof -ti:3009 | xargs kill 2>/dev/null; sleep 1; cd {project-dir} && python3 -m http.server 3009
```

Tell the user: `http://localhost:3009/sketch.html`.

## Per-concept agent prompt template

```
Write a JSON object describing one lo-fi feature sketch concept. Save to `{project-dir}/_concept{N}.json`. Return only the path.

## First step

Call Read on `/Users/adarshnellore/.claude/skills/build-lofi/REGIONS.md` to load the region vocabulary. Then construct the JSON using only those region types.

## Product context

{1 paragraph from PRD background + primary persona}

## This concept: {concept name}

{2-3 sentences on what this feature is, where it lives, why it earns a sketch}

## Output JSON schema

Top-level object:
{
  "id": "{kebab-id}",
  "title": "{concept name}",
  "blurb": "{<=30-word value-focused blurb, two sentences}",
  "proposed_route": "{/route/path}",
  "layout_type": "{dashboard|queue|detail|form|timeline|audit}",
  "primary_regions": [...],
  "agent_involvement": "{none|summary|suggestion|candidate-match}",
  "lofi": [ /* region tree using vocab in REGIONS.md */ ]
}

## Layout brief

{10-30 lines: which regions to use, what their content shapes should suggest, which is dominant. Reference region type names from REGIONS.md.}

## Hard rules

- No em dashes. No "you" pronoun. Third person.
- No fake content text. Pills carry only PRD enum values or system labels.
- Visual hierarchy: include exactly one dominant region using box.xl OR queue-table OR side-by-side. Chrome (topbar, breadcrumb) stays box.sm.
- Every container with a `tooltip` field must have a one-sentence explanation as that tooltip.

Save to `{project-dir}/_concept{N}.json`. Return only the path.
```

## Stop condition

Report:
1. Path to `sketch.html` (project folder).
2. Path to `concepts.json`.
3. Server URL.
4. One-line list of concept names with `id`s.

Then stop. Do not auto-invoke /build-hifi.

## Out of scope

- React/Vue/any framework.
- Real design systems or component libraries.
- Click-through navigation between sketches.
- Per-concept HTML files (everything is JSON + the bundled renderer).
- A "recommendation" or "pick one" framing.

## Files bundled with this skill

- `SKILL.md` (this file)
- `sketch.html` — page shell, copied verbatim into project folder
- `lofi.css` — styles, copied verbatim
- `lofi.js` — renderer, copied verbatim
- `REGIONS.md` — region vocabulary, copied for agent reference

## Files produced per run

- `{project-dir}/sketch.html`, `lofi.css`, `lofi.js`, `REGIONS.md` (asset copies)
- `{project-dir}/concepts.json` (the single source of truth; also the handoff to /build-hifi)
