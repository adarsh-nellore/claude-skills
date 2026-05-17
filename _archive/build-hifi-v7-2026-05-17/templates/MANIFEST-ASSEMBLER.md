# Manifest assembler

The main thread runs this once per build (in Beat 1) to produce `./BUILD-CONTEXT.md` — the single project-specific document every per-screen agent Reads. Replaces the old pattern of pasting a 3500-token manifest into every agent prompt.

## Inputs (all read in one parallel batch)

Read these files in ONE tool-call batch with multiple Read tool uses, not sequentially:

1. `src/app/globals.css` — extract:
   - Color tokens and semantic aliases (OKLCH values).
   - Typography tokens.
   - Radii and shadows.
   - General utility classes (`.glass-card`, `.section-header`, etc.).
   - Animation keyframes (`@keyframes fadeInUp`, `subtlePulse`, etc.).
   - Animation utility classes that subagents will attach to elements (`.anim-fade-in-0` through `.anim-fade-in-5`, `.card-hover`, `.tab-content`).
2. `docs/COMPOSITION.md` — closed-enum composition contract.
3. `docs/NAVIGATION.md` — Button vs LinkButton vs Link wiring rules.
4. `docs/LAYOUT.md` — five named structural shells + Desktop resilience section.
5. `docs/COMPONENTS.md` — primitive inventory.
6. `docs/SPACING.md` — named-bucket scale.
7. `src/lib/types.ts` and `src/lib/mock-data.ts` — current type and data shape.

In the same parallel batch, run these Globs:

- `src/components/ui/**`
- `src/components/layout/**`
- `src/components/charts/**`
- `src/components/typography/**`
- `src/components/patterns/**`

For each Glob result, do a quick Grep on `export function` and `interface` / `type` lines (not full reads) to capture the exported component name + prop signature.

## Output: `./BUILD-CONTEXT.md`

Write the assembled manifest to the project root with this shape:

```markdown
# BUILD-CONTEXT.md — design-system manifest for this run

Generated: <ISO-8601 timestamp>
DS-doc-hash: <sha256 hash of the concatenated 5 docs — used by --add mode to skip Beat 1 next run>

## Color tokens
<list of token name → OKLCH value lines>

## Typography tokens
<list>

## Layout shells (from LAYOUT.md)
<list of named shells + when to use each>

## Available primitives
- @/components/typography: Heading, Body, MetaText, Caption, …
- @/components/layout: AppShell, PageContainer, PageHeader, Stack, Cluster, SplitFrame, …
- @/components/ui: Button, LinkButton, Card, StatusBadge, Tabs, …
- @/components/charts: Sparkline, MiniAreaChart, LineChartWithBand, …
- @/components/patterns: <list>

For each primitive, one line: `Name(propA: typeA, propB?: typeB) — short purpose`.

## Animation utility classes
<exhaustive list — agents must pick from these, no inventing>

## Composition contract (summary)
<5-bullet summary of COMPOSITION.md, pointing at HARD-CONTRACT.md for full detail>

## Desktop resilience (verbatim from LAYOUT.md)
<paste the LAYOUT.md "Desktop resilience" section in full>

## Current types
<the type names defined in src/lib/types.ts, one per line>

## Current mock-data exports
<the export names from src/lib/mock-data.ts, one per line>
```

## Caching

Compute the DS-doc-hash by reading the 5 docs and `globals.css` and taking a sha256 of their concatenated content. Write it into the file header (`DS-doc-hash:`).

On subsequent runs (especially `--add` mode), the skill Reads `./BUILD-CONTEXT.md` first. If it exists AND its `DS-doc-hash:` matches the current hash, skip the assembly step entirely. This is the load-bearing speed win for iterating on the same prototype.

## Verify common-mistakes accuracy

After assembling `BUILD-CONTEXT.md`, the main thread also Reads `./build-hifi-ctx/COMMON-MISTAKES.md` and compares its primitive-API references (e.g. "MetaText.tone = 'muted'") against what `BUILD-CONTEXT.md` actually shows in the primitive inventory. If a primitive API has drifted, update `./build-hifi-ctx/COMMON-MISTAKES.md` in place (the project copy, not the skill repo copy) before per-screen agents read it.

## Size budget

Keep `BUILD-CONTEXT.md` under ~3500 tokens. Truncate verbose token blocks (just list names + values; don't include CSS comments). The animation utility class list and the composition summary must be complete and explicit because subagents are required to honor them.
