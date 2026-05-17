# Motion rules for `/build-hifi` per-screen agents

Static screens are one of the strongest "AI-generated" tells. Every screen this skill writes must carry motion in the following surfaces.

## What every screen must include

1. **Page entrance with stagger.** Top-level sections on every page mount with a fade-up stagger using the codebase's existing utility classes (e.g., `.anim-fade-in-0` through `.anim-fade-in-5`). Order top-down with increasing delay index: hero/strip first (`anim-fade-in-0`), primary content second (`anim-fade-in-1`), secondary content third (`anim-fade-in-2`), tertiary/footer last. Apply as `className` additions to the top-level section wrappers inside the page component.

2. **Hover transitions on interactive surfaces.** Card, Button, ListItem, and TableRow primitives carry hover transitions in their CSS via tokens. Subagents rely on the primitives' built-in behavior; they do NOT add hover styles inline or via Tailwind utility classes that override the primitive.

3. **Tab and accordion swaps.** If a screen uses tabs or accordion sections, the content swap uses opacity transition via the codebase's existing utility (e.g., `.tab-content`). No JS-orchestrated motion.

4. **Chart draw-in.** Chart components (Sparkline, LineChartWithBand, MiniAreaChart) animate their path on mount via stroke-dasharray. This is built into the chart components. Subagents do not animate paths manually.

5. **Subtle state-change indicators.** Apply `subtlePulse` or equivalent only where the PRD's flow specifically calls for a state change worth noticing (a status pill flipping from "Detected" to "Assigned," a notification badge appearing). Otherwise leave it off; gratuitous pulsing reads as marketing.

## Hard motion bans

- No `framer-motion`, `react-spring`, `auto-animate`, `motion-one`, or any motion library imports.
- No inline `style={{ animation: ... }}` or `style={{ transition: ... }}`.
- No new `@keyframes` rules anywhere.
- No reliance on browser default scroll-snap or scroll-driven animations unless the codebase already uses them.

## Fallback

If the codebase's `globals.css` does not provide a needed motion utility (for example, `.anim-fade-in-3` does not exist), the agent must fall back to a smaller stagger using only the indexes that DO exist, not invent new classes.

## Durations

Durations should stay short: 150 to 300 ms for transitions, 600 to 800 ms total for page entrance stagger. The codebase encodes these; subagents do not need to think about durations.
